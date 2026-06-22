import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

import type { MessageResponse, SignupInput } from "./authApi";
import { AuthLayout } from "./AuthLayout";

interface SignupPageProps {
  onSignup(input: SignupInput): Promise<MessageResponse>;
  onResend(email: string): Promise<MessageResponse>;
}

type SignupFields = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  workspaceName: string;
};

type FieldErrors = Partial<Record<keyof SignupFields, string>>;

const inputClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-[#151e2f] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20";

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

export function SignupPage({ onSignup, onResend }: SignupPageProps) {
  const [fields, setFields] = useState<SignupFields>({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    workspaceName: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>();
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const refs = {
    displayName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
    workspaceName: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const update = (name: keyof SignupFields, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!fields.displayName.trim()) next.displayName = "Enter your name.";
    if (!fields.email.trim() || !fields.email.includes("@")) {
      next.email = "Enter a valid email address.";
    }
    if (fields.password.length < 12) {
      next.password = "Use at least 12 characters.";
    }
    if (fields.confirmPassword !== fields.password) {
      next.confirmPassword = "Passwords do not match.";
    }
    if (!fields.workspaceName.trim()) {
      next.workspaceName = "Enter a workspace name.";
    }
    return next;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const first = (
        Object.keys(nextErrors) as Array<keyof SignupFields>
      )[0];
      refs[first].current?.focus();
      return;
    }

    setPending(true);
    setDeliveryFailed(false);
    try {
      await onSignup({
        displayName: fields.displayName.trim(),
        email: fields.email.trim(),
        password: fields.password,
        workspaceName: fields.workspaceName.trim(),
      });
      setSubmittedEmail(fields.email.trim());
      setResendSeconds(60);
    } catch (error) {
      if (errorCode(error) === "email_delivery_unavailable") {
        setSubmittedEmail(fields.email.trim());
        setDeliveryFailed(true);
      } else {
        setErrors({ email: "The account could not be created. Check the form and try again." });
        refs.email.current?.focus();
      }
      setFields((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    if (!submittedEmail || resendPending || resendSeconds > 0) return;
    setResendPending(true);
    try {
      await onResend(submittedEmail);
      setDeliveryFailed(false);
      setResendSeconds(60);
    } catch {
      setDeliveryFailed(true);
    } finally {
      setResendPending(false);
    }
  };

  if (submittedEmail) {
    return (
      <AuthLayout eyebrow="Account setup">
        <div aria-live="polite">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
            {deliveryFailed ? "Your account is saved" : "Check your email"}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            {deliveryFailed
              ? "We saved your registration, but the email could not be delivered. Try sending a new link."
              : "Open the verification link we sent to finish creating your account."}
          </p>
          <p className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200">
            {submittedEmail}
          </p>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resendPending || resendSeconds > 0}
            className="mt-5 min-h-11 w-full rounded-lg border border-indigo-400/30 bg-indigo-400/10 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendPending
              ? "Sending new link…"
              : resendSeconds > 0
                ? `Send again in ${resendSeconds}s`
                : "Send a new link"}
          </button>
          <Link
            to="/login"
            className="mt-5 inline-flex text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Return to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Create account">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
        Start a shared search
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
        Create your account and verify your email before entering the workspace.
      </p>

      <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
        <Field
          label="Display name"
          name="displayName"
          value={fields.displayName}
          error={errors.displayName}
          inputRef={refs.displayName}
          autoComplete="name"
          onChange={update}
        />
        <Field
          label="Email address"
          name="email"
          type="email"
          value={fields.email}
          error={errors.email}
          inputRef={refs.email}
          autoComplete="email"
          onChange={update}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Password"
            name="password"
            type="password"
            value={fields.password}
            error={errors.password}
            inputRef={refs.password}
            autoComplete="new-password"
            helper="At least 12 characters."
            onChange={update}
          />
          <Field
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={fields.confirmPassword}
            error={errors.confirmPassword}
            inputRef={refs.confirmPassword}
            autoComplete="new-password"
            onChange={update}
          />
        </div>
        <Field
          label="Workspace name"
          name="workspaceName"
          value={fields.workspaceName}
          error={errors.workspaceName}
          inputRef={refs.workspaceName}
          autoComplete="organization"
          helper="Used only when your email has no existing invitation."
          onChange={update}
        />

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1120] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-indigo-300 transition hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  error,
  helper,
  autoComplete,
  inputRef,
  onChange,
}: {
  label: string;
  name: keyof SignupFields;
  type?: string;
  value: string;
  error?: string;
  helper?: string;
  autoComplete: string;
  inputRef: RefObject<HTMLInputElement>;
  onChange(name: keyof SignupFields, value: string): void;
}) {
  const inputId = useId();
  const messageId = `${name}-message`;
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-200"
      >
        {label}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helper ? messageId : undefined}
        onChange={(event) => onChange(name, event.target.value)}
        className={`${inputClass} mt-2 ${
          error ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/20" : ""
        }`}
      />
      {error || helper ? (
        <span
          id={messageId}
          className={`mt-1.5 block text-xs ${error ? "text-rose-300" : "text-slate-500"}`}
        >
          {error ?? helper}
        </span>
      ) : null}
    </div>
  );
}
