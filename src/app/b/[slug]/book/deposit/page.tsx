"use client";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepHeading } from "@/components/sl/shells/BookingShell";
import { Button } from "@/components/sl/Button";
import { formatCents } from "@/lib/format";
import {
  flowQuery,
  useBookingFlow,
  useHoldExpiryRedirect,
} from "../../_flow/BookingFlow";
import { FlowShell } from "../../_flow/Shell";
import { FlowSummary } from "../../_flow/Summary";

/** Step 5 — Deposit, per the coordinator decision: no Stripe keys exist in
    production and seeded services run payment_policy='none', so NOTHING is
    charged online. The step is a due-at-visit acknowledgement: the
    service's deposit_cents is shown as due at the shop, alongside the rest
    of the price. No card inputs, no fake charge. */
function Inner() {
  const flow = useBookingFlow();
  const router = useRouter();
  useHoldExpiryRedirect(true);

  useEffect(() => {
    if (flow.hydrated && !flow.startsAt) {
      router.replace(`${flow.base}/book/time${flowQuery(flow)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.hydrated, flow.startsAt]);

  const svc = flow.service;
  const deposit = svc?.depositCents ?? 0;
  const price = svc?.priceCents ?? 0;
  const rest = Math.max(0, price - deposit);
  const staffName = flow.barber?.name ?? "the shop";

  return (
    <FlowShell step={5}>
      <div className="sl-b-main">
        <StepHeading
          step={5}
          title={
            deposit > 0
              ? `${formatCents(deposit).replace(".00", "")} deposit, due at the shop`
              : "Nothing to pay today"
          }
        />
        <p className="sl-b-lead">
          {deposit > 0
            ? `No card needed today. The ${formatCents(deposit)} deposit holds ${staffName}'s chair and comes off your bill — you pay it, and the ${formatCents(rest)} rest, at the shop.`
            : `No card needed today. You pay the ${formatCents(price)} for your visit at the shop.`}
        </p>
        <div className="sl-b-grid">
          <div className="sl-b-card">
            <dl className="sl-b-kv">
              <dt>{svc?.name ?? "Service"}</dt>
              <dd>{formatCents(price)}</dd>
              {deposit > 0 ? (
                <>
                  <dt>Deposit due at the shop</dt>
                  <dd>{formatCents(deposit)}</dd>
                  <dt>Rest at the shop</dt>
                  <dd>{formatCents(rest)}</dd>
                </>
              ) : null}
              <dt>Charged online today</dt>
              <dd>$0.00</dd>
            </dl>
            <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
              This shop takes payment in person, so there&rsquo;s nothing to
              pay on this page. Your booking is confirmed on the next screen
              the moment you tap Confirm.
            </p>
          </div>
          <div className="sl-b-side">
            <FlowSummary
              showFor
              ctaNode={
                <Button
                  variant="linen"
                  onClick={() =>
                    router.push(`${flow.base}/book/review${flowQuery(flow)}`)
                  }
                >
                  Continue to review
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
