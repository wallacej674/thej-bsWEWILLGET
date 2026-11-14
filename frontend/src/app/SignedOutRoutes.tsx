import type { ComponentProps } from "react";
import { Navigate, Route, Routes } from "react-router";

import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { LandingPage } from "../features/landing/LandingPage";

type SignedOutRoutesProps = ComponentProps<typeof LoginPage> &
  ComponentProps<typeof SignupPage> &
  ComponentProps<typeof ForgotPasswordPage>;

/**
 * What a signed-out visitor can reach: the landing page at /, sign in, sign
 * up and "forgot password". Any other address is an app page, so it asks
 * them to sign in. (Reset links work signed in or out; see App.tsx.)
 */
export function SignedOutRoutes({
  onLogin,
  onSignup,
  onResend,
  onRequestReset,
}: SignedOutRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
      <Route path="/signup" element={<SignupPage onSignup={onSignup} onResend={onResend} />} />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage onRequestReset={onRequestReset} />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
