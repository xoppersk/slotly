"use client";

import { useActionState } from "react";

import { IconArrowRight } from "@/components/sl/icons";
import { updatePassword, type AuthActionState } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

/* Reset-password form → updatePassword server action. The session comes
   from the recovery link (exchanged in /auth/callback); on success the
   action redirects to /app. */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <>
      {state.error && (
        <p className="sl-auth-note" role="alert" style={{ margin: "0 0 20px" }}>
          {state.error}
        </p>
      )}
      <form className="sl-form" action={formAction}>
        <div className="sl-field">
          <label htmlFor="pw">New password</label>
          <input
            id="pw"
            name="password"
            className="sl-inp"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
          />
          <span className="sl-hint">At least 10 characters</span>
        </div>
        <div className="sl-field">
          <label htmlFor="pw2">Confirm new password</label>
          <input
            id="pw2"
            name="confirmPassword"
            className="sl-inp"
            type="password"
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }} disabled={pending}>
          Set new password <IconArrowRight />
        </button>
      </form>
    </>
  );
}
