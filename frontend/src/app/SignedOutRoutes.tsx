import type { ComponentProps } from "react";
import { Navigate, Route, Routes } from "react-router";

import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { LandingPage } from "../features/landing/LandingPage";

type SignedOutRoutesProps = ComponentProps<typeof LoginPage> & ComponentProps<typeof SignupPage>;

/**
 * What a signed-out visitor can reach: the landing page at /, sign in and
 * sign up. Any other address is an app page, so it asks them to sign in.
 */
export function SignedOutRoutes({ onLogin, onSignup, onResend }: SignedOutRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
      <Route path="/signup" element={<SignupPage onSignup={onSignup} onResend={onResend} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
