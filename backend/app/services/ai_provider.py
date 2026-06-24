import json
from math import ceil
from typing import Any, Protocol

from openai import APIError, OpenAI

from app.core.errors import AppError
from app.schemas.ai_analysis import ResumeTailorResult


class ResumeTailorPrompt(Protocol):
    company_name: str
    job_title: str
    job_description: str
    resume_text: str
    ats_warnings: list[str]


class AiProvider(Protocol):
    name: str
    model: str

    def tailor_resume(self, prompt: ResumeTailorPrompt) -> dict[str, Any]:
        """Return structured resume tailoring output."""


class UnconfiguredAiProvider:
    name = "unconfigured"
    model = "none"

    def tailor_resume(self, _prompt: ResumeTailorPrompt) -> dict[str, Any]:
        raise AppError(
            503,
            "ai_provider_unconfigured",
            "AI resume tailoring is not configured yet.",
        )


class OpenAiResumeTailorProvider:
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        max_input_tokens: int,
        max_output_tokens: int,
        timeout_seconds: int,
        client: Any | None = None,
    ) -> None:
        self.model = model
        self._max_input_tokens = max_input_tokens
        self._max_output_tokens = max_output_tokens
        self._timeout_seconds = timeout_seconds
        if client is not None:
            self._client = client
        else:
            self._client = OpenAI(api_key=api_key)

    def tailor_resume(self, prompt: ResumeTailorPrompt) -> dict[str, Any]:
        request_input = self._build_input(prompt)
        estimated_tokens = estimate_tokens(request_input)
        if estimated_tokens > self._max_input_tokens:
            raise AppError(
                413,
                "ai_input_too_large",
                "The resume and job description are too large to analyze safely.",
                {
                    "estimated_input_tokens": estimated_tokens,
                    "max_input_tokens": self._max_input_tokens,
                },
            )

        try:
            response = self._client.responses.create(
                model=self.model,
                instructions=SYSTEM_INSTRUCTIONS,
                input=request_input,
                max_output_tokens=self._max_output_tokens,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "resume_tailor_result",
                        "schema": strict_resume_tailor_schema(),
                        "strict": True,
                    }
                },
                store=False,
                timeout=self._timeout_seconds,
            )
        except APIError as error:
            raise AppError(
                503,
                "ai_provider_unavailable",
                "AI resume tailoring is temporarily unavailable.",
            ) from error
        except Exception as error:
            if error.__class__.__module__.startswith("openai"):
                raise AppError(
                    503,
                    "ai_provider_unavailable",
                    "AI resume tailoring is temporarily unavailable.",
                ) from error
            raise

        try:
            output_text = extract_response_text(response)
            parsed = json.loads(output_text)
            return ResumeTailorResult.model_validate(parsed).model_dump(mode="json")
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            raise AppError(
                502,
                "ai_provider_invalid_response",
                "The AI provider returned an invalid response.",
            ) from error

    def _build_input(self, prompt: ResumeTailorPrompt) -> str:
        ats_warnings = "\n".join(f"- {warning}" for warning in prompt.ats_warnings)
        return "\n\n".join(
            [
                f"Company: {prompt.company_name}",
                f"Job title: {prompt.job_title}",
                "ATS warnings from PDF extraction:\n"
                f"{ats_warnings or '- None reported.'}",
                "Job description:\n" + prompt.job_description,
                "Candidate resume text:\n" + prompt.resume_text,
            ]
        )


SYSTEM_INSTRUCTIONS = """You are an honest resume tailoring assistant. 
Compare the resume to the job description and return only JSON matching the schema. 
Provide every required field: match_score, matched_keywords, missing_keywords, suggested_summary, suggested_bullets, interview_talking_points, caution_notes, and ats_warnings. 
For suggested_bullets, write 3 to 5 ATS-friendly resume bullets using the X-Y-Z framework: Accomplished X, as measured by Y, by doing Z. Start each bullet with a strong capitalized action verb, include a task/project, include a measurable result in brackets like this [result%] for users to change, explain how it was done, and end complete sentences with a period. 
Do not invent experience, tools, credentials, employers, metrics, certifications, industry background, or production AI experience. 
Always include caution notes about not claiming unsupported experience."""


def estimate_tokens(text: str) -> int:
    return ceil(len(text) / 4)


def strict_resume_tailor_schema() -> dict[str, Any]:
    schema = ResumeTailorResult.model_json_schema()
    properties = schema.get("properties")
    if isinstance(properties, dict):
        schema["required"] = list(properties.keys())
    schema["additionalProperties"] = False
    return schema


def extract_response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str):
        return output_text

    output = getattr(response, "output", None)
    if isinstance(output, list):
        chunks: list[str] = []
        for item in output:
            content = getattr(item, "content", None)
            if isinstance(content, list):
                for part in content:
                    text = getattr(part, "text", None)
                    if isinstance(text, str):
                        chunks.append(text)
                    elif isinstance(part, dict) and isinstance(part.get("text"), str):
                        chunks.append(part["text"])
            elif isinstance(item, dict) and isinstance(item.get("content"), list):
                for part in item["content"]:
                    if isinstance(part, dict) and isinstance(part.get("text"), str):
                        chunks.append(part["text"])
        if chunks:
            return "".join(chunks)

    raise ValueError("OpenAI response did not include text output.")
