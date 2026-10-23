"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeading } from "@/components/sl/shells/BookingShell";
import { Button } from "@/components/sl/Button";
import {
  flowQuery,
  useBookingFlow,
  useHoldExpiryRedirect,
} from "../../_flow/BookingFlow";
import { FlowShell } from "../../_flow/Shell";
import { FlowSummary } from "../../_flow/Summary";

/** Step 4 — real customer details. Validation mirrors create_booking in
    PostgreSQL: name required, and at least one of phone/email
    (`customer_contact_required`). No prefilled fixture person. */
function Inner() {
  const flow = useBookingFlow();
  const router = useRouter();
  const d = flow.details;
  const [error, setError] = useState<string | null>(null);
  useHoldExpiryRedirect(true);

  // No slot chosen → back to Time (nothing to attach details to).
  useEffect(() => {
    if (flow.hydrated && !flow.startsAt) {
      router.replace(`${flow.base}/book/time${flowQuery(flow)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.hydrated, flow.startsAt]);

  const staffName = flow.barber?.name ?? "the shop";
  const next = () => {
    if (!d.firstName.trim() || !d.lastName.trim()) {
      setError("Please add your first and last name.");
      return;
    }
    if (!d.email.trim() && !d.mobile.trim()) {
      setError(
        "Add an email or a mobile number — the shop needs one way to reach you, and your booking link goes there.",
      );
      return;
    }
    if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) {
      setError("That email doesn't look right — check it and try again.");
      return;
    }
    setError(null);
    router.push(`${flow.base}/book/deposit${flowQuery(flow)}`);
  };

  return (
    <FlowShell step={4}>
      <div className="sl-b-main">
        <StepHeading step={4} title="Your details" />
        <p className="sl-b-lead">
          So {staffName} knows who&rsquo;s coming and we can send your
          confirmation.
        </p>
        <div className="sl-b-grid">
          <form
            id="details-form"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="sl-b-field">
                <label htmlFor="fn">First name</label>
                <input
                  id="fn"
                  className="sl-b-input"
                  value={d.firstName}
                  onChange={(e) => flow.setDetails({ firstName: e.target.value })}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="sl-b-field">
                <label htmlFor="ln">Last name</label>
                <input
                  id="ln"
                  className="sl-b-input"
                  value={d.lastName}
                  onChange={(e) => flow.setDetails({ lastName: e.target.value })}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="sl-b-field">
              <label htmlFor="em">Email</label>
              <input
                id="em"
                type="email"
                className="sl-b-input"
                value={d.email}
                onChange={(e) => flow.setDetails({ email: e.target.value })}
                autoComplete="email"
              />
              <p className="hint">
                Your confirmation and the link to change your booking go here.
              </p>
            </div>
            <div className="sl-b-field">
              <label htmlFor="mo">Mobile number</label>
              <input
                id="mo"
                className="sl-b-input"
                value={d.mobile}
                onChange={(e) => flow.setDetails({ mobile: e.target.value })}
                autoComplete="tel"
              />
              <p className="hint">
                Only used for a reminder and if the shop needs to reach you.
                Email or mobile — at least one is needed.
              </p>
            </div>
            <div className="sl-b-field">
              <label htmlFor="no">Note for {staffName} (optional)</label>
              <textarea
                id="no"
                className="sl-b-input"
                rows={3}
                value={d.note}
                onChange={(e) => flow.setDetails({ note: e.target.value })}
              />
            </div>
            <label className="sl-b-check">
              <input
                type="checkbox"
                checked={d.reminder}
                onChange={(e) => flow.setDetails({ reminder: e.target.checked })}
              />
              <span>Remind me the day before my visit</span>
            </label>
            {error ? (
              <p role="alert" style={{ marginTop: 14, fontSize: 14, color: "var(--oxblood)", fontWeight: 600 }}>
                {error}
              </p>
            ) : null}
          </form>
          <div className="sl-b-side">
            <FlowSummary
              ctaNode={
                <Button variant="linen" type="submit" form="details-form">
                  Continue to deposit
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </FlowShell>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
