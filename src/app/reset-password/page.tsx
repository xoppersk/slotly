import type { Metadata } from "next";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "../sign-in/_chrome";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set a new password" };

/* Reset password — reached only via the recovery email link, which
   /auth/callback exchanges for a session before landing here. Without that
   session there is nothing to update, so we say so and point back to
   /forgot-password instead of rendering a dead form. */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthChrome panel={<SignPanel />}>
      <h1 className="sl-auth-h1">Set a new password</h1>
      <p className="sl-auth-sub">
        Back to <a href="/sign-in">Sign in</a>
      </p>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <>
          <p className="sl-auth-note" role="alert">
            This page only works from the link in a password-reset email, and
            that link has expired or was already used.
          </p>
          <a href="/forgot-password" className="sl-sec" style={{ marginTop: 20 }}>
            Request a new reset link
          </a>
        </>
      )}
    </AuthChrome>
  );
}
