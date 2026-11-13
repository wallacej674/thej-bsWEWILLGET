import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronRight, KeyRound, LogOut } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { SideSheet } from "../../app/components/SideSheet";
import { AppearancePicker } from "../../app/theme/AppearancePicker";
import { type ApiClient, applicationsApi, workspaceApi } from "../applications/api";
import type { CurrentUser, MyWeek, Workspace } from "../applications/types";
import { EASE_OUT, EYEBROW, PANEL } from "../dashboard/dashboardStyles";
import { CountUp } from "../dashboard/motion";
import { avatarColor, initials } from "../members/avatar";
import { ResumeProfilePanel } from "../resume/ResumeProfilePanel";
import { BIN_SECONDARY_BUTTON, DeletedBin } from "./DeletedBin";
import { PasswordForm } from "./PasswordForm";

const ROLE_LABEL: Record<Workspace["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

// Search param that opens the deleted-applications sheet (old /deleted links use it).
const BIN_PARAM = "bin";

/** The member's weekly numbers and email (the session user has no email). */
function useProfileSummary(client: ApiClient, workspaceId: string, user: CurrentUser) {
  const [myWeek, setMyWeek] = useState<MyWeek | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    applicationsApi
      .myWeek(client, workspaceId)
      .then((value) => {
        if (!cancelled) setMyWeek(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, version]);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .members(client, workspaceId, { search: user.display_name, pageSize: 20 })
      .then((response) => {
        const me = response.items.find((member) => member.user.id === user.id);
        if (!cancelled) setEmail(me?.user.email ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, user.id, user.display_name]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  return { myWeek, email, refresh };
}

function Card({
  title,
  action,
  delay,
  className = "",
  children,
}: {
  title: string;
  action?: ReactNode;
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      aria-label={title}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      className={`${PANEL} min-w-0 p-5 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={EYEBROW}>{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function WorkspaceList({ workspaces, currentId }: { workspaces: Workspace[]; currentId: string }) {
  return (
    <ul className="divide-y divide-border">
      {workspaces.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary"
          >
            {initials(item.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABEL[item.role]}</span>
          </span>
          {item.id === currentId ? (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check size={13} aria-hidden="true" /> Current
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The profile hub: who you are and your numbers, then cards for your résumé,
 * appearance, recently deleted applications, password and workspaces.
 */
export function ProfileHub({
  client,
  user,
  workspace,
  workspaces,
  changePassword,
  logout,
  developerTools,
}: {
  client: ApiClient;
  user: CurrentUser;
  workspace: Workspace;
  workspaces: Workspace[];
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  logout(): Promise<void>;
  /** Development-only controls, rendered in their own card when given. */
  developerTools?: ReactNode;
}) {
  const { myWeek, email, refresh } = useProfileSummary(client, workspace.id, user);
  const [params, setParams] = useSearchParams();
  const binOpen = params.get(BIN_PARAM) === "open";
  const [binCount, setBinCount] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const manageButton = useRef<HTMLButtonElement>(null);
  const color = avatarColor(user.id);

  const setBinOpen = useCallback(
    (open: boolean) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (open) next.set(BIN_PARAM, "open");
          else next.delete(BIN_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const closeBin = useCallback(() => {
    setBinOpen(false);
    // The sheet may have restored or erased items; reload the card's preview.
    setPreviewKey((value) => value + 1);
    manageButton.current?.focus();
  }, [setBinOpen]);

  const stats: { label: string; value: number | undefined; suffix?: string }[] = [
    { label: "Sent all-time", value: myWeek?.total_applied_all_time },
    {
      label: "This week",
      value: myWeek?.applied_this_week,
      suffix: myWeek?.weekly_goal ? `/${myWeek.weekly_goal}` : undefined,
    },
    { label: "Week streak", value: myWeek?.streak_weeks },
    { label: "Active now", value: myWeek?.total_active },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <motion.section
          aria-label="Your profile"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className={`${PANEL} overflow-hidden`}
        >
          <div
            aria-hidden="true"
            className="h-24"
            style={{
              background: `linear-gradient(120deg, ${color}, color-mix(in srgb, ${color} 35%, var(--primary)))`,
            }}
          />
          <div className="flex flex-wrap items-end gap-4 px-6 pb-6">
            <span
              aria-hidden="true"
              className="-mt-10 inline-flex h-[84px] w-[84px] flex-none items-center justify-center rounded-full text-3xl font-semibold text-white ring-4 ring-card"
              style={{ background: color }}
            >
              {initials(user.display_name)}
            </span>
            {/* On phones the name gets its own row under the avatar and button. */}
            <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1 sm:pt-3">
              <h1 className="font-display truncate text-2xl font-semibold text-foreground">
                {user.display_name}
              </h1>
              <p className="text-sm text-muted-foreground sm:truncate">
                {email ? <span className="break-all">{email} · </span> : null}
                {ROLE_LABEL[workspace.role]} of {workspace.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className={`${BIN_SECONDARY_BUTTON} ml-auto sm:ml-0`}
            >
              <LogOut size={13} aria-hidden="true" /> Log out
            </button>
          </div>
          <dl className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                // 2 columns on phones (divider right of the left column and
                // under the first row), 4 in a row from `sm` up.
                className={[
                  "border-border px-6 py-4",
                  index % 2 === 0 ? "border-r" : "",
                  index < 2 ? "border-b sm:border-b-0" : "",
                  index < stats.length - 1 ? "sm:border-r" : "",
                ].join(" ")}
              >
                <dt className={EYEBROW}>{stat.label}</dt>
                <dd className="font-numeric mt-1 text-2xl text-foreground">
                  {stat.value === undefined ? "–" : <CountUp value={stat.value} />}
                  {stat.suffix ? <span className="text-sm text-muted-foreground">{stat.suffix}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </motion.section>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Card title="Résumé" delay={0.08} className="lg:col-span-2">
            <div className="[&>section]:mt-0 [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0">
              <ResumeProfilePanel client={client} />
            </div>
          </Card>

          <Card title="Appearance" delay={0.14}>
            <AppearancePicker />
          </Card>

          <Card
            title={binCount ? `Recently deleted · ${binCount}` : "Recently deleted"}
            delay={0.2}
            className="lg:col-span-2"
            action={
              <button
                ref={manageButton}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setBinOpen(true)}
                className="flex items-center gap-1 rounded text-xs font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Manage <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          >
            <DeletedBin
              key={previewKey}
              client={client}
              workspaceId={workspace.id}
              preview
              onCount={setBinCount}
              onChanged={refresh}
            />
          </Card>

          <Card title="Security" delay={0.26}>
            <AnimatePresence initial={false} mode="wait">
              {passwordOpen ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <PasswordForm changePassword={changePassword} onDone={() => setPasswordOpen(false)} />
                  <button
                    type="button"
                    onClick={() => setPasswordOpen(false)}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : (
                <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <KeyRound size={15} aria-hidden="true" className="text-primary" /> Password sign-in
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Changing it signs you out on every device.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPasswordOpen(true)}
                    className={`${BIN_SECONDARY_BUTTON} mt-3`}
                  >
                    Change password
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <Card
            title="Workspaces"
            delay={0.32}
            className="lg:col-span-3"
            action={
              <Link to="/workspace" className="text-xs font-medium text-primary hover:text-primary/80">
                Manage
              </Link>
            }
          >
            <WorkspaceList workspaces={workspaces} currentId={workspace.id} />
          </Card>

          {developerTools ? (
            <Card title="Developer tools" delay={0.38} className="lg:col-span-3">
              {developerTools}
            </Card>
          ) : null}
        </div>
      </div>

      <SideSheet
        open={binOpen}
        title="Recently deleted"
        description="Restore applications you deleted, or erase them for good."
        onClose={closeBin}
      >
        <DeletedBin client={client} workspaceId={workspace.id} onChanged={refresh} />
      </SideSheet>
    </MotionConfig>
  );
}
