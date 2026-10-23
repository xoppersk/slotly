"use server";

/**
 * Auth server actions — real Supabase Auth (PostgreSQL / Row Level Security /
 * JWT) via the server client. No hard-coded or bypass logins, no fixture
 * prefills. Every action either redirects on success or returns an
 * `AuthActionState` the page renders as an inline error/notice — failures are
 * never silent.
 *
 * Form-action signature: `(prevState, formData)` so pages can use
 * `useActionState`. `signUp` / `requestPasswordReset` / `sendMagicLink` take
 * plain values (per the team contract) and are wrapped by the page's client
 * form.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getMyMemberships } from "@/lib/db/owner";

export interface AuthActionState {
  error?: string;
  notice?: string;
  /** Sign-up succeeded but email confirmation is required before sign-in. */
  needsConfirmation?: boolean;
  /** Password-reset email accepted (also returned for unknown emails — the
   *  auth backend does not confirm whether an account exists). */
  resetSent?: boolean;
  /** Magic-link email accepted. */
  magicLinkSent?: boolean;
  /** The email the state refers to (for confirmation copy). */
  email?: string;
}

/** Cookie name carrying the business name typed on the sign-up form into
 *  onboarding (sign-up creates the auth user only; the business is created
 *  later by `create_business_setup`, after email confirmation + sign-in).
 *  Duplicated as a literal in src/app/onboarding/actions.ts — a "use server"
 *  module may only export async functions, so it can't live here as a const. */
const PENDING_BUSINESS_COOKIE = "slotly_pending_business";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(72, "Password must be 72 characters or fewer.");

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Only same-site absolute paths may be used as post-auth destinations. */
function safeNext(raw: FormDataEntryValue | string | null | undefined, fallback = "/app"): string {
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account. Check them and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Your email isn't confirmed yet. Use the link in the confirmation email we sent when you signed up, then sign in.";
  }
  if (m.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead — or reset your password if you've forgotten it.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  return message;
}

/**
 * The signed-in user plus their business memberships.
 *
 * Exported for W4 (dashboard layout / /app entry resolution):
 *   const { user, memberships } = await getCurrentUserAndMemberships();
 * `user` is the Supabase Auth user (JWT-backed) or null when signed out.
 * `memberships` is exactly what W1's `getMyMemberships(client, userId)`
 * returns ([] when signed out). Callers branch on `memberships.length`:
 * 0 memberships after sign-in means "send them to /onboarding".
 */
export async function getCurrentUserAndMemberships() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, memberships: [] as Awaited<ReturnType<typeof getMyMemberships>> };
  const memberships = await getMyMemberships(supabase, user.id);
  return { user, memberships };
}

/** Sign in with email + password. Success → redirect to `next` (default
 *  /app); a signed-in user with no business goes to /onboarding instead,
 *  unless `next` already points somewhere specific. */
export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Enter your password.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: friendlyAuthError(error.message) };

  const next = safeNext(formData.get("next"));
  if (next === "/app" && data.user) {
    const memberships = await getMyMemberships(supabase, data.user.id);
    if (memberships.length === 0) redirect("/onboarding");
  }
  redirect(next);
}

/** Create an auth user (email + password). Live config has
 *  mailer_autoconfirm = FALSE: when the backend returns no session, the
 *  caller shows the "check your email to confirm" state and onboarding
 *  resumes after the first real sign-in — we never fake a session. */
export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  businessName?: string;
}): Promise<AuthActionState> {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter your name.").max(120),
      email: emailSchema,
      password: passwordSchema,
      businessName: z.string().trim().max(120).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: parsed.data.name },
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };

  // Carry the business name typed here into onboarding (cookie, 1 hour —
  // long enough for the confirm-email round trip in the common case; the
  // onboarding form simply starts blank if it has expired).
  if (parsed.data.businessName) {
    const cookieStore = await cookies();
    cookieStore.set(PENDING_BUSINESS_COOKIE, parsed.data.businessName, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
  }

  if (!data.session) {
    return { needsConfirmation: true, email: parsed.data.email };
  }
  // Autoconfirm environments only: a real session exists, go set up.
  redirect("/onboarding");
}

/** Sign out and go home. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Email a password-reset link. The link lands on /auth/callback, which
 *  exchanges the code and forwards to /reset-password. */
export async function requestPasswordReset(email: string): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }
  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { resetSent: true, email: parsed.data };
}

/** Email a magic sign-in link (passwordless). Existing accounts only —
 *  `shouldCreateUser: false` so this never silently registers anyone. The
 *  link lands on /auth/callback and then /app. */
export async function sendMagicLink(email: string): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }
  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=/app`,
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { magicLinkSent: true, email: parsed.data };
}

/** Set a new password. Runs on /reset-password where the session comes from
 *  the recovery link (already exchanged in /auth/callback). */
export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "The two passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "This reset link has expired or was already used. Request a new one and use the newest email.",
    };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/app");
}
