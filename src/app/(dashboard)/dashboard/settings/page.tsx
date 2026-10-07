import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";

import { SettingsClient, type RefundRow } from "./settings-client";

/** Stripe test-mode status from env presence only — never leaks key values. */
function stripeConfigured(): boolean {
  try {
    const env = getEnv();
    return Boolean(
      env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    );
  } catch {
    return false;
  }
}

export default async function SettingsPage() {
  const gate = await requireOwner();
  if (!gate.ok) {
    if (gate.reason === "signed-out") redirect("/auth/sign-in");
    if (gate.reason === "no-business") redirect("/onboarding");
    redirect("/dashboard");
  }

  const { business } = gate.ctx;
  const supabase = await createClient();

  const { data: refundRows } = await supabase
    .from("refunds")
    .select("id, amount_cents, reason, status, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const refunds: RefundRow[] = (refundRows ?? []).map((r) => ({
    id: r.id,
    amount_cents: r.amount_cents,
    reason: r.reason,
    status: r.status,
    created_at: r.created_at,
  }));

  return (
    <SettingsClient
      business={business}
      refunds={refunds}
      stripeConfigured={stripeConfigured()}
    />
  );
}
