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
        lambda _url: """
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


def test_autofill_uses_html_metadata_when_structured_data_is_missing(
    api_client, active_member, shared_workspace
) -> None:
    _install_fetcher(
        lambda _url: """
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
    assert "Hybrid contract role in Denver, CO." in body["fields"]["job_description"]


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
