from uuid import UUID

from sqlalchemy import Connection, event, text
from sqlalchemy.orm import Session, SessionTransaction

_SET_INVITATION = text(
    "SELECT set_config('app.responding_invitation', :invitation_id, true)"
)
_SET_PERSONAL_EXPORT = text("SELECT set_config('app.account_data', :enabled, true)")
_SET_USER = text("SELECT set_config('app.user_id', :user_id, true)")
_SET_BOOTSTRAP = text(
    "SELECT set_config('app.bootstrap_workspace', :workspace_id, true)"
)


def set_workspace_actor(session: Session, user_id: UUID) -> None:
    value = str(user_id)
    session.info["workspace_actor"] = value
    session.execute(_SET_USER, {"user_id": value})


def allow_invitation_response(session: Session, invitation_id: UUID) -> None:
    session.execute(_SET_INVITATION, {"invitation_id": str(invitation_id)})


def allow_account_data(session: Session) -> None:
    session.execute(_SET_PERSONAL_EXPORT, {"enabled": "true"})


def allow_workspace_bootstrap(session: Session, workspace_id: UUID) -> None:
    session.execute(_SET_BOOTSTRAP, {"workspace_id": str(workspace_id)})


@event.listens_for(Session, "after_begin")
def _set_transaction_actor(
    session: Session, transaction: SessionTransaction, connection: Connection
) -> None:
    if transaction.parent is None:
        connection.execute(
            _SET_USER, {"user_id": session.info.get("workspace_actor", "")}
        )
        connection.execute(_SET_BOOTSTRAP, {"workspace_id": ""})
        connection.execute(_SET_PERSONAL_EXPORT, {"enabled": ""})
        connection.execute(_SET_INVITATION, {"invitation_id": ""})
