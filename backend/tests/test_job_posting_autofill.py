from collections.abc import Callable

import pytest

from app.api.routes import applications
from app.models.user import User
from app.services.job_posting_autofill_service import JobPostingAutofillService


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
