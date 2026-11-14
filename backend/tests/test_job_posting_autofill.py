import asyncio
import gzip
import ipaddress
import socket
import zlib
from collections.abc import AsyncIterator, Callable

import httpx
import pytest

from app.api.routes import applications
from app.models.user import User
from app.services import job_posting_autofill_service as autofill
from app.services.job_posting_autofill_service import (
    MAX_FETCH_BYTES,
    JobPostingAutofillService,
)

PUBLIC_IP = "93.184.216.34"
OTHER_PUBLIC_IP = "2606:4700::1111"
PUBLIC_URL = "https://jobs.example.test/openings/old"


@pytest.fixture(autouse=True)
def restore_autofill_service() -> None:
    original = applications.job_posting_autofill_service
    yield
    applications.job_posting_autofill_service = original


def _install_fetcher(fetcher: Callable[[str], str]) -> None:
    applications.job_posting_autofill_service = JobPostingAutofillService(fetcher)


def test_autofill_extracts_schema_org_job_posting(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Backend Engineer",
            "description": "<p>Build APIs with Python and PostgreSQL.</p>",
            "employmentType": "FULL_TIME",
            "jobLocationType": "TELECOMMUTE",
            "hiringOrganization": {"name": "Acme Health"},
            "jobLocation": {
              "address": {
                "addressLocality": "Austin",
                "addressRegion": "TX",
                "addressCountry": "US"
              }
            },
            "baseSalary": {
              "currency": "USD",
              "value": {
                "minValue": 110000,
                "maxValue": 140000,
                "unitText": "YEAR"
              }
            }
          }
          </script>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://jobs.example.test/backend"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "json_ld"
    assert body["fields"] == {
        "company_name": "Acme Health",
        "job_title": "Senior Backend Engineer",
        "location": "Austin, TX, US",
        "work_arrangement": "remote",
        "employment_type": "full_time",
        "salary_min": "110000",
        "salary_max": "140000",
        "salary_currency": "USD",
        "salary_period": "yearly",
        "job_description": "Build APIs with Python and PostgreSQL.",
    }
    assert body["warnings"] == []


def test_autofill_extracts_microdata_job_posting(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <body itemscope itemtype="https://schema.org/JobPosting">
            <h1 itemprop="title">Operations Manager</h1>
            <div itemprop="hiringOrganization" itemscope itemtype="https://schema.org/Organization">
              <span itemprop="name">Maple Systems</span>
            </div>
            <div itemprop="jobLocation" itemscope itemtype="https://schema.org/Place">
              <div itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
                <span itemprop="addressLocality">Chicago</span>
                <span itemprop="addressRegion">IL</span>
                <span itemprop="addressCountry">US</span>
              </div>
            </div>
            <meta itemprop="employmentType" content="FULL_TIME" />
            <section itemprop="description">
              <p>Responsibilities include managing fulfillment workflows and improving
              vendor operations across multiple teams.</p>
            </section>
          </body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://jobs.example.test/ops"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "json_ld"
    assert body["fields"]["company_name"] == "Maple Systems"
    assert body["fields"]["job_title"] == "Operations Manager"
    assert body["fields"]["location"] == "Chicago, IL, US"
    assert body["fields"]["employment_type"] == "full_time"
    assert "Responsibilities include managing" in body["fields"]["job_description"]


def test_autofill_uses_html_metadata_when_structured_data_is_missing(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <head>
            <meta property="og:title" content="Product Designer at Northstar Labs" />
            <meta property="og:site_name" content="Northstar Labs" />
            <meta name="description" content="Hybrid contract role in Denver, CO." />
          </head>
          <body>
            <h1>Product Designer</h1>
            <main>Hybrid contract role in Denver, CO. Portfolio required.</main>
          </body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://jobs.example.test/designer"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "html"
    assert body["fields"]["company_name"] == "Northstar Labs"
    assert body["fields"]["job_title"] == "Product Designer"
    assert body["fields"]["work_arrangement"] == "hybrid"
    assert body["fields"]["employment_type"] == "contract"
    assert "job_description" not in body["fields"]


def test_autofill_extracts_greenhouse_page_with_high_confidence(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <head><title>Job Application for Platform Engineer at Fern Labs</title></head>
          <body>
            <h1>Platform Engineer</h1>
            <div class="company-name">Fern Labs</div>
            <div class="location">New York, NY</div>
            <div id="content">
              <p>About the role</p>
              <p>Build reliable Python services and internal tooling.</p>
              <p>Responsibilities include API design, testing, and operations.</p>
            </div>
          </body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://boards.greenhouse.io/fernlabs/jobs/123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "greenhouse"
    assert body["fields"]["company_name"] == "Fern Labs"
    assert body["fields"]["job_title"] == "Platform Engineer"
    assert body["fields"]["location"] == "New York, NY"
    assert "Build reliable Python services" in body["fields"]["job_description"]
    assert body["field_sources"]["job_title"] == "ats"


def test_autofill_extracts_lever_page_without_reversing_company_and_title(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <head><title>Rivet AI - Machine Learning Engineer</title></head>
          <body>
            <div class="posting-headline">
              <h2>Machine Learning Engineer</h2>
              <div class="posting-categories">
                <span>San Francisco, CA</span>
                <span>Engineering</span>
                <span>Full-time</span>
              </div>
            </div>
            <div class="main-header-logo"><img alt="Rivet AI"></div>
            <div data-qa="job-description">
              We build production ML systems for healthcare teams. This role owns APIs,
              model evaluation, and deployment workflows.
            </div>
          </body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://jobs.lever.co/rivetai/abc"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "lever"
    assert body["fields"]["company_name"] == "Rivet AI"
    assert body["fields"]["job_title"] == "Machine Learning Engineer"
    assert body["fields"]["employment_type"] == "full_time"


def test_autofill_extracts_ashby_page_from_embedded_job_data(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <body>
            <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "jobPosting": {
                    "title": "Frontend Engineer",
                    "companyName": "Canopy Works",
                    "locationName": "Remote - US",
                    "employmentType": "Full-time",
                    "descriptionHtml": "<p>Own React workflows and product polish across the app.</p>"
                  }
                }
              }
            }
            </script>
          </body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://jobs.ashbyhq.com/canopy/123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ashby"
    assert body["fields"]["company_name"] == "Canopy Works"
    assert body["fields"]["job_title"] == "Frontend Engineer"
    assert body["fields"]["work_arrangement"] == "remote"


def test_autofill_uses_main_content_fallback_for_generic_company_page(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <head>
            <title>Backend Developer at Harbor Tools</title>
          </head>
          <body>
            <nav>Careers Home Search Open Roles</nav>
            <main>
              <h1>Backend Developer</h1>
              <p>About the role</p>
              <p>You will develop APIs, improve PostgreSQL workflows, and build
              reliable integrations for customer operations teams.</p>
              <p>Requirements include Python experience, testing habits, and strong
              collaboration skills.</p>
            </main>
          </body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://harbortools.example.test/jobs/backend"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "html"
    assert body["fields"]["company_name"] == "Harbor Tools"
    assert body["fields"]["job_title"] == "Backend Developer"
    assert "You will develop APIs" in body["fields"]["job_description"]


def test_autofill_workday_best_effort_warns_when_page_is_javascript_shell(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <head><title>Careers</title></head>
          <body><div id="root"></div><script src="/wday/app.js"></script></body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://acme.wd1.myworkdayjobs.com/jobs/job/123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "workday"
    assert body["fields"] == {}
    assert "Workday" in " ".join(body["warnings"])


def test_autofill_ignores_job_board_site_name_and_short_meta_description(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: (
            """
        <html>
          <head>
            <meta property="og:title" content="Data Analyst - LinkedIn" />
            <meta property="og:site_name" content="LinkedIn" />
            <meta name="description" content="View this job on LinkedIn." />
          </head>
          <body><h1>Data Analyst</h1></body>
        </html>
        """
        )
    )

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://www.linkedin.com/jobs/view/123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["fields"].get("job_title") == "Data Analyst"
    assert "company_name" not in body["fields"]
    assert "job_description" not in body["fields"]


def test_autofill_rejects_localhost_before_fetching(
    api_client, active_member, shared_workspace
) -> None:
    called = False

    def fetcher(_url: str) -> str:
        nonlocal called
        called = True
        return "<html></html>"

    _install_fetcher(fetcher)

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "http://127.0.0.1:8000/internal"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "job_posting_url_not_allowed"
    assert called is False


def test_autofill_requires_workspace_access(
    api_client, database_session, shared_workspace
) -> None:
    outsider = User(email="outsider@example.test", display_name="Outsider")
    database_session.add(outsider)
    database_session.flush()

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(outsider.id)},
        json={"job_posting_url": "https://jobs.example.test/backend"},
    )

    assert response.status_code == 403


def test_autofill_does_not_create_an_application(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(lambda _url: "<html><h1>Backend Engineer</h1></html>")

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_posting_url": "https://jobs.example.test/backend-empty"},
    )

    assert response.status_code == 200

    list_response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(active_member.id)},
    )
    assert list_response.status_code == 200
    assert list_response.json()["items"] == []


class RecordingStream(httpx.AsyncByteStream):
    def __init__(self, *chunks: bytes) -> None:
        self.chunks = chunks
        self.read_count = 0
        self.closed = False

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            self.read_count += 1
            yield chunk

    async def aclose(self) -> None:
        self.closed = True


@pytest.fixture
def mock_fetch_network(monkeypatch):
    def install(
        handler: Callable[[httpx.Request], httpx.Response],
        resolve: Callable[[str], list[str]] | None = None,
    ) -> tuple[list[str], list[httpx.Request]]:
        lookups: list[str] = []
        requests: list[httpx.Request] = []

        def getaddrinfo(
            host: str, port: int, _family: int, type: int, _proto: int, _flags: int
        ) -> list[tuple]:
            lookups.append(host)
            addresses = resolve(host) if resolve is not None else [PUBLIC_IP]
            return [
                (socket.AF_INET6, type, socket.IPPROTO_TCP, "", (address, port, 0, 0))
                if ipaddress.ip_address(address).version == 6
                else (socket.AF_INET, type, socket.IPPROTO_TCP, "", (address, port))
                for address in addresses
            ]

        async def send(_transport: object, request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return handler(request)

        monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)
        monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", send)
        return lookups, requests

    return install


@pytest.fixture
def autofill_request(api_client, active_member, shared_workspace):
    def post(url: str = PUBLIC_URL) -> httpx.Response:
        return api_client.post(
            f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill",
            headers={"X-User-Id": str(active_member.id)},
            json={"job_posting_url": url},
        )

    return post


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "169.254.169.254", "10.0.0.1", "100.64.0.1", "redirect.example.test"],
)
def test_autofill_blocks_private_redirect_before_connecting(
    host, autofill_request, mock_fetch_network
) -> None:
    redirect_body = RecordingStream(b"unused")
    lookups, requests = mock_fetch_network(
        lambda _request: httpx.Response(
            302, headers={"location": f"http://{host}/internal"}, stream=redirect_body
        ),
        lambda name: ["10.0.0.1"] if name == "redirect.example.test" else [PUBLIC_IP],
    )

    response = autofill_request()

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "job_posting_url_not_allowed"
    assert lookups[0] == "jobs.example.test"
    assert lookups[1:] == ([host] if host == "redirect.example.test" else [])
    assert [request.url.host for request in requests] == [PUBLIC_IP]
    assert redirect_body.read_count == 0
    assert redirect_body.closed


def test_autofill_pins_connection_against_dns_rebinding(
    autofill_request, mock_fetch_network
) -> None:
    answers = iter([[PUBLIC_IP], ["127.0.0.1"]])
    lookups, requests = mock_fetch_network(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "text/html"},
            stream=RecordingStream(b"<html><h1>Backend Engineer</h1></html>"),
        ),
        lambda _host: next(answers),
    )

    assert autofill_request().status_code == 200
    assert lookups == ["jobs.example.test"]
    assert len(requests) == 1
    assert requests[0].url.host == PUBLIC_IP
    assert requests[0].headers["host"] == "jobs.example.test"
    assert requests[0].extensions["sni_hostname"] == "jobs.example.test"


@pytest.mark.parametrize("port", [0, 22, 6379])
def test_autofill_blocks_disallowed_ports(
    port, autofill_request, mock_fetch_network
) -> None:
    lookups, requests = mock_fetch_network(lambda _request: httpx.Response(200))

    response = autofill_request(f"https://jobs.example.test:{port}/opening")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "job_posting_url_not_allowed"
    assert lookups == requests == []


@pytest.mark.parametrize(
    "private_answer",
    [
        "::ffff:127.0.0.1",
        "2002:7f00:1::",
        "2001:0:7f00:0001::ffff:fffe",
        "64:ff9b::7f00:1",
    ],
)
def test_autofill_blocks_mixed_dns_answers_with_embedded_private_addresses(
    private_answer, autofill_request, mock_fetch_network
) -> None:
    _, requests = mock_fetch_network(
        lambda _request: httpx.Response(200), lambda _host: [PUBLIC_IP, private_answer]
    )

    response = autofill_request()

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "job_posting_url_not_allowed"
    assert requests == []


@pytest.mark.parametrize(
    ("encoding", "encode"),
    [("identity", bytes), ("gzip", gzip.compress), ("deflate", zlib.compress)],
)
def test_autofill_aborts_oversize_body_mid_stream(
    encoding, encode, autofill_request, mock_fetch_network
) -> None:
    body = b"x" * (MAX_FETCH_BYTES + 1)
    encoded = encode(body)
    halfway = len(encoded) // 2
    stream = RecordingStream(encoded[:halfway], encoded[halfway:], b"unused")
    mock_fetch_network(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "text/html", "content-encoding": encoding},
            stream=stream,
        )
    )

    response = autofill_request()

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "job_posting_response_too_large"
    assert stream.read_count == 2
    assert stream.closed


@pytest.mark.parametrize(
    ("headers", "status", "code"),
    [
        ({}, 415, "job_posting_content_type_unsupported"),
        (
            {"content-type": "text/html-extra"},
            415,
            "job_posting_content_type_unsupported",
        ),
        (
            {"content-type": "text/html", "content-length": str(MAX_FETCH_BYTES + 1)},
            413,
            "job_posting_response_too_large",
        ),
    ],
)
def test_autofill_rejects_bad_headers_before_reading_body(
    headers, status, code, autofill_request, mock_fetch_network
) -> None:
    stream = RecordingStream(b"unused")
    mock_fetch_network(
        lambda _request: httpx.Response(200, headers=headers, stream=stream)
    )

    response = autofill_request()

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert stream.read_count == 0
    assert stream.closed


@pytest.mark.parametrize(
    ("encoding", "encode"),
    [
        ("gzip", lambda body: gzip.compress(body) + gzip.compress(b"")),
        ("deflate", zlib.compress),
        ("deflate", lambda body: zlib.compress(body, wbits=-zlib.MAX_WBITS)),
    ],
)
def test_autofill_resolves_public_redirects_against_the_original_origin(
    encoding, encode, autofill_request, mock_fetch_network
) -> None:
    document = b"<html><h1>Backend Engineer</h1></html>"
    encoded = encode(document)
    responses = iter(
        [
            httpx.Response(302, headers={"location": "../new"}),
            httpx.Response(
                307, headers={"location": "https://careers.example.test/new"}
            ),
            httpx.Response(
                200,
                headers={
                    "content-type": "application/xhtml+xml; charset=UTF-8",
                    "content-encoding": encoding,
                },
                stream=RecordingStream(encoded[:1], encoded[1:]),
            ),
        ]
    )
    lookups, requests = mock_fetch_network(
        lambda _request: next(responses),
        lambda host: (
            [OTHER_PUBLIC_IP] if host == "careers.example.test" else [PUBLIC_IP]
        ),
    )

    response = autofill_request()

    assert response.status_code == 200
    assert response.json()["fields"]["job_title"] == "Backend Engineer"
    assert lookups == ["jobs.example.test", "jobs.example.test", "careers.example.test"]
    assert [request.url.host for request in requests] == [
        PUBLIC_IP,
        PUBLIC_IP,
        OTHER_PUBLIC_IP,
    ]
    assert [request.url.path for request in requests] == [
        "/openings/old",
        "/new",
        "/new",
    ]
    assert [request.extensions["sni_hostname"] for request in requests] == lookups


def test_autofill_limits_redirects_to_three(
    autofill_request, mock_fetch_network
) -> None:
    _, requests = mock_fetch_network(
        lambda _request: httpx.Response(302, headers={"location": "/another"})
    )

    response = autofill_request()

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "job_posting_fetch_failed"
    assert len(requests) == 4


def test_autofill_deadline_is_shared_across_redirects_and_body(
    monkeypatch, autofill_request, mock_fetch_network
) -> None:
    scopes: list[asyncio.Timeout] = []
    timeout = asyncio.timeout

    def record_timeout(delay: float | None) -> asyncio.Timeout:
        scope = timeout(delay)
        if delay == autofill.FETCH_TIMEOUT_SECONDS:
            scopes.append(scope)
        return scope

    class SlowStream(RecordingStream):
        async def __aiter__(self) -> AsyncIterator[bytes]:
            assert scopes[0].when() == hop_deadlines[0] == hop_deadlines[1]
            scopes[0].reschedule(asyncio.get_running_loop().time())
            await asyncio.sleep(0)
            yield b"<html></html>"

    stream = SlowStream()
    monkeypatch.setattr(asyncio, "timeout", record_timeout)
    responses = iter(
        [
            httpx.Response(302, headers={"location": "/another"}),
            httpx.Response(200, headers={"content-type": "text/html"}, stream=stream),
        ]
    )
    hop_deadlines: list[float | None] = []

    def send(_request: httpx.Request) -> httpx.Response:
        hop_deadlines.append(scopes[0].when())
        return next(responses)

    _, requests = mock_fetch_network(send)

    response = autofill_request()

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "job_posting_fetch_timeout"
    assert len(requests) == 2
    assert len(scopes) == 1
    assert stream.closed
