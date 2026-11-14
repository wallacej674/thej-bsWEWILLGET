from contextlib import contextmanager

from sqlalchemy import text

from app.core.settings import get_settings
from app.db.row_security import set_workspace_actor
from tests.test_ai_resume_tailor import create_application


@contextmanager
def runtime_role(session):
    session.execute(text("CREATE ROLE applytogether_rls_test NOLOGIN NOBYPASSRLS"))
    session.execute(text("GRANT USAGE ON SCHEMA public TO applytogether_rls_test"))
    session.execute(
        text(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO applytogether_rls_test"
        )
    )
    session.execute(
        text("""
        GRANT EXECUTE ON FUNCTION
            public.applytogether_workspace_actor(),
            public.applytogether_workspace_role(uuid),
            public.applytogether_invitee(text),
            public.applytogether_can_join(uuid),
            public.applytogether_active_member_count(uuid)
        TO applytogether_rls_test
    """)
    )
    session.execute(text("SET LOCAL ROLE applytogether_rls_test"))
    try:
        yield
    finally:
        session.execute(text("RESET ROLE"))


def test_runtime_role_cannot_read_another_workspaces_application(
    api_client, database_session, active_member, second_active_member, shared_workspace
) -> None:
    own = create_application(api_client, shared_workspace.id, active_member.id)
    created = api_client.post(
        "/api/v1/workspaces",
        headers={"X-User-Id": str(second_active_member.id)},
        json={"name": "Other user's private workspace"},
    )
    assert created.status_code == 201
    other_workspace = created.json()["id"]
    create_application(api_client, other_workspace, second_active_member.id)

    with runtime_role(database_session):
        set_workspace_actor(database_session, active_member.id)
        records = database_session.execute(
            text("SELECT id FROM job_applications ORDER BY id")
        ).scalars()
        assert [str(record) for record in records] == [own["id"]]
        leaked = database_session.scalar(
            text(
                "SELECT count(*) FROM job_applications WHERE workspace_id = :workspace_id"
            ),
            {"workspace_id": other_workspace},
        )
        assert leaked == 0
        set_workspace_actor(database_session, second_active_member.id)
        database_session.execute(
            text("UPDATE public.workspaces SET deleted_at = now() WHERE id = :id"),
            {"id": other_workspace},
        )
        assert (
            database_session.scalar(
                text("SELECT count(*) FROM job_applications WHERE workspace_id = :id"),
                {"id": other_workspace},
            )
            == 0
        )
        exported = api_client.get(
            "/api/v1/users/me/export",
            headers={"X-User-Id": str(second_active_member.id)},
        )
        assert exported.status_code == 200
        assert other_workspace in {
            record["workspace_id"] for record in exported.json()["applications"]
        }


def test_guest_can_accept_own_invite_under_rls_while_member_cap_applies(
    api_client, database_session, active_member, second_active_member, monkeypatch
) -> None:
    owner = {"X-User-Id": str(active_member.id)}
    guest = {"X-User-Id": str(second_active_member.id)}
    with runtime_role(database_session):
        created = api_client.post(
            "/api/v1/workspaces", headers=owner, json={"name": "RLS Workspace"}
        )
        assert created.status_code == 201
        workspace_id = created.json()["id"]
        path = f"/api/v1/workspaces/{workspace_id}"
        invitation = api_client.post(
            f"{path}/invitations",
            headers=owner,
            json={"email": second_active_member.email},
        )
        assert invitation.status_code == 201, invitation.text
        inbox = api_client.get("/api/v1/invitations", headers=guest)
        assert [row["id"] for row in inbox.json()["items"]] == [invitation.json()["id"]]
        accept_url = f"/api/v1/invitations/{invitation.json()['id']}/accept"
        monkeypatch.setattr(get_settings(), "workspace_member_cap", 1)
        assert api_client.post(accept_url, headers=guest).status_code == 409
        monkeypatch.setattr(get_settings(), "workspace_member_cap", 2)
        accepted = api_client.post(accept_url, headers=guest)
        assert accepted.status_code == 200, accepted.text
        assert api_client.get(f"{path}/members", headers=guest).status_code == 200
