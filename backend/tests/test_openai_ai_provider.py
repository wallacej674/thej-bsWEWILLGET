import json

import pytest

from app.core.errors import AppError
from app.services.ai_analysis_service import ResumeTailorPrompt
from app.services.ai_provider import (
    OpenAiResumeTailorProvider,
    estimate_tokens,
    strict_resume_tailor_schema,
)


class FakeResponses:
    def __init__(self, output_text: str | None = None, error: Exception | None = None):
        self.output_text = output_text
        self.error = error
        self.calls: list[dict[str, object]] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return type("Response", (), {"output_text": self.output_text})()


class FakeClient:
    def __init__(self, responses: FakeResponses):
        self.responses = responses


def prompt(**overrides: object) -> ResumeTailorPrompt:
    values = {
        "company_name": "Wellfit",
        "job_title": "Associate AI Engineer",
        "job_description": "Python APIs prompt engineering Azure OpenAI testing",
        "resume_text": "Experience building FastAPI services. Skills Python SQL React.",
        "ats_warnings": ["Missing common resume sections: Projects."],
    }
    values.update(overrides)
    return ResumeTailorPrompt(**values)


def valid_result() -> dict[str, object]:
    return {
        "match_score": 82,
        "matched_keywords": ["Python", "FastAPI"],
        "missing_keywords": ["Azure OpenAI"],
        "suggested_summary": "Python engineer with API experience.",
        "suggested_bullets": ["Built tested FastAPI services."],
        "interview_talking_points": ["Discuss API testing."],
        "caution_notes": ["Do not claim Azure OpenAI production experience."],
        "ats_warnings": ["Missing common resume sections: Projects."],
    }


def provider(responses: FakeResponses, max_input_tokens: int = 30_000):
    return OpenAiResumeTailorProvider(
        api_key="test-key",
        model="gpt-5.4-nano",
        max_input_tokens=max_input_tokens,
        max_output_tokens=1800,
        timeout_seconds=30,
        client=FakeClient(responses),
    )


def test_openai_provider_requests_structured_resume_tailor_output() -> None:
    responses = FakeResponses(json.dumps(valid_result()))

    result = provider(responses).tailor_resume(prompt())

    assert result["match_score"] == 82
    assert result["caution_notes"] == [
        "Do not claim Azure OpenAI production experience."
    ]
    call = responses.calls[0]
    assert call["model"] == "gpt-5.4-nano"
    assert call["max_output_tokens"] == 1800
    assert call["store"] is False
    assert call["timeout"] == 30
    assert "Candidate resume text" in str(call["input"])
    assert "Do not invent" in str(call["instructions"])
    assert "X-Y-Z framework" in str(call["instructions"])
    assert "3 to 5 ATS-friendly resume bullets" in str(call["instructions"])
    assert call["text"] == {
        "format": {
            "type": "json_schema",
            "name": "resume_tailor_result",
            "schema": strict_resume_tailor_schema(),
            "strict": True,
        }
    }


def test_openai_provider_rejects_oversized_input_before_api_call() -> None:
    responses = FakeResponses(json.dumps(valid_result()))

    with pytest.raises(AppError) as error:
        provider(responses, max_input_tokens=100).tailor_resume(
            prompt(resume_text="x" * 1000)
        )

    assert error.value.code == "ai_input_too_large"
    assert responses.calls == []


def test_openai_provider_maps_invalid_json_to_provider_error() -> None:
    responses = FakeResponses("not json")

    with pytest.raises(AppError) as error:
        provider(responses).tailor_resume(prompt())

    assert error.value.status_code == 502
    assert error.value.code == "ai_provider_invalid_response"


def test_openai_provider_maps_openai_failures_to_unavailable() -> None:
    class OpenAiLikeFailure(RuntimeError):
        __module__ = "openai._exceptions"

    responses = FakeResponses(error=OpenAiLikeFailure("timeout"))

    with pytest.raises(AppError) as error:
        provider(responses).tailor_resume(prompt())

    assert error.value.status_code == 503
    assert error.value.code == "ai_provider_unavailable"


def test_estimate_tokens_is_conservative_character_based() -> None:
    assert estimate_tokens("x" * 9) == 3
