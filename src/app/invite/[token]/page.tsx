import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "../../../styles/site.css";
import { AuthChrome } from "../../sign-in/_chrome";
import { Tick } from "../../pricing/_chrome";
import { IconArrowRight, SlotlyMark } from "@/components/sl/icons";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

/* F-06 — Invite accept (PROD-W4): resolves the REAL invite through the
   get_staff_invite RPC (the raw token is the bearer credential; only
   its sha256 hash is stored). Accepting requires sign-in — signed-out
   visitors are routed through /sign-in?next=/invite/<token> and back.
   The fixture page's fake create-account form is gone: accounts are
   created by the real sign-up flow (W2), and accept_staff_invite
   creates the staff profile + membership server-side. */

interface InviteInfo {
  business_name: string;
  role: string;
  email: string;
  expired: boolean;
}

async function fetchInvite(token: string): Promise<InviteInfo | null> {
  if (!token || token.length < 20) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_invite", { p_token: token });
  if (error || !data) return null;
  return data as unknown as InviteInfo;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const invite = await fetchInvite(token);
  return { title: invite ? `Join ${invite.business_name}` : "You're invited" };
}

export default function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense>
      <InviteInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function InviteInner({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const acceptError = sp.error === "accept";
  const invite = await fetchInvite(token);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!invite) {
    return (
      <AuthChrome panel={simplePanel("That invite link is not valid.")} light>
        <h1 className="sl-auth-h1" style={{ fontSize: 52, lineHeight: 0.98 }}>
          This link doesn’t work
        </h1>
        <p className="sl-auth-sub" style={{ marginBottom: 30 }}>
          The invite may have been revoked, or the link was copied incompletely. Ask the business owner for a new one.
        </p>
        <Link href="/" className="sl-pri" style={{ marginTop: 6 }}>
          Go to Slotly <IconArrowRight />
        </Link>
      </AuthChrome>
    );
  }

  const roleLabel = invite.role === "owner" ? "an owner" : "a staff member";
  const mark = invite.business_name.trim().charAt(0).toUpperCase() || "S";

  const panel = (
    <>
      <Link href="/" className="sl-auth2__logo">
        <SlotlyMark />
        <span>Slotly</span>
      </Link>
      <div className="sl-inv-card">
        <span className="sl-inv-mark" aria-hidden="true">
          {mark}
        </span>
        <p className="sl-inv-name">{invite.business_name}</p>
        <ul className="sl-ticks">
          <li>
            <Tick />
            <span>
              <b>You can</b> see your agenda, complete your bookings, book on a customer’s behalf and ask for time off.
            </span>
          </li>
          <li>
            <Tick />
            <span>
              <b>The owner manages</b> prices, shop hours and payouts.
            </span>
          </li>
        </ul>
      </div>
      <span className="sl-auth2__copy">This invite was sent to {invite.email}</span>
    </>
  );

  if (invite.expired) {
    return (
      <AuthChrome panel={panel} light>
        <h1 className="sl-auth-h1" style={{ fontSize: 52, lineHeight: 0.98 }}>
          This invite has expired
        </h1>
        <p className="sl-auth-sub" style={{ marginBottom: 30 }}>
          Invites work for 7 days and stop working once they’ve been used. Ask {invite.business_name} to send a fresh link.
        </p>
        <Link href="/" className="sl-pri" style={{ marginTop: 6 }}>
          Go to Slotly <IconArrowRight />
        </Link>
      </AuthChrome>
    );
  }

  const accept = acceptInvite.bind(null, token);

  return (
    <AuthChrome panel={panel} light>
      <h1 className="sl-auth-h1" style={{ fontSize: 52, lineHeight: 0.98 }}>
        Join {invite.business_name} as {roleLabel}
      </h1>
      <p className="sl-auth-sub" style={{ marginBottom: 30 }}>
        {invite.email} was invited to join the team.
      </p>
      {acceptError ? (
        <p style={{ fontSize: 14, color: "var(--danger, #b3261e)", margin: "0 0 16px" }}>
          That accept didn’t go through — the invite may have just expired. Ask for a new link if it keeps failing.
        </p>
      ) : null}
      {user ? (
        <form className="sl-form" action={accept}>
          <div className="sl-field">
            <label htmlFor="em">Email</label>
            <input id="em" className="sl-inp sl-inp--locked" type="email" value={invite.email} readOnly />
            <span className="sl-hint">You are signed in as {user.email}</span>
          </div>
          <button type="submit" className="sl-pri" style={{ marginTop: 6 }}>
            Accept and join <IconArrowRight />
          </button>
        </form>
      ) : (
        <div className="sl-form">
          <a href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} className="sl-pri" style={{ marginTop: 6 }}>
            Sign in to accept <IconArrowRight />
          </a>
          <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
            New to Slotly?{" "}
            <a href="/sign-up" style={{ fontWeight: 600 }}>
              Create your account
            </a>
            , then open this invite link again to join {invite.business_name}.
          </p>
        </div>
      )}
    </AuthChrome>
  );
}

function simplePanel(message: string) {
  return (
    <>
      <Link href="/" className="sl-auth2__logo">
        <SlotlyMark />
        <span>Slotly</span>
      </Link>
      <span className="sl-auth2__copy">{message}</span>
    </>
  );
}
