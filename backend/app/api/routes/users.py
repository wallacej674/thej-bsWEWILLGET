from fastapi import APIRouter, Response, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.core.auth import get_authx
from app.schemas.user import AccountExport, CurrentUserResponse, DeleteAccountRequest
from app.services.account_data import delete_account, export_account

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(current_user: CurrentUser) -> CurrentUserResponse:
    return CurrentUserResponse.from_user(current_user)


@router.get("/me/export", response_model=AccountExport)
def get_account_export(
    current_user: CurrentUser, session: DatabaseSession
) -> AccountExport:
    return export_account(session, current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def remove_account(
    payload: DeleteAccountRequest, current_user: CurrentUser, session: DatabaseSession
) -> Response:
    delete_account(session, current_user.id, payload.password)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    get_authx().unset_cookies(response)
    return response
