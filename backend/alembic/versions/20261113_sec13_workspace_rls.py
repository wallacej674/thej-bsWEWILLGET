"""Protect workspace data using transaction-local authenticated identity.

Revision ID: 20261113_sec13
Revises: 20261113_sec11
"""

from alembic import op

revision = "20261113_sec13"
down_revision = "20261113_sec11"
branch_labels = None
depends_on = None

ACTOR = "public.applytogether_workspace_actor()"
TABLES = (
    "job_applications",
    "application_ai_analyses",
    "workspace_invitations",
    "workspace_memberships",
)


def upgrade() -> None:
    op.execute("""
        CREATE FUNCTION public.applytogether_workspace_actor() RETURNS uuid
        LANGUAGE sql STABLE SET search_path = pg_catalog
        AS $$
            SELECT nullif(current_setting('app.user_id', true), '')::uuid
        $$
    """)
    op.execute(f"""
        CREATE FUNCTION public.applytogether_workspace_role(target uuid) RETURNS text
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
        AS $$
            SELECT m.role FROM public.workspace_memberships m
            JOIN public.workspaces w ON w.id = m.workspace_id
            JOIN public.users u ON u.id = m.user_id
            WHERE m.workspace_id = target AND m.user_id = {ACTOR}
              AND m.removed_at IS NULL AND w.deleted_at IS NULL AND u.is_active
        $$
    """)
    op.execute(f"""
        CREATE FUNCTION public.applytogether_invitee(recipient text) RETURNS boolean
        LANGUAGE sql STABLE SET search_path = pg_catalog
        AS $$
            SELECT EXISTS (SELECT FROM public.users u
                WHERE u.id = {ACTOR} AND u.is_active AND u.email = recipient)
        $$
    """)
    op.execute("""
        CREATE FUNCTION public.applytogether_can_join(target uuid) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
        AS $$
            SELECT EXISTS (
                SELECT FROM public.workspace_invitations i
                JOIN public.workspaces w ON w.id = i.workspace_id
                WHERE i.workspace_id = target AND w.deleted_at IS NULL
                  AND i.accepted_at IS NULL AND i.declined_at IS NULL
                  AND public.applytogether_invitee(i.email)
            )
        $$
    """)
    op.execute("""
        CREATE FUNCTION public.applytogether_active_member_count(target uuid) RETURNS bigint
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
        AS $$
            SELECT count(*) FROM public.workspace_memberships m
            WHERE m.workspace_id = target AND m.removed_at IS NULL
              AND (public.applytogether_workspace_role(target) IS NOT NULL
                   OR public.applytogether_can_join(target))
        $$
    """)

    member = "public.applytogether_workspace_role(workspace_id) IS NOT NULL"
    owner = "public.applytogether_workspace_role(workspace_id) = 'owner'"
    invitee = "public.applytogether_invitee(email)"
    can_join = "public.applytogether_can_join(workspace_id)"
    bootstrap = "workspace_id = nullif(current_setting('app.bootstrap_workspace', true), '')::uuid"
    own_membership = f"user_id = {ACTOR}"
    moderation = (
        "public.applytogether_workspace_role(workspace_id) IN ('owner', 'admin')"
    )
    own_application = f"owner_id = {ACTOR}"
    own_deletion = f"deleted_by_user_id = {ACTOR}"
    personal = "current_setting('app.account_data', true) = 'true'"
    live_workspace = "EXISTS (SELECT FROM public.workspaces w WHERE w.id = workspace_id AND w.deleted_at IS NULL)"
    responding = (
        "id = nullif(current_setting('app.responding_invitation', true), '')::uuid"
    )
    pending = "(accepted_at IS NULL AND declined_at IS NULL)"
    inbox = f"({invitee} AND {live_workspace} AND ({pending} OR {responding}))"
    invite_cleanup = f"({personal} AND ({invitee} OR invited_by_user_id = {ACTOR}))"
    personal_application = f"({personal} AND {own_application})"
    app_write = f"{personal_application} OR ({member} AND ({own_application} OR {moderation} OR {own_deletion}))"
    op.execute(f"""
        CREATE POLICY application_read ON public.job_applications FOR SELECT
        USING ({member} OR {personal_application});
        CREATE POLICY application_insert ON public.job_applications FOR INSERT
        WITH CHECK ({member} AND {own_application});
        CREATE POLICY application_update ON public.job_applications FOR UPDATE
        USING ({app_write})
        WITH CHECK ({app_write} OR {member});
        CREATE POLICY application_delete ON public.job_applications FOR DELETE
        USING ({member} AND {own_deletion});

        CREATE POLICY analysis_access ON public.application_ai_analyses
        USING (user_id = {ACTOR} AND ({member} OR {personal}))
        WITH CHECK (user_id = {ACTOR} AND {member});

        CREATE POLICY invite_read ON public.workspace_invitations FOR SELECT
        USING ({owner} OR {inbox} OR {invite_cleanup});
        CREATE POLICY invite_create ON public.workspace_invitations FOR INSERT
        WITH CHECK ({owner} AND invited_by_user_id = {ACTOR});
        CREATE POLICY invite_update ON public.workspace_invitations FOR UPDATE
        USING ({owner} OR {inbox} OR {invite_cleanup})
        WITH CHECK ({owner} OR ({inbox} AND {responding}) OR {invite_cleanup});
        CREATE POLICY invite_delete ON public.workspace_invitations FOR DELETE
        USING ({owner} OR {invite_cleanup});

        CREATE POLICY membership_read ON public.workspace_memberships FOR SELECT
        USING ({member} OR {own_membership});
        CREATE POLICY membership_create ON public.workspace_memberships FOR INSERT
        WITH CHECK ({own_membership} AND
            ((role = 'owner' AND {bootstrap}) OR (role = 'member' AND {can_join})));
        CREATE POLICY membership_update ON public.workspace_memberships FOR UPDATE
        USING ({owner} OR {own_membership})
        WITH CHECK ({owner} OR ({own_membership} AND
            (public.applytogether_workspace_role(workspace_id) = role
             OR (role = 'member' AND {can_join}) OR removed_at IS NOT NULL)));
    """)
    for signature in (
        "applytogether_workspace_actor()",
        "applytogether_workspace_role(uuid)",
        "applytogether_invitee(text)",
        "applytogether_can_join(uuid)",
        "applytogether_active_member_count(uuid)",
    ):
        op.execute(f"REVOKE EXECUTE ON FUNCTION public.{signature} FROM PUBLIC")
        op.execute(f"""
            DO $$ BEGIN
                IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'applytogether_app') THEN
                    GRANT EXECUTE ON FUNCTION public.{signature} TO applytogether_app;
                END IF;
            END $$
        """)
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table, policies in (
        (
            "job_applications",
            (
                "application_read",
                "application_insert",
                "application_update",
                "application_delete",
            ),
        ),
        ("application_ai_analyses", ("analysis_access",)),
        (
            "workspace_invitations",
            ("invite_read", "invite_create", "invite_update", "invite_delete"),
        ),
        (
            "workspace_memberships",
            ("membership_read", "membership_create", "membership_update"),
        ),
    ):
        for policy in policies:
            op.execute(f"DROP POLICY {policy} ON public.{table}")
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
    for name, signature in (
        ("applytogether_active_member_count", "uuid"),
        ("applytogether_can_join", "uuid"),
        ("applytogether_invitee", "text"),
        ("applytogether_workspace_role", "uuid"),
        ("applytogether_workspace_actor", ""),
    ):
        op.execute(f"DROP FUNCTION public.{name}({signature})")
