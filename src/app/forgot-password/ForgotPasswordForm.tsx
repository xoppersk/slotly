"use client";

import { useActionState } from "react";

import { IconArrowRight } from "@/components/sl/icons";
import { requestPasswordReset, type AuthActionState } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

/* Forgot-password form → requestPasswordReset server action. On success the
   form is replaced by the check-your-email state (shown for any address —
   the backend never reveals whether an account exists). */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionState, formData: FormData) =>
      requestPasswordReset(String(formData.get("email") ?? "")),
    initialState,
  );

  if (state.resetSent) {
    return (
      <>
        <p className="sl-auth-note" role="status">
          If an account exists for {state.email}, a reset link is on its way.
          Open it on this device — you’ll set a new password here. The link
          expires shortly, so use the newest email if you requested more than
          one.
        </p>
        <a href="/sign-in" className="sl-sec" style={{ marginTop: 20 }}>
          Back to sign in
        </a>
      </>
    );
  }

  return (
    <>
      {state.error && (
        <p className="sl-auth-note" role="alert" style={{ margin: "0 0 20px" }}>
          {state.error}
        </p>
      )}
      <form className="sl-form" action={formAction}>
        <div className="sl-field">
          <label htmlFor="em">Email</label>
          <input
            id="em"
            name="email"
            className="sl-inp"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }} disabled={pending}>
          Email me a reset link <IconArrowRight />
        </button>
      </form>
    </>
  );
}
