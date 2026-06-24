from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.ai_analysis import ApplicationAiAnalysis


class ResumeTailorResult(BaseModel):
    match_score: int = Field(ge=0, le=100)
    matched_keywords: list[str] = Field(default_factory=list, max_length=30)
    missing_keywords: list[str] = Field(default_factory=list, max_length=30)
    suggested_summary: str = Field(min_length=1, max_length=1600)
    suggested_bullets: list[str] = Field(min_length=1, max_length=10)
    interview_talking_points: list[str] = Field(default_factory=list, max_length=10)
    caution_notes: list[str] = Field(default_factory=list, max_length=10)
    ats_warnings: list[str] = Field(default_factory=list, max_length=10)

    @field_validator(
        "matched_keywords",
        "missing_keywords",
        "suggested_bullets",
        "interview_talking_points",
        "caution_notes",
        "ats_warnings",
    )
    @classmethod
    def trim_items(cls, values: list[str]) -> list[str]:
        return [value.strip() for value in values if value.strip()]


class ResumeTailorAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID
    prompt_version: str
    provider_name: str
    model_name: str
    result: ResumeTailorResult
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_analysis(
        cls, analysis: ApplicationAiAnalysis
    ) -> "ResumeTailorAnalysisResponse":
        return cls(
            id=analysis.id,
            application_id=analysis.application_id,
            prompt_version=analysis.prompt_version,
            provider_name=analysis.provider_name,
            model_name=analysis.model_name,
            result=ResumeTailorResult.model_validate(analysis.result),
            created_at=analysis.created_at,
            updated_at=analysis.updated_at,
        )
