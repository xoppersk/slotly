import type { Metadata } from "next";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "../sign-in/_chrome";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

/* Forgot password — same auth chrome as F-04. Submitting emails a recovery
   link (requestPasswordReset) that lands on /auth/callback and then
   /reset-password, where the new password is set. */
export default function ForgotPasswordPage() {
  return (
    <AuthChrome panel={<SignPanel />}>
      <h1 className="sl-auth-h1">Forgot your password?</h1>
      <p className="sl-auth-sub">
        Remembered it after all? <a href="/sign-in">Sign in</a>
      </p>
      <ForgotPasswordForm />
    </AuthChrome>
  );
}
