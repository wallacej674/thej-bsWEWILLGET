import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from sqlalchemy import delete, func, select, text

from app.core.enums import MembershipRole
from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_session_factory
from app.models.invitation import WorkspaceInvitation
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace
from app.services.workspace_service import WorkspaceService


def test_concurrent_acceptances_never_exceed_the_member_cap(
    monkeypatch,
) -> None:
    session_factory = get_session_factory()
    suffix = uuid4().hex
    workspace_id = None
    user_ids = []

    with session_factory() as setup_session:
        workspace = Workspace(name=f"Concurrent cap {suffix}")
        owner = User(
            email=f"owner-{suffix}@example.test",
            display_name="Concurrent Owner",
        )
        guests = [
            User(
                email=f"guest-{index}-{suffix}@example.test",
                display_name=f"Concurrent Guest {index}",
            )
            for index in range(2)
        ]
        setup_session.add_all([workspace, owner, *guests])
        setup_session.flush()
        setup_session.add(
            WorkspaceMembership(
                workspace_id=workspace.id,
                user_id=owner.id,
                role=MembershipRole.OWNER,
            )
        )
        invitations = [
            WorkspaceInvitation(
                workspace_id=workspace.id,
                email=guest.email,
                invited_by_user_id=owner.id,
            )
            for guest in guests
        ]
        setup_session.add_all(invitations)
        setup_session.commit()
        workspace_id = workspace.id
        user_ids = [owner.id, *(guest.id for guest in guests)]
        invitation_and_user_ids = [
            (invitation.id, guest.id)
            for invitation, guest in zip(invitations, guests, strict=True)
        ]

    monkeypatch.setattr(get_settings(), "workspace_member_cap", 2)
    worker_prefix = f"cap-test-{suffix}"

    def accept(invitation_id, user_id, worker_number: int) -> str:
        with session_factory() as worker_session:
            worker_session.execute(
                text("SELECT set_config('application_name', :name, true)"),
                {"name": f"{worker_prefix}-{worker_number}"},
            )
            user = worker_session.get(User, user_id)
            assert user is not None
            try:
                WorkspaceService().accept_invitation(
                    worker_session, invitation_id, user
                )
            except AppError as error:
                worker_session.rollback()
                return error.code
            return "accepted"

    try:
        with session_factory() as blocker_session:
            blocker_session.execute(
                text("LOCK TABLE workspace_memberships IN SHARE MODE")
            )
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [
                    executor.submit(accept, invitation_id, user_id, index)
                    for index, (invitation_id, user_id) in enumerate(
                        invitation_and_user_ids
                    )
                ]

                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    with session_factory() as observer_session:
                        waiting = observer_session.scalar(
                            text(
                                """
                                SELECT count(*)
                                FROM pg_stat_activity
                                WHERE application_name LIKE :prefix
                                  AND wait_event_type = 'Lock'
                                """
                            ),
                            {"prefix": f"{worker_prefix}%"},
                        )
                    if waiting == 2:
                        break
                    time.sleep(0.01)
                else:
                    raise AssertionError(
                        "Concurrent acceptance requests did not reach the lock point."
                    )

                blocker_session.commit()
                outcomes = sorted(future.result(timeout=10) for future in futures)

        with session_factory() as verification_session:
            active_members = verification_session.scalar(
                select(func.count())
                .select_from(WorkspaceMembership)
                .where(
                    WorkspaceMembership.workspace_id == workspace_id,
                    WorkspaceMembership.removed_at.is_(None),
                )
            )

        assert outcomes == ["accepted", "workspace_member_cap_reached"]
        assert active_members == 2
    finally:
        with session_factory() as cleanup_session:
            cleanup_session.execute(
                delete(WorkspaceInvitation).where(
                    WorkspaceInvitation.workspace_id == workspace_id
                )
            )
            cleanup_session.execute(
                delete(WorkspaceMembership).where(
                    WorkspaceMembership.workspace_id == workspace_id
                )
            )
            cleanup_session.execute(delete(User).where(User.id.in_(user_ids)))
            cleanup_session.execute(
                delete(Workspace).where(Workspace.id == workspace_id)
            )
            cleanup_session.commit()
