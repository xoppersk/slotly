"use client";

import { useActionState, useState } from "react";

import { IconArrowRight } from "@/components/sl/icons";
import { signUp, type AuthActionState } from "@/lib/auth-actions";

const initialState: AuthActionState = {};

/** Slug preview from a business name — same rule the server enforces
 * (lowercase [a-z0-9-]); the real slug is chosen in onboarding. */
function slugPreview(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "your-business";
}

/* F-05 form, wired for real. This creates the AUTH ACCOUNT only (signUp
   server action). Live config requires email confirmation before the first
   sign-in, so the honest end state here is "check your email" — business
   setup (services → hours → publish) happens in /onboarding after the
   first sign-in. The business name typed here is carried into onboarding. */
export function SignUpForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionState, formData: FormData) =>
      signUp({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        businessName: String(formData.get("businessName") ?? ""),
      }),
    initialState,
  );
  const [businessName, setBusinessName] = useState("");

  if (state.needsConfirmation) {
    return (
      <>
        <p className="sl-auth-note" role="status">
          Account created for {state.email}. Check your email and use the
          confirmation link — then sign in and we’ll finish setting up your
          business (services, hours, and your public booking page).
        </p>
        <a href="/sign-in" className="sl-sec" style={{ marginTop: 20 }}>
          Go to sign in
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
          <label htmlFor="nm">Your name</label>
          <input id="nm" name="name" className="sl-inp" required autoComplete="name" />
        </div>
        <div className="sl-field">
          <label htmlFor="em">Work email</label>
          <input
            id="em"
            name="email"
            className="sl-inp"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div className="sl-field">
          <label htmlFor="pw">Password</label>
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
          <label htmlFor="bn">Business name</label>
          <input
            id="bn"
            name="businessName"
            className="sl-inp"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          <span className="sl-hint">Your page: slotly.app/b/{slugPreview(businessName)}</span>
        </div>
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }} disabled={pending}>
          Continue to services <IconArrowRight />
        </button>
      </form>
    </>
  );
}
