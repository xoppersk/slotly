import type { Metadata } from "next";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "../sign-in/_chrome";
import { IconArrowRight } from "@/components/sl/icons";
import { getBusiness, getOwner } from "@/lib/api";

export const metadata: Metadata = { title: "Start free" };

/* F-05 — Sign up: owner setup step 1 of 4 (business → services → hours →
   publish), exactly as drawn. Continue leads to the dashboard's Services
   step (the screen's Services.html target). */
export default function SignUpPage() {
  const owner = getOwner();
  const business = getBusiness();
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
      <form className="sl-form" action="/app/services">
        <div className="sl-field">
          <label htmlFor="nm">Your name</label>
          <input id="nm" className="sl-inp" defaultValue={owner.name} autoComplete="name" />
        </div>
        <div className="sl-field">
          <label htmlFor="em">Work email</label>
          <input id="em" className="sl-inp" type="email" defaultValue={owner.email} autoComplete="email" />
        </div>
        <div className="sl-field">
          <label htmlFor="pw">Password</label>
          <input id="pw" className="sl-inp" type="password" defaultValue="••••••••••" autoComplete="new-password" />
          <span className="sl-hint">At least 10 characters</span>
        </div>
        <div className="sl-field">
          <label htmlFor="bn">Business name</label>
          <input id="bn" className="sl-inp" defaultValue={business.name} />
          <span className="sl-hint">Your page: {business.bookingUrl}</span>
        </div>
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }}>
          Continue to services <IconArrowRight />
        </button>
      </form>
      <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--muted)" }}>Free for one person. No card needed.</p>
    </AuthChrome>
  );
}
