import type { Metadata } from "next";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "./_chrome";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

/* F-04 — Sign in: password OR an emailed sign-in link, plus the note that
   customers never need an account. Wired to real Supabase Auth via the
   signIn / sendMagicLink server actions (see SignInForm). `?error=` arrives
   from /auth/callback when an emailed link fails; `?next=` is honoured by
   the signIn action after a successful sign-in. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <AuthChrome panel={<SignPanel />}>
      <h1 className="sl-auth-h1">Sign in</h1>
      <p className="sl-auth-sub">
        New here? <a href="/sign-up">Start free</a>
      </p>
      <SignInForm next={next} initialError={error} />
      <p className="sl-auth-note">
        Booked an appointment? You don’t need an account. Use the link in your confirmation email to change it.
      </p>
    </AuthChrome>
  );
}
