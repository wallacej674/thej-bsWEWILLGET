from __future__ import annotations

import html as html_lib
import ipaddress
import json
import re
import socket
from collections.abc import Callable, Iterable
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, TypedDict
from urllib.parse import urlparse

import httpx

from app.core.enums import EmploymentType, SalaryPeriod, WorkArrangement
from app.core.errors import AppError
from app.core.url_normalization import normalize_job_posting_url
from app.schemas.application import (
    JobPostingAutofillFields,
    JobPostingAutofillResponse,
)

MAX_FETCH_BYTES = 1_000_000
MAX_DESCRIPTION_CHARS = 20_000
FETCH_TIMEOUT_SECONDS = 8
USER_AGENT = "ApplyTogetherJobAutofill/1.0"
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain"}


class ExtractedSalary(TypedDict):
    salary_min: Decimal | None
    salary_max: Decimal | None
    salary_currency: str | None
    salary_period: SalaryPeriod | None


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
        html = self._fetcher(normalized_url)
        structured = _extract_json_ld_job_posting(html)
        source: Literal["json_ld", "html", "none"]
        if structured is not None:
            fields = _fields_from_job_posting(structured)
            source = "json_ld"
        else:
            fields = _fields_from_html(html)
            source = "html" if fields.model_dump(exclude_none=True) else "none"

        warnings = _warnings_for(fields)
        return JobPostingAutofillResponse(
            fields=fields,
            source=source,
            warnings=warnings,
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


def _extract_json_ld_job_posting(document: str) -> dict[str, Any] | None:
    for script_body in _json_ld_script_bodies(document):
        try:
            payload = json.loads(html_lib.unescape(script_body))
        except json.JSONDecodeError:
            continue
        posting = _find_job_posting(payload)
        if posting is not None:
            return posting
    return None


def _json_ld_script_bodies(document: str) -> Iterable[str]:
    script_pattern = re.compile(r"<script\b(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.I | re.S)
    for match in script_pattern.finditer(document):
        attrs = match.group("attrs")
        if "ld+json" in attrs.lower():
            yield match.group("body").strip()


def _find_job_posting(payload: Any) -> dict[str, Any] | None:
    if isinstance(payload, list):
        for item in payload:
            found = _find_job_posting(item)
            if found is not None:
                return found
        return None
    if not isinstance(payload, dict):
        return None
    item_type = payload.get("@type")
    types = item_type if isinstance(item_type, list) else [item_type]
    if any(str(candidate).lower() == "jobposting" for candidate in types):
        return payload
    graph = payload.get("@graph")
    if graph is not None:
        return _find_job_posting(graph)
    return None


def _fields_from_job_posting(posting: dict[str, Any]) -> JobPostingAutofillFields:
    description = _clean_text(_as_text(posting.get("description")))
    organization = posting.get("hiringOrganization")
    organization_name = (
        _as_text(organization.get("name")) if isinstance(organization, dict) else None
    )
    salary = _salary_from_json_ld(posting.get("baseSalary"))
    location = _location_from_json_ld(posting)
    work_arrangement = _work_arrangement_from_json_ld(posting, description)
    employment_type = _employment_type_from_text(_as_text(posting.get("employmentType")))
    if employment_type is None:
        employment_type = _employment_type_from_text(description)

    return JobPostingAutofillFields(
        company_name=_limited(organization_name, 200),
        job_title=_limited(_as_text(posting.get("title")), 200),
        location=_limited(location, 200),
        work_arrangement=work_arrangement,
        employment_type=employment_type,
        salary_min=salary.get("salary_min"),
        salary_max=salary.get("salary_max"),
        salary_currency=salary.get("salary_currency"),
        salary_period=salary.get("salary_period"),
        job_description=_limited(description, MAX_DESCRIPTION_CHARS),
    )


def _fields_from_html(document: str) -> JobPostingAutofillFields:
    metadata = _metadata(document)
    title = metadata.get("og:title") or _tag_text(document, "h1") or _tag_text(document, "title")
    job_title, company_name = _split_title_and_company(title)
    company_name = company_name or metadata.get("og:site_name")
    description = _clean_text(
        metadata.get("description")
        or metadata.get("og:description")
        or _visible_text(document)
    )
    combined = " ".join(part for part in (title, description) if part)

    return JobPostingAutofillFields(
        company_name=_limited(company_name, 200),
        job_title=_limited(job_title, 200),
        work_arrangement=_work_arrangement_from_text(combined),
        employment_type=_employment_type_from_text(combined),
        job_description=_limited(description, MAX_DESCRIPTION_CHARS),
    )


def _metadata(document: str) -> dict[str, str]:
    values: dict[str, str] = {}
    meta_pattern = re.compile(r"<meta\b(?P<attrs>[^>]*)>", re.I | re.S)
    attr_pattern = re.compile(r"""([:\w-]+)\s*=\s*["']([^"']*)["']""", re.I)
    for match in meta_pattern.finditer(document):
        attrs = {
            key.lower(): html_lib.unescape(value).strip()
            for key, value in attr_pattern.findall(match.group("attrs"))
        }
        content = attrs.get("content")
        key = attrs.get("property") or attrs.get("name")
        if key and content:
            values[key.lower()] = content
    return values


def _tag_text(document: str, tag_name: str) -> str | None:
    match = re.search(
        rf"<{tag_name}\b[^>]*>(?P<body>.*?)</{tag_name}>",
        document,
        re.I | re.S,
    )
    return _clean_text(match.group("body")) if match else None


def _visible_text(document: str) -> str:
    document = re.sub(r"<(script|style)\b.*?</\1>", " ", document, flags=re.I | re.S)
    return _clean_text(document) or ""


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    without_tags = re.sub(r"<[^>]+>", " ", value)
    text = html_lib.unescape(without_tags)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def _as_text(value: Any) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    if isinstance(value, list):
        return " ".join(part for item in value if (part := _as_text(item)))
    return None


def _split_title_and_company(title: str | None) -> tuple[str | None, str | None]:
    if not title:
        return None, None
    separators = (r"\s+at\s+", r"\s+\|\s+", r"\s+-\s+")
    for separator in separators:
        parts = re.split(separator, title, maxsplit=1, flags=re.I)
        if len(parts) == 2:
            return parts[0].strip(), parts[1].strip()
    return title.strip(), None


def _location_from_json_ld(posting: dict[str, Any]) -> str | None:
    location = posting.get("jobLocation")
    if isinstance(location, list):
        location = location[0] if location else None
    if not isinstance(location, dict):
        return None
    address = location.get("address")
    if isinstance(address, str):
        return address.strip() or None
    if not isinstance(address, dict):
        return _as_text(location.get("name"))
    parts = [
        _as_text(address.get(key))
        for key in ("addressLocality", "addressRegion", "addressCountry")
    ]
    return ", ".join(part for part in parts if part) or None


def _work_arrangement_from_json_ld(
    posting: dict[str, Any], description: str | None
) -> WorkArrangement | None:
    location_type = _as_text(posting.get("jobLocationType"))
    if location_type and "telecommute" in location_type.lower():
        return WorkArrangement.REMOTE
    return _work_arrangement_from_text(description)


def _work_arrangement_from_text(text: str | None) -> WorkArrangement | None:
    if not text:
        return None
    lowered = text.lower()
    if "hybrid" in lowered:
        return WorkArrangement.HYBRID
    if "remote" in lowered or "work from home" in lowered:
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
    currency = _as_text(value.get("currency"))
    if currency and len(currency) == 3:
        salary["salary_currency"] = currency.upper()
    salary_value = value.get("value")
    if isinstance(salary_value, dict):
        salary["salary_min"] = _decimal(salary_value.get("minValue") or salary_value.get("value"))
        salary["salary_max"] = _decimal(salary_value.get("maxValue") or salary_value.get("value"))
        salary["salary_period"] = _salary_period(_as_text(salary_value.get("unitText")))
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


def _warnings_for(fields: JobPostingAutofillFields) -> list[str]:
    dumped = fields.model_dump(exclude_none=True)
    warnings: list[str] = []
    if not dumped:
        return ["We could not find job details on this page. You can still fill the form manually."]
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
