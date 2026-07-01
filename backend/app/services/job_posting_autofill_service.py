from __future__ import annotations

import html as html_lib
import ipaddress
import json
import re
import socket
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, TypedDict, cast
from urllib.parse import urlparse

import extruct  # type: ignore[import-untyped]
import httpx
import trafilatura
from selectolax.parser import HTMLParser, Node

from app.core.enums import EmploymentType, SalaryPeriod, WorkArrangement
from app.core.errors import AppError
from app.core.url_normalization import normalize_job_posting_url
from app.schemas.application import (
    JobPostingAutofillFields,
    JobPostingAutofillResponse,
)

MAX_FETCH_BYTES = 2_000_000
MAX_DESCRIPTION_CHARS = 20_000
FETCH_TIMEOUT_SECONDS = 12
USER_AGENT = "ApplyTogetherJobAutofill/3.0"
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain"}
JOB_BOARD_SITE_NAMES = {
    "linkedin",
    "indeed",
    "ziprecruiter",
    "glassdoor",
    "monster",
    "handshake",
    "careerbuilder",
    "simplyhired",
}
SourceName = Literal[
    "greenhouse", "lever", "ashby", "workday", "json_ld", "html", "none"
]
FieldName = Literal[
    "company_name",
    "job_title",
    "location",
    "work_arrangement",
    "employment_type",
    "salary_min",
    "salary_max",
    "salary_currency",
    "salary_period",
    "job_description",
]


class ExtractedSalary(TypedDict):
    salary_min: Decimal | None
    salary_max: Decimal | None
    salary_currency: str | None
    salary_period: SalaryPeriod | None


@dataclass
class FieldCandidate:
    value: Any
    confidence: int
    source: str


@dataclass
class ExtractionResult:
    source: SourceName
    candidates: dict[FieldName, FieldCandidate] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class SafeHttpJobPostingFetcher:
    def __call__(self, url: str) -> str:
        self._reject_private_resolution(url)
        try:
            with httpx.Client(
                timeout=FETCH_TIMEOUT_SECONDS,
                follow_redirects=True,
                max_redirects=3,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                response = client.get(url)
                self._reject_private_resolution(str(response.url))
                response.raise_for_status()
        except httpx.TimeoutException as error:
            raise AppError(
                504,
                "job_posting_fetch_timeout",
                "The job posting took too long to respond.",
            ) from error
        except httpx.HTTPError as error:
            raise AppError(
                502,
                "job_posting_fetch_failed",
                "We could not read that job posting right now.",
            ) from error

        content_type = response.headers.get("content-type", "").lower()
        if content_type and not any(
            allowed in content_type
            for allowed in ("text/html", "application/xhtml", "text/plain")
        ):
            raise AppError(
                415,
                "job_posting_content_type_unsupported",
                "That URL did not return a readable job posting page.",
            )
        if len(response.content) > MAX_FETCH_BYTES:
            raise AppError(
                413,
                "job_posting_response_too_large",
                "That job posting page is too large to autofill.",
            )
        return response.text

    def _reject_private_resolution(self, url: str) -> None:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if hostname is None:
            raise AppError(
                400,
                "job_posting_url_invalid",
                "Enter a valid job posting URL.",
            )
        try:
            addresses = {
                socket_info[4][0]
                for socket_info in socket.getaddrinfo(
                    hostname,
                    parsed.port or (443 if parsed.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            }
        except socket.gaierror as error:
            raise AppError(
                400,
                "job_posting_url_unreachable",
                "We could not resolve that job posting URL.",
            ) from error
        for address in addresses:
            _reject_blocked_host(str(address))


class JobPostingAutofillService:
    def __init__(self, fetcher: Callable[[str], str] | None = None) -> None:
        self._fetcher = fetcher or SafeHttpJobPostingFetcher()

    def autofill(self, job_posting_url: str) -> JobPostingAutofillResponse:
        normalized_url = self._validate_url(job_posting_url)
        document = self._fetcher(normalized_url)
        result = _extract_best_effort(normalized_url, document)
        fields, field_sources, skipped = _trusted_fields(result.candidates)
        warnings = _warnings_for(fields, result.warnings, skipped)
        source: SourceName = result.source
        if not fields.model_dump(exclude_none=True) and source != "workday":
            source = "none"
        return JobPostingAutofillResponse(
            fields=fields,
            source=source,
            warnings=warnings,
            field_sources=field_sources,
        )

    def _validate_url(self, url: str) -> str:
        try:
            normalized_url = normalize_job_posting_url(url.strip())
        except ValueError as error:
            raise AppError(
                400,
                "job_posting_url_invalid",
                "Enter a valid job posting URL.",
            ) from error

        parsed = urlparse(normalized_url)
        if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
            raise AppError(
                400,
                "job_posting_url_invalid",
                "Enter a valid job posting URL.",
            )
        _reject_blocked_host(parsed.hostname)
        return normalized_url


def _extract_best_effort(url: str, document: str) -> ExtractionResult:
    parser = HTMLParser(document)
    metadata = _extract_metadata(url, document)
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    path = parsed.path.lower()

    ats_result: ExtractionResult | None = None
    if "greenhouse.io" in hostname:
        ats_result = _extract_greenhouse(parser)
    elif "lever.co" in hostname:
        ats_result = _extract_lever(parser)
    elif "ashbyhq.com" in hostname or "ashby" in document.lower():
        ats_result = _extract_ashby(parser)
    elif "myworkdayjobs.com" in hostname or "workday" in hostname or "workday" in path:
        ats_result = _extract_workday(parser, metadata)

    if ats_result is not None:
        _merge_missing_candidates(ats_result, _extract_structured(metadata))
        if ats_result.source == "workday" and not ats_result.candidates:
            return ats_result
        _merge_missing_candidates(ats_result, _extract_html(parser, document, metadata))
        return ats_result

    structured = _extract_structured(metadata)
    if structured.candidates:
        _merge_missing_candidates(structured, _extract_html(parser, document, metadata))
        return structured
    return _extract_html(parser, document, metadata)


def _reject_blocked_host(host: str) -> None:
    hostname = host.strip("[]").lower()
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".localhost"):
        raise AppError(
            400,
            "job_posting_url_not_allowed",
            "That URL cannot be used for autofill.",
        )
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return
    if (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    ):
        raise AppError(
            400,
            "job_posting_url_not_allowed",
            "That URL cannot be used for autofill.",
        )


def _extract_metadata(url: str, document: str) -> dict[str, Any]:
    try:
        extracted = extruct.extract(
            document,
            base_url=url,
            syntaxes=["json-ld", "microdata", "opengraph", "rdfa"],
            uniform=True,
        )
    except Exception:
        return {"json-ld": [], "microdata": [], "opengraph": [], "rdfa": []}
    return cast(dict[str, Any], extracted)


def _extract_greenhouse(parser: HTMLParser) -> ExtractionResult:
    result = ExtractionResult(source="greenhouse")
    page_title = _node_text(parser.css_first("title"))
    title_from_page, company_from_page = _split_title_and_company(page_title)
    title = _node_text(parser.css_first("h1"))
    company = _node_text(parser.css_first(".company-name")) or company_from_page
    location = _node_text(parser.css_first(".location"))
    description = _description_from_selectors(
        parser,
        ("#content", ".job__description", ".job-post", ".opening", "main"),
    )

    _add_text(result, "job_title", title or title_from_page, 95, "ats")
    _add_text(result, "company_name", company, 90, "ats")
    _add_text(result, "location", location, 90, "ats")
    _add_description(result, description, 90, "ats", min_length=40)
    _add_classifications(result, " ".join(_present(location, description)), 80, "ats")
    return result


def _extract_lever(parser: HTMLParser) -> ExtractionResult:
    result = ExtractionResult(source="lever")
    page_title = _node_text(parser.css_first("title"))
    title_from_page, company_from_page = _split_title_and_company(page_title)
    title = _node_text(parser.css_first(".posting-headline h2"))
    company = _image_alt(parser.css_first(".main-header-logo img")) or company_from_page
    categories = _node_text(parser.css_first(".posting-categories"))
    location = _first_location_like(categories)
    description = _description_from_selectors(
        parser,
        ('[data-qa="job-description"]', ".section-wrapper", ".posting-page", "main"),
    )

    _add_text(result, "job_title", title or title_from_page, 95, "ats")
    _add_text(result, "company_name", company, 85, "ats")
    _add_text(result, "location", location, 80, "ats")
    _add_description(result, description, 90, "ats", min_length=40)
    _add_classifications(result, " ".join(_present(categories, description)), 85, "ats")
    return result


def _extract_ashby(parser: HTMLParser) -> ExtractionResult:
    result = ExtractionResult(source="ashby")
    payload = _json_script_payload(parser, "__NEXT_DATA__")
    job_data = _find_dict_with_keys(
        payload,
        required=("title",),
        optional=("companyName", "locationName", "descriptionHtml", "employmentType"),
    )
    if job_data:
        description = _clean_text(
            _as_text(job_data.get("descriptionHtml") or job_data.get("description"))
        )
        _add_text(result, "job_title", _as_text(job_data.get("title")), 95, "ats")
        _add_text(
            result, "company_name", _as_text(job_data.get("companyName")), 90, "ats"
        )
        _add_text(result, "location", _as_text(job_data.get("locationName")), 90, "ats")
        _add_description(result, description, 90, "ats", min_length=40)
        _add_classifications(
            result,
            " ".join(
                _present(
                    _as_text(job_data.get("employmentType")),
                    _as_text(job_data.get("locationName")),
                    description,
                )
            ),
            85,
            "ats",
        )
        return result

    title = _node_text(parser.css_first("h1"))
    _add_text(result, "job_title", title, 75, "ats")
    result.warnings.append(
        "Ashby page data was incomplete; only high-confidence fields were used."
    )
    return result


def _extract_workday(parser: HTMLParser, metadata: dict[str, Any]) -> ExtractionResult:
    result = _extract_structured(metadata)
    if result.candidates:
        result.source = "workday"
        return result

    payload = _json_script_payload(parser, "__NEXT_DATA__")
    job_data = _find_dict_with_keys(
        payload,
        required=("title",),
        optional=("jobDescription", "locationsText", "workerSubType", "timeType"),
    )
    result = ExtractionResult(source="workday")
    if job_data:
        description = _clean_text(_as_text(job_data.get("jobDescription")))
        _add_text(result, "job_title", _as_text(job_data.get("title")), 90, "ats")
        _add_text(
            result, "location", _as_text(job_data.get("locationsText")), 85, "ats"
        )
        _add_description(result, description, 85, "ats", min_length=40)
        _add_classifications(
            result,
            " ".join(
                _present(
                    _as_text(job_data.get("workerSubType")),
                    _as_text(job_data.get("timeType")),
                    description,
                )
            ),
            80,
            "ats",
        )
        return result

    result.warnings.append(
        "Workday often renders job details with JavaScript, so this posting could not be confidently extracted."
    )
    return result


def _extract_structured(metadata: dict[str, Any]) -> ExtractionResult:
    posting = _best_structured_job_posting(metadata)
    if posting is None:
        return ExtractionResult(source="json_ld")
    result = _extract_job_posting(posting)
    result.source = "json_ld"
    return result


def _best_structured_job_posting(metadata: dict[str, Any]) -> dict[str, Any] | None:
    postings: list[dict[str, Any]] = []
    for syntax in ("json-ld", "microdata", "rdfa"):
        postings.extend(_find_job_postings(metadata.get(syntax)))
    if not postings:
        return None
    return max(postings, key=_job_posting_score)


def _find_job_postings(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [found for item in payload for found in _find_job_postings(item)]
    if not isinstance(payload, dict):
        return []

    item_type = payload.get("@type") or payload.get("type")
    types = item_type if isinstance(item_type, list) else [item_type]
    matches = (
        [payload]
        if any(str(candidate).lower().endswith("jobposting") for candidate in types)
        else []
    )

    for key in ("@graph", "graph", "properties", "itemListElement"):
        if key in payload:
            matches.extend(_find_job_postings(payload[key]))

    return matches


def _job_posting_score(posting: dict[str, Any]) -> int:
    score = 0
    for key in (
        "title",
        "hiringOrganization",
        "description",
        "jobLocation",
        "employmentType",
    ):
        if _first_value(posting.get(key)) is not None:
            score += 1
    return score


def _extract_job_posting(posting: dict[str, Any]) -> ExtractionResult:
    result = ExtractionResult(source="json_ld")
    description = _clean_text(_as_text(_first_value(posting.get("description"))))
    organization = _first_value(posting.get("hiringOrganization"))
    organization_name: str | None = None
    if isinstance(organization, dict):
        organization_name = _as_text(_first_value(organization.get("name")))
    elif isinstance(organization, str):
        organization_name = organization

    salary = _salary_from_json_ld(_first_value(posting.get("baseSalary")))
    location = _location_from_json_ld(posting)

    _add_text(result, "company_name", organization_name, 95, "json_ld")
    _add_text(
        result, "job_title", _as_text(_first_value(posting.get("title"))), 95, "json_ld"
    )
    _add_text(result, "location", location, 90, "json_ld")
    _add_description(result, description, 95, "json_ld", min_length=30)
    _add_classifications(
        result,
        " ".join(
            _present(
                _as_text(_first_value(posting.get("employmentType"))),
                _as_text(_first_value(posting.get("jobLocationType"))),
                description,
            )
        ),
        90,
        "json_ld",
    )
    if salary["salary_min"] is not None:
        result.candidates["salary_min"] = FieldCandidate(
            salary["salary_min"], 95, "json_ld"
        )
    if salary["salary_max"] is not None:
        result.candidates["salary_max"] = FieldCandidate(
            salary["salary_max"], 95, "json_ld"
        )
    if salary["salary_currency"] is not None:
        result.candidates["salary_currency"] = FieldCandidate(
            salary["salary_currency"], 95, "json_ld"
        )
    if salary["salary_period"] is not None:
        result.candidates["salary_period"] = FieldCandidate(
            salary["salary_period"], 95, "json_ld"
        )
    return result


def _extract_html(
    parser: HTMLParser, document: str, metadata: dict[str, Any]
) -> ExtractionResult:
    result = ExtractionResult(source="html")
    meta = _open_graph(metadata)
    title_text = _node_text(parser.css_first("title"))
    h1_text = _node_text(parser.css_first("h1"))
    og_title = meta.get("og:title") or meta.get("title")
    title, company_from_title = _split_title_and_company(og_title or title_text)
    site_name = meta.get("og:site_name") or meta.get("site_name")
    company = company_from_title
    if _site_name_is_likely_company(site_name):
        company = site_name

    description = _description_from_selectors(
        parser,
        (
            '[data-testid*="description"]',
            '[class*="description"]',
            '[class*="job-detail"]',
            '[class*="jobDescription"]',
            "article",
            "main",
        ),
    )
    if not _description_if_job_like(description, min_length=80):
        description = _trafilatura_description(document)

    trusted_text = " ".join(
        _present(
            _node_text(parser.css_first('[class*="location"]')),
            description,
            meta.get("description"),
        )
    )

    title_candidate = h1_text if _looks_like_role(h1_text) else title
    _add_text(result, "job_title", title_candidate, 84, "html")
    _add_text(result, "company_name", company, 84, "html")
    _add_text(result, "location", _first_location_like(trusted_text), 75, "html")
    _add_description(result, description, 82, "html", min_length=80)
    _add_classifications(result, trusted_text, 80, "html")
    return result


def _open_graph(metadata: dict[str, Any]) -> dict[str, str]:
    values: dict[str, str] = {}
    for item in cast(list[Any], metadata.get("opengraph") or []):
        if not isinstance(item, dict):
            continue
        properties = item.get("properties")
        if isinstance(properties, dict):
            iterable: Iterable[tuple[Any, Any]] = properties.items()
        else:
            iterable = item.items()
        for key, value in iterable:
            text = _as_text(_first_value(value))
            if text:
                values[str(key)] = text
    return values


def _trusted_fields(
    candidates: dict[FieldName, FieldCandidate],
) -> tuple[JobPostingAutofillFields, dict[str, str], list[str]]:
    payload: dict[str, Any] = {}
    field_sources: dict[str, str] = {}
    skipped: list[str] = []
    for field_name, candidate in candidates.items():
        threshold = 80
        if field_name in {"company_name", "job_title", "job_description"}:
            threshold = 82
        if candidate.confidence >= threshold and candidate.value not in (None, ""):
            payload[field_name] = candidate.value
            field_sources[field_name] = candidate.source
        else:
            skipped.append(field_name)
    return JobPostingAutofillFields(**payload), field_sources, skipped


def _merge_missing_candidates(
    target: ExtractionResult, fallback: ExtractionResult
) -> None:
    target.warnings.extend(fallback.warnings)
    for field_name, candidate in fallback.candidates.items():
        existing = target.candidates.get(field_name)
        if existing is None or candidate.confidence > existing.confidence:
            target.candidates[field_name] = candidate


def _add_text(
    result: ExtractionResult,
    field_name: FieldName,
    value: str | None,
    confidence: int,
    source: str,
) -> None:
    if field_name == "company_name":
        value = _clean_company(value)
    elif field_name == "job_title":
        value = _clean_title(value)
    else:
        value = _clean_text(value)
    if value:
        result.candidates[field_name] = FieldCandidate(value, confidence, source)


def _add_description(
    result: ExtractionResult,
    value: str | None,
    confidence: int,
    source: str,
    *,
    min_length: int,
) -> None:
    description = _description_if_job_like(value, min_length=min_length)
    if description:
        result.candidates["job_description"] = FieldCandidate(
            _limited(description, MAX_DESCRIPTION_CHARS), confidence, source
        )


def _add_classifications(
    result: ExtractionResult, text: str | None, confidence: int, source: str
) -> None:
    work_arrangement = _work_arrangement_from_text(text)
    if work_arrangement is not None:
        result.candidates["work_arrangement"] = FieldCandidate(
            work_arrangement, confidence, source
        )
    employment_type = _employment_type_from_text(text)
    if employment_type is not None:
        result.candidates["employment_type"] = FieldCandidate(
            employment_type, confidence, source
        )


def _node_text(node: Node | None) -> str | None:
    if node is None:
        return None
    return _clean_text(node.text(separator=" "))


def _image_alt(node: Node | None) -> str | None:
    if node is None:
        return None
    return _clean_text(node.attributes.get("alt"))


def _description_from_selectors(
    parser: HTMLParser, selectors: Iterable[str]
) -> str | None:
    for selector in selectors:
        text = _node_text(parser.css_first(selector))
        if _description_if_job_like(text, min_length=40):
            return text
    return None


def _trafilatura_description(document: str) -> str | None:
    try:
        extracted = trafilatura.extract(
            document,
            include_comments=False,
            include_tables=False,
            favor_precision=True,
        )
    except Exception:
        return None
    return _clean_text(extracted)


def _json_script_payload(parser: HTMLParser, script_id: str) -> Any:
    script = parser.css_first(f"script#{script_id}")
    if script is None:
        return None
    try:
        return json.loads(script.text())
    except json.JSONDecodeError:
        return None


def _find_dict_with_keys(
    payload: Any, *, required: tuple[str, ...], optional: tuple[str, ...]
) -> dict[str, Any] | None:
    if isinstance(payload, list):
        for item in payload:
            found = _find_dict_with_keys(item, required=required, optional=optional)
            if found is not None:
                return found
    if not isinstance(payload, dict):
        return None
    if all(key in payload for key in required) and any(
        key in payload for key in optional
    ):
        return payload
    for value in payload.values():
        found = _find_dict_with_keys(value, required=required, optional=optional)
        if found is not None:
            return found
    return None


def _first_value(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _present(*values: str | None) -> list[str]:
    return [value for value in values if value]


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = html_lib.unescape(re.sub(r"<[^>]+>", " ", str(value)))
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


def _as_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return None
    return _clean_text(str(value))


def _split_title_and_company(title: str | None) -> tuple[str | None, str | None]:
    cleaned = _clean_text(title)
    if not cleaned:
        return None, None
    cleaned = re.sub(r"^job application for\s+", "", cleaned, flags=re.I)
    patterns = (
        r"^(?P<title>.+?)\s+at\s+(?P<company>.+)$",
        r"^(?P<title>.+?)\s+-\s+(?P<company>.+)$",
        r"^(?P<company>.+?)\s+-\s+(?P<title>.+)$",
        r"^(?P<company>.+?)\s+\|\s+(?P<title>.+)$",
        r"^(?P<title>.+?)\s+\|\s+(?P<company>.+)$",
    )
    for pattern in patterns:
        match = re.match(pattern, cleaned)
        if not match:
            continue
        title_candidate = _clean_title(match.group("title"))
        company_candidate = _clean_company(match.group("company"))
        if title_candidate and company_candidate and _looks_like_role(title_candidate):
            return title_candidate, company_candidate
    return _clean_title(cleaned), None


def _clean_title(title: str | None) -> str | None:
    cleaned = _clean_text(title)
    if not cleaned:
        return None
    cleaned = re.sub(r"\s+\|\s+jobs?$", "", cleaned, flags=re.I)
    cleaned = re.sub(
        r"\s+-\s+(linkedin|indeed|ziprecruiter|glassdoor)$", "", cleaned, flags=re.I
    )
    return cleaned.strip() or None


def _clean_company(company: str | None) -> str | None:
    cleaned = _clean_text(company)
    if cleaned is None:
        return None
    cleaned = re.sub(r"\s+careers?$", "", cleaned, flags=re.I).strip()
    return None if _is_job_board_name(cleaned) else cleaned


def _site_name_is_likely_company(site_name: str | None) -> bool:
    cleaned = _clean_company(site_name)
    if not cleaned:
        return False
    if _looks_like_page_chrome(cleaned):
        return False
    return True


def _is_job_board_name(value: str | None) -> bool:
    cleaned = (value or "").strip().lower()
    return cleaned in JOB_BOARD_SITE_NAMES


def _looks_like_role(value: str | None) -> bool:
    lowered = (value or "").lower()
    role_words = (
        "engineer",
        "developer",
        "designer",
        "manager",
        "analyst",
        "specialist",
        "director",
        "coordinator",
        "intern",
        "scientist",
        "architect",
        "lead",
        "associate",
        "product",
        "sales",
        "marketing",
        "recruiter",
    )
    return any(word in lowered for word in role_words)


def _looks_like_page_chrome(value: str) -> bool:
    lowered = value.strip().lower()
    return (
        lowered in {"careers", "jobs", "job search", "home", "apply now"}
        or len(lowered) < 3
    )


def _description_if_job_like(value: str | None, min_length: int = 80) -> str | None:
    text = _clean_text(value)
    if not text or len(text) < min_length:
        return None
    lowered = text.lower()
    job_terms = (
        "responsibilities",
        "requirements",
        "qualifications",
        "about the role",
        "you will",
        "we are looking",
        "experience",
        "skills",
        "build",
        "manage",
        "develop",
        "design",
        "portfolio",
        "role owns",
    )
    if not any(term in lowered for term in job_terms):
        return None
    return text


def _first_location_like(text: str | None) -> str | None:
    if not text:
        return None
    parts = [part.strip() for part in re.split(r"[\n|•]+", text) if part.strip()]
    for part in parts:
        lowered = part.lower()
        if "remote" in lowered:
            return part
        if re.search(r"\b[A-Z][a-zA-Z .'-]+,\s*[A-Z]{2}\b", part):
            return part
    return None


def _location_from_json_ld(posting: dict[str, Any]) -> str | None:
    location = _first_value(posting.get("jobLocation"))
    if not isinstance(location, dict):
        return None
    address = _first_value(location.get("address"))
    if isinstance(address, str):
        return address.strip() or None
    if not isinstance(address, dict):
        return _as_text(_first_value(location.get("name")))
    parts = [
        _as_text(_first_value(address.get(key)))
        for key in ("addressLocality", "addressRegion", "addressCountry")
    ]
    return ", ".join(part for part in parts if part) or None


def _work_arrangement_from_text(text: str | None) -> WorkArrangement | None:
    if not text:
        return None
    lowered = text.lower()
    if "hybrid" in lowered:
        return WorkArrangement.HYBRID
    if "remote" in lowered or "work from home" in lowered or "telecommute" in lowered:
        return WorkArrangement.REMOTE
    if "onsite" in lowered or "on-site" in lowered or "in office" in lowered:
        return WorkArrangement.ONSITE
    return None


def _employment_type_from_text(text: str | None) -> EmploymentType | None:
    if not text:
        return None
    lowered = text.lower().replace("-", "_").replace(" ", "_")
    if "full_time" in lowered or "fulltime" in lowered:
        return EmploymentType.FULL_TIME
    if "part_time" in lowered or "parttime" in lowered:
        return EmploymentType.PART_TIME
    if "intern" in lowered:
        return EmploymentType.INTERNSHIP
    if "temporary" in lowered or "temp" in lowered:
        return EmploymentType.TEMPORARY
    if "contract" in lowered or "contractor" in lowered:
        return EmploymentType.CONTRACT
    return None


def _salary_from_json_ld(value: Any) -> ExtractedSalary:
    salary: ExtractedSalary = {
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
        "salary_period": None,
    }
    if not isinstance(value, dict):
        return salary
    currency = _as_text(_first_value(value.get("currency")))
    if currency and len(currency) == 3:
        salary["salary_currency"] = currency.upper()
    salary_value = _first_value(value.get("value"))
    if isinstance(salary_value, dict):
        salary["salary_min"] = _decimal(
            _first_value(salary_value.get("minValue"))
            or _first_value(salary_value.get("value"))
        )
        salary["salary_max"] = _decimal(
            _first_value(salary_value.get("maxValue"))
            or _first_value(salary_value.get("value"))
        )
        salary["salary_period"] = _salary_period(
            _as_text(_first_value(salary_value.get("unitText")))
        )
    else:
        amount = _decimal(salary_value)
        salary["salary_min"] = amount
        salary["salary_max"] = amount
    return salary


def _decimal(value: Any) -> Decimal | None:
    text = _as_text(value)
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _salary_period(value: str | None) -> SalaryPeriod | None:
    if not value:
        return None
    lowered = value.lower()
    if lowered in {"hour", "hourly", "h"}:
        return SalaryPeriod.HOURLY
    if lowered in {"month", "monthly"}:
        return SalaryPeriod.MONTHLY
    if lowered in {"year", "yearly", "annual", "annually"}:
        return SalaryPeriod.YEARLY
    return None


def _warnings_for(
    fields: JobPostingAutofillFields, existing: list[str], skipped: list[str]
) -> list[str]:
    dumped = fields.model_dump(exclude_none=True)
    warnings = list(dict.fromkeys(existing))
    if not dumped:
        warnings.append(
            "We could not find high-confidence job details on this page. You can still fill the form manually."
        )
        return warnings
    if skipped:
        warnings.append(
            "Some low-confidence guesses were skipped instead of autofilled."
        )
    if not fields.job_title:
        warnings.append("We could not confidently find the job title.")
    if not fields.company_name:
        warnings.append("We could not confidently find the company name.")
    if not fields.location:
        warnings.append("We could not confidently find the location.")
    if not fields.job_description:
        warnings.append("We could not find a readable job description.")
    return warnings


def _limited(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None
    return value[:max_length]
