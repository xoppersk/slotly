import type { Metadata } from "next";
import { Suspense } from "react";
import "../../../styles/site.css";
import { AuthChrome } from "../../sign-in/_chrome";
import { Tick } from "../../pricing/_chrome";
import { IconArrowRight, SlotlyMark } from "@/components/sl/icons";
import { getBusiness, getOwner, people } from "@/lib/api";

export const metadata: Metadata = { title: "Join Harbor & Pine" };

/* F-06 — Invite accept: Jules Carter joining Harbor & Pine as a barber.
   The panel is the drawn LIGHT panel with the business card (what barbers
   can do / what Sheku manages); the email is locked to the invited
   address. Any token renders the canon pending invite (fixture). */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense>
      <InviteInner params={params} />
    </Suspense>
  );
}

async function InviteInner({ params }: { params: Promise<{ token: string }> }) {
  await params;
  const business = getBusiness();
  const owner = getOwner();
  const invite = people.pendingInvites[0]!;

  const panel = (
    <>
      <a href="/" className="sl-auth2__logo">
        <SlotlyMark />
        <span>Slotly</span>
      </a>
      <div className="sl-inv-card">
        <span className="sl-inv-mark" aria-hidden="true">
          {business.mark}
        </span>
        <p className="sl-inv-name">{business.name}</p>
        <p className="sl-inv-addr">
          {business.address.street}, {business.address.city}
        </p>
        <ul className="sl-ticks">
          <li>
            <Tick />
            <span>
              <b>You can</b> see your agenda, check customers in, book walk-ins and ask for time off.
            </span>
          </li>
          <li>
            <span className="sl-mono sl-inv-mono" aria-hidden="true">
              S
            </span>
            <span>
              <b>Sheku manages</b> prices, shop hours and payouts.
            </span>
          </li>
        </ul>
      </div>
      <span className="sl-auth2__copy">Invite sent Monday, October 5 · expires in 7 days</span>
    </>
  );

  return (
    <AuthChrome panel={panel} light>
      <h1 className="sl-auth-h1" style={{ fontSize: 52, lineHeight: 0.98 }}>
        Join Harbor &amp; Pine as a barber
      </h1>
      <p className="sl-auth-sub" style={{ marginBottom: 30 }}>
        {owner.name} invited {invite.email}.
      </p>
      <form className="sl-form" action="/staff">
        <div className="sl-field">
          <label htmlFor="nm">Name customers will see</label>
          <input id="nm" className="sl-inp" defaultValue="Jules" />
          <span className="sl-hint">First name is enough</span>
        </div>
        <div className="sl-field">
          <label htmlFor="em">Email</label>
          <input id="em" className="sl-inp sl-inp--locked" type="email" defaultValue={invite.email} readOnly />
        </div>
        <div className="sl-field">
          <label htmlFor="pw">Create a password</label>
          <input id="pw" className="sl-inp" type="password" placeholder="At least 10 characters" autoComplete="new-password" />
        </div>
        <button type="submit" className="sl-pri" style={{ marginTop: 6 }}>
          Join and open my agenda <IconArrowRight />
        </button>
      </form>
      <p style={{ margin: "20px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
        Not Jules? <a href="#">Let Sheku know</a> and ignore this invite.
      </p>
    </AuthChrome>
  );
}
