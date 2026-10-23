import type { Metadata } from "next";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "../sign-in/_chrome";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Start free" };

/* F-05 — Sign up: owner setup step 1 of 4 (business → services → hours →
   publish), exactly as drawn. This step creates the real auth account;
   because email confirmation is required before the first sign-in, the
   remaining steps run in /onboarding right after that sign-in. */
export default function SignUpPage() {
  return (
    <AuthChrome panel={<SignPanel />}>
      <ol className="sl-steps" aria-label="Setup steps">
        <li className="on">
          <span className="sl-sr-only">Step 1 of 4, current: Business</span>
        </li>
        <li>
          <span className="sl-sr-only">Services</span>
        </li>
        <li>
          <span className="sl-sr-only">Hours</span>
        </li>
        <li>
          <span className="sl-sr-only">Publish</span>
        </li>
      </ol>
      <p className="sl-steps-eyebrow">Step 1 of 4 · then services, hours, publish</p>
      <h1 className="sl-auth-h1">Set up your business</h1>
      <p className="sl-auth-sub" style={{ marginBottom: 28 }}>
        Already have an account? <a href="/sign-in">Sign in</a>
      </p>
      <SignUpForm />
      <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}>Free for one person. No card needed.</p>
    </AuthChrome>
  );
}
