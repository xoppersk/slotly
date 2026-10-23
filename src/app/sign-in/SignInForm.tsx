"use client";

import { useActionState, useState } from "react";

import { IconArrowRight } from "@/components/sl/icons";
import { sendMagicLink, signIn, type AuthActionState } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

/* F-04 form, wired for real: email + password → signIn server action;
   "Email me a sign-in link" → sendMagicLink (signInWithOtp). The drawn
   markup/classes are unchanged; fixture prefills are gone. */
export function SignInForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [magicState, magicAction, magicPending] = useActionState(
    async (_prev: AuthActionState, formData: FormData) =>
      sendMagicLink(String(formData.get("email") ?? "")),
    initialState,
  );
  const [email, setEmail] = useState("");

  const error = state.error ?? magicState.error ?? initialError;

  return (
    <>
      {error && (
        <p className="sl-auth-note" role="alert" style={{ margin: "0 0 20px" }}>
          {error}
        </p>
      )}
      {magicState.magicLinkSent && (
        <p className="sl-auth-note" role="status" style={{ margin: "0 0 20px" }}>
          Sign-in link sent to {magicState.email}. Open it on this device to
          finish signing in — it expires shortly.
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="sl-field">
          <div className="sl-field-head">
            <label htmlFor="pw">Password</label>
            <a href="/forgot-password">Forgot it?</a>
          </div>
          <input
            id="pw"
            name="password"
            className="sl-inp"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {next && <input type="hidden" name="next" value={next} />}
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }} disabled={pending}>
          Sign in <IconArrowRight />
        </button>
      </form>
      <div className="sl-or">or</div>
      <form action={magicAction}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" className="sl-sec" disabled={magicPending}>
          Email me a sign-in link
        </button>
      </form>
    </>
  );
}
