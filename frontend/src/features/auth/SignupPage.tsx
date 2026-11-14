// Sign up in three short steps: You (name, email) → Password → Workspace,
// then Verify. A stepper fills as you go, each step slides in from the side,
// the password step ticks off its checks as you type, and the workspace step
// previews the space you're creating. Nothing is sent until the last step.
import { type FormEvent, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useAnimate, useReducedMotion } from "motion/react";

import { ThemeToggle } from "../../app/theme/ThemeToggle";
import logoUrl from "../../assets/applytogether-logo.png";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import type { MessageResponse, SignupInput } from "./authApi";
import { authInputClass, authLabelClass, authLinkClass } from "./authStyles";
import {
  EMPTY_SIGNUP,
  MIN_PASSWORD_LENGTH,
  SIGNUP_STAGES,
  SIGNUP_STEPS,
  type SignupErrors,
  type SignupFieldName,
  type SignupFields,
  firstStepWithError,
  passwordLongEnough,
  passwordsMatch,
  stepErrors,
  validateSignup,
} from "./signupModel";
import {
  FieldMessage,
  MailBadge,
  PasswordMeter,
  Requirement,
  ResendButton,
  SignupStepper,
  WorkspacePreview,
} from "./signupParts";

interface SignupPageProps {
  onSignup(input: SignupInput): Promise<MessageResponse>;
  onResend(email: string): Promise<MessageResponse>;
}

const RESEND_COOLDOWN_SECONDS = 60;
const SHAKE = { x: [0, -10, 9, -7, 5, -2, 0] };
const LAST_STEP = SIGNUP_STEPS.length - 1;

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

/** Seconds the server asked us to wait (rate limits, SEC-02). */
function retryAfterSeconds(error: unknown): number {
  if (typeof error === "object" && error !== null && "details" in error) {
    const details = (error as { details: unknown }).details;
    if (typeof details === "object" && details !== null && "retry_after_seconds" in details) {
      return Number((details as { retry_after_seconds: unknown }).retry_after_seconds) || 0;
    }
  }
  return 0;
}

function TextField({
  id,
  label,
  type = "text",
  value,
  error,
  helper,
  autoComplete,
  autoFocus,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  helper?: string;
  autoComplete: string;
  autoFocus: boolean;
  onChange(value: string): void;
}) {
  const messageId = `${id}-message`;
  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        // Moves focus into a step as it appears, or to a field needing a fix.
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helper ? messageId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${authInputClass} ${
          error ? "border-destructive/60 focus:border-destructive focus:ring-destructive/20" : ""
        }`}
      />
      <FieldMessage id={messageId} error={error} helper={helper} />
    </div>
  );
}

export function SignupPage({ onSignup, onResend }: SignupPageProps) {
  const idPrefix = useId();
  const fieldId = (name: SignupFieldName) => `${idPrefix}-${name}`;
  const reduceMotion = useReducedMotion();
  const [card, animate] = useAnimate<HTMLDivElement>();
  const [fields, setFields] = useState<SignupFields>(EMPTY_SIGNUP);
  const [errors, setErrors] = useState<SignupErrors>({});
  // A problem with the whole form rather than one field (e.g. a rate limit).
  const [formError, setFormError] = useState<string>();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  // The field to focus when a step mounts; none on first load.
  const [focusTarget, setFocusTarget] = useState<SignupFieldName | null>(null);
  const [pending, setPending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>();
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const update = (name: SignupFieldName, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const shake = () => {
    if (!reduceMotion && card.current) {
      void animate(card.current, SHAKE, { duration: 0.45, ease: "easeOut" });
    }
  };

  const goTo = (next: number, focus: SignupFieldName = SIGNUP_STEPS[next].fields[0]) => {
    setDirection(next >= step ? 1 : -1);
    setFocusTarget(focus);
    setStep(next);
  };

  const create = async () => {
    setPending(true);
    setDeliveryFailed(false);
    setFormError(undefined);
    const email = fields.email.trim();
    try {
      await onSignup({
        displayName: fields.displayName.trim(),
        email,
        password: fields.password,
        workspaceName: fields.workspaceName.trim(),
      });
      setSubmittedEmail(email);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (errorCode(error) === "email_delivery_unavailable") {
        setSubmittedEmail(email);
        setDeliveryFailed(true);
      } else if (errorCode(error) === "rate_limited" && error instanceof Error) {
        setFormError(error.message);
        shake();
      } else {
        setErrors({ email: "The account could not be created. Check the form and try again." });
        goTo(0, "email");
        shake();
      }
      setFields((current) => ({ ...current, password: "", confirmPassword: "" }));
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const found = stepErrors(step, fields);
    const firstBad = SIGNUP_STEPS[step].fields.find((name) => found[name]);
    if (firstBad) {
      setErrors((current) => ({ ...current, ...found }));
      document.getElementById(fieldId(firstBad))?.focus();
      shake();
      return;
    }
    if (step < LAST_STEP) {
      goTo(step + 1);
      return;
    }

    // Earlier steps were checked on the way through; check them all once more.
    const all = validateSignup(fields);
    const badStep = firstStepWithError(all);
    if (badStep !== -1) {
      setErrors(all);
      goTo(badStep, SIGNUP_STEPS[badStep].fields.find((name) => all[name]));
      shake();
      return;
    }
    void create();
  };

  const resend = async () => {
    if (!submittedEmail || resendPending || resendSeconds > 0) return;
    setResendPending(true);
    try {
      await onResend(submittedEmail);
      setDeliveryFailed(false);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      const wait = errorCode(error) === "rate_limited" ? retryAfterSeconds(error) : 0;
      // Over the resend limit: count down to when it's allowed again.
      if (wait > 0) setResendSeconds(wait);
      else setDeliveryFailed(true);
    } finally {
      setResendPending(false);
    }
  };

  const sent = submittedEmail !== undefined;
  const current = SIGNUP_STEPS[step];
  const heading = sent ? (deliveryFailed ? "Your account is saved" : "Check your email") : current.title;
  const description = sent
    ? deliveryFailed
      ? "We saved your registration, but the email could not be delivered. Try sending a new link."
      : "Open the verification link we sent to finish creating your account."
    : current.description;

  const field = (name: SignupFieldName) => ({
    id: fieldId(name),
    value: fields[name],
    error: errors[name],
    autoFocus: focusTarget === name,
    onChange: (value: string) => update(name, value),
  });

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground [font-family:'Space_Grotesk',system-ui,sans-serif]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_42%_at_50%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_72%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(color-mix(in_srgb,var(--primary)_18%,transparent)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(50%_45%_at_50%_28%,black,transparent)]"
        />
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-[29rem]">
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <Link
                to="/"
                className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-black p-1 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent),0_14px_44px_-10px_color-mix(in_srgb,var(--primary)_40%,transparent)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <img src={logoUrl} alt="ApplyTogether home" className="h-full w-full object-contain" />
              </Link>
            </motion.div>

            <SignupStepper active={sent ? SIGNUP_STAGES.length - 1 : step} />

            <div className="mb-6 text-center" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={heading}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  <h1 className="text-balance text-[1.85rem] font-bold leading-tight tracking-[-0.02em]">{heading}</h1>
                  <p className="mt-1.5 text-pretty text-[0.95rem] leading-6 text-muted-foreground">{description}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div
              ref={card}
              className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[var(--shadow-raised)] ring-1 ring-inset ring-white/[0.03] backdrop-blur"
            >
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                {sent ? (
                  <motion.div
                    key="sent"
                    className="flex flex-col items-center gap-5 p-6 sm:p-7"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                  >
                    <MailBadge />
                    <div className="w-full space-y-4">
                      <div>
                        <p className={authLabelClass}>Sent to</p>
                        <p className="break-all rounded-xl border border-border bg-input px-4 py-3 text-[0.95rem] font-medium text-foreground">
                          {submittedEmail}
                        </p>
                      </div>
                      <ResendButton
                        seconds={resendSeconds}
                        total={RESEND_COOLDOWN_SECONDS}
                        pending={resendPending}
                        onResend={() => void resend()}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key={step}
                    noValidate
                    onSubmit={submit}
                    className="p-6 sm:p-7"
                    custom={direction}
                    variants={{
                      enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
                      center: { opacity: 1, x: 0 },
                      exit: (dir: number) => ({ opacity: 0, x: dir * -48 }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.32, ease: EASE_OUT }}
                  >
                    <div className="space-y-5">
                      {step === 0 ? (
                        <>
                          <TextField {...field("displayName")} label="Your name" autoComplete="name" />
                          <TextField {...field("email")} label="Email address" type="email" autoComplete="email" />
                        </>
                      ) : step === 1 ? (
                        <>
                          <div>
                            <TextField {...field("password")} label="Password" type="password" autoComplete="new-password" />
                            {errors.password ? null : <PasswordMeter password={fields.password} />}
                          </div>
                          <TextField
                            {...field("confirmPassword")}
                            label="Confirm password"
                            type="password"
                            autoComplete="new-password"
                          />
                          <ul className="space-y-2 rounded-xl bg-secondary/50 p-3.5" aria-label="Password checks">
                            <Requirement met={passwordLongEnough(fields.password)}>
                              {`${MIN_PASSWORD_LENGTH} characters or more`}
                            </Requirement>
                            <Requirement met={passwordsMatch(fields.password, fields.confirmPassword)}>
                              Both passwords match
                            </Requirement>
                          </ul>
                        </>
                      ) : (
                        <>
                          <TextField
                            {...field("workspaceName")}
                            label="Workspace name"
                            autoComplete="organization"
                            helper="Used only when your email has no existing invitation."
                          />
                          <WorkspacePreview workspaceName={fields.workspaceName} displayName={fields.displayName} />
                        </>
                      )}
                    </div>
                    {formError && step === LAST_STEP ? (
                      <p
                        role="alert"
                        className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                      >
                        {formError}
                      </p>
                    ) : null}
                    <div className="mt-7 flex items-center gap-3">
                      {step > 0 ? (
                        <button
                          type="button"
                          onClick={() => goTo(step - 1)}
                          disabled={pending}
                          className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-border px-4 text-[0.95rem] font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
                        >
                          <ArrowLeft size={16} aria-hidden="true" /> Back
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        disabled={pending}
                        className="group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[0.95rem] font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-progress disabled:opacity-80"
                      >
                        {step < LAST_STEP ? (
                          <>
                            Continue
                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </>
                        ) : pending ? (
                          "Creating account…"
                        ) : (
                          "Create account"
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {sent ? (
                <Link to="/login" className={authLinkClass}>
                  Return to sign in
                </Link>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link to="/login" className={authLinkClass}>
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}
