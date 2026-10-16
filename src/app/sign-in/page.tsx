import type { Metadata } from "next";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "./_chrome";
import { IconArrowRight } from "@/components/sl/icons";
import { getOwner } from "@/lib/api";

export const metadata: Metadata = { title: "Sign in" };

/* F-04 — Sign in: password OR an emailed sign-in link, plus the note that
   customers never need an account. Form values are the drawn fixtures. */
export default function SignInPage() {
  const owner = getOwner();
  return (
    <AuthChrome panel={<SignPanel />}>
      <h1 className="sl-auth-h1">Sign in</h1>
      <p className="sl-auth-sub">
        New here? <a href="/sign-up">Start free</a>
      </p>
      <form className="sl-form" action="/app">
        <div className="sl-field">
          <label htmlFor="em">Email</label>
          <input id="em" className="sl-inp" type="email" defaultValue={owner.email} autoComplete="email" />
        </div>
        <div className="sl-field">
          <div className="sl-field-head">
            <label htmlFor="pw">Password</label>
            <a href="#">Forgot it?</a>
          </div>
          <input id="pw" className="sl-inp" type="password" defaultValue="••••••••••" autoComplete="current-password" />
        </div>
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }}>
          Sign in <IconArrowRight />
        </button>
      </form>
      <div className="sl-or">or</div>
      <a href="#" className="sl-sec">
        Email me a sign-in link
      </a>
      <p className="sl-auth-note">
        Booked an appointment? You don’t need an account. Use the link in your confirmation email to change it.
      </p>
    </AuthChrome>
  );
}
