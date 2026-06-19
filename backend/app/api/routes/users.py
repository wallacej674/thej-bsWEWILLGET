from fastapi import APIRouter

from app.api.dependencies.current_user import CurrentUser
from app.schemas.user import CurrentUserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(current_user: CurrentUser) -> CurrentUserResponse:
    return CurrentUserResponse.from_user(current_user)
