from typing import Annotated

from fastapi import Depends

from app.core.settings import get_settings
from app.services.ai_provider import (
    AiProvider,
    OpenAiResumeTailorProvider,
    UnconfiguredAiProvider,
)


def get_ai_provider() -> AiProvider:
    settings = get_settings()
    if settings.openai_api_key:
        return OpenAiResumeTailorProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_resume_tailor_model,
            max_input_tokens=settings.openai_resume_tailor_max_input_tokens,
            max_output_tokens=settings.openai_resume_tailor_max_output_tokens,
            timeout_seconds=settings.openai_resume_tailor_timeout_seconds,
        )
    return UnconfiguredAiProvider()


AiProviderDependency = Annotated[AiProvider, Depends(get_ai_provider)]
