"use client";

import * as React from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/format";

/**
 * StripePaymentForm — the lazy-loaded (ssr:false) Stripe Payment Element
 * island. `next/dynamic` keeps Stripe.js out of the wizard's initial bundle
 * so the booking page stays light and `next build` works without keys.
 */

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

function PayButton({
  amountCents,
  clientSecret,
  onPaid,
  onProcessing,
}: {
  amountCents: number;
  clientSecret: string;
  onPaid: () => void;
  onProcessing: (processing: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    onProcessing(true);
    setError(null);
    try {
      // Validate the element locally first — surfaces incomplete-card errors
      // without touching the network.
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Check your card details and try again.");
        return;
      }
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });
      if (confirmError) {
        // Declines land here: inline error, hold kept, retry with the same
        // manageToken (idempotency key prevents double charges).
        setError(
          confirmError.message ?? "Your card was declined — no charge was made."
        );
        return;
      }
      if (paymentIntent && paymentIntent.status === "succeeded") {
        onPaid();
      } else {
        // Requires action or processing — the wizard polls the receipt until
        // the webhook confirms; treat as paid and let the poll decide.
        onPaid();
      }
    } finally {
      setBusy(false);
      onProcessing(false);
    }
  };

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="primary"
        size="lg"
        className="tnum w-full"
        disabled={!stripe || busy}
        onClick={pay}
      >
        {busy ? "Processing payment…" : `Pay ${formatCents(amountCents)}`}
      </Button>
    </div>
  );
}

export function StripePaymentForm({
  publishableKey,
  clientSecret,
  amountCents,
  onPaid,
  onProcessing,
}: {
  publishableKey: string;
  clientSecret: string;
  amountCents: number;
  onPaid: () => void;
  onProcessing: (processing: boolean) => void;
}) {
  const stripe = React.useMemo(() => getStripe(publishableKey), [publishableKey]);
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#0E7C6B",
            borderRadius: "8px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      }}
    >
      <div className="rounded-[0.75rem] border border-border bg-card p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <div className="mt-4">
        <PayButton
          amountCents={amountCents}
          clientSecret={clientSecret}
          onPaid={onPaid}
          onProcessing={onProcessing}
        />
      </div>
    </Elements>
  );
}
