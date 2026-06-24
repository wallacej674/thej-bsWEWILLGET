import pytest

from app.api.dependencies.ai_provider import get_ai_provider
from app.core.settings import get_settings
from app.main import app
from tests.test_resume_profile import resume_pdf_bytes


class FakeAiProvider:
    name = "fake"
    model = "resume-tailor-test"

    def tailor_resume(self, prompt):
        return {
            "match_score": 87,
            "matched_keywords": ["Python", "FastAPI", "APIs"],
            "missing_keywords": ["Azure OpenAI"],
            "suggested_summary": (
                f"Backend engineer with Python experience aligned to {prompt.job_title}."
            ),
            "suggested_bullets": [
                "Built FastAPI services with PostgreSQL-backed workflows.",
                "Implemented tested AI-ready API integrations.",
            ],
            "interview_talking_points": ["Discuss ApplyTogether architecture."],
            "caution_notes": ["Do not claim Azure OpenAI production experience."],
            "ats_warnings": prompt.ats_warnings,
        }


class MalformedAiProvider:
    name = "fake"
    model = "bad"

    def tailor_resume(self, _prompt):
        return {"match_score": 200}


@pytest.fixture
def fake_ai_provider():
    app.dependency_overrides[get_ai_provider] = lambda: FakeAiProvider()
    yield
    app.dependency_overrides.pop(get_ai_provider, None)


def create_application(api_client, workspace_id, user_id, **overrides):
    payload = {
        "company_name": "Wellfit",
        "job_title": "Associate AI Engineer",
        "job_posting_url": "https://jobs.example.test/wellfit-ai",
        "location": "Dallas, TX",
        "work_arrangement": "hybrid",
        "employment_type": "full_time",
        "job_description": "Python APIs Azure OpenAI prompt engineering testing",
    }
    payload.update(overrides)
    response = api_client.post(
        f"/api/v1/workspaces/{workspace_id}/applications",
        headers={"X-User-Id": str(user_id)},
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


def upload_resume(api_client, user_id) -> None:
    response = api_client.post(
        "/api/v1/profile/resume",
        headers={"X-User-Id": str(user_id)},
        files={"file": ("resume.pdf", resume_pdf_bytes(), "application/pdf")},
    )
    assert response.status_code == 200


def test_application_owner_can_generate_and_fetch_resume_tailor_analysis(
    api_client, active_member, shared_workspace, fake_ai_provider
) -> None:
    application = create_application(api_client, shared_workspace.id, active_member.id)
    upload_resume(api_client, active_member.id)
    path = (
        f"/api/v1/workspaces/{shared_workspace.id}/applications/"
        f"{application['id']}/ai/resume-tailor"
    )

    response = api_client.post(path, headers={"X-User-Id": str(active_member.id)})

    assert response.status_code == 200
    body = response.json()
    assert body["provider_name"] == "fake"
    assert body["model_name"] == "resume-tailor-test"
    assert body["result"]["match_score"] == 87
    assert "Azure OpenAI" in body["result"]["missing_keywords"]
    assert body["result"]["caution_notes"] == [
        "Do not claim Azure OpenAI production experience."
    ]

    fetched = api_client.get(path, headers={"X-User-Id": str(active_member.id)})
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


def test_workspace_member_cannot_generate_or_view_another_users_analysis(
    api_client, active_member, second_active_member, shared_workspace, fake_ai_provider
) -> None:
    application = create_application(api_client, shared_workspace.id, active_member.id)
    upload_resume(api_client, active_member.id)
    path = (
        f"/api/v1/workspaces/{shared_workspace.id}/applications/"
        f"{application['id']}/ai/resume-tailor"
    )

    response = api_client.post(
        path, headers={"X-User-Id": str(second_active_member.id)}
    )
    fetched = api_client.get(path, headers={"X-User-Id": str(second_active_member.id)})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "application_ownership_required"
    assert fetched.status_code == 403


def test_resume_tailor_requires_job_description_and_resume(
    api_client, active_member, shared_workspace, fake_ai_provider
) -> None:
    application = create_application(
        api_client,
        shared_workspace.id,
        active_member.id,
        job_posting_url="https://jobs.example.test/no-description",
        job_description=None,
    )
    path = (
        f"/api/v1/workspaces/{shared_workspace.id}/applications/"
        f"{application['id']}/ai/resume-tailor"
    )

    no_description = api_client.post(path, headers={"X-User-Id": str(active_member.id)})

    assert no_description.status_code == 400
    assert no_description.json()["error"]["code"] == "job_description_required"

    updated = api_client.patch(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/{application['id']}",
        headers={"X-User-Id": str(active_member.id)},
        json={"job_description": "Python APIs prompt engineering"},
    )
    assert updated.status_code == 200

    no_resume = api_client.post(path, headers={"X-User-Id": str(active_member.id)})
    assert no_resume.status_code == 400
    assert no_resume.json()["error"]["code"] == "resume_required"


def test_malformed_ai_provider_response_is_not_persisted(
    api_client, active_member, shared_workspace
) -> None:
    app.dependency_overrides[get_ai_provider] = lambda: MalformedAiProvider()
    try:
        application = create_application(
            api_client, shared_workspace.id, active_member.id
        )
        upload_resume(api_client, active_member.id)
        path = (
            f"/api/v1/workspaces/{shared_workspace.id}/applications/"
            f"{application['id']}/ai/resume-tailor"
        )

        response = api_client.post(path, headers={"X-User-Id": str(active_member.id)})

        assert response.status_code == 502
        assert response.json()["error"]["code"] == "ai_provider_invalid_response"
        fetched = api_client.get(path, headers={"X-User-Id": str(active_member.id)})
        assert fetched.status_code == 404
    finally:
        app.dependency_overrides.pop(get_ai_provider, None)


def test_resume_tailor_is_unconfigured_without_openai_key(
    api_client, active_member, shared_workspace, monkeypatch
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_settings.cache_clear()
    try:
        application = create_application(
            api_client, shared_workspace.id, active_member.id
        )
        upload_resume(api_client, active_member.id)
        path = (
            f"/api/v1/workspaces/{shared_workspace.id}/applications/"
            f"{application['id']}/ai/resume-tailor"
        )

        response = api_client.post(path, headers={"X-User-Id": str(active_member.id)})

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "ai_provider_unconfigured"
    finally:
        get_settings.cache_clear()
