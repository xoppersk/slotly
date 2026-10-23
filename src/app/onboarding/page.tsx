import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import "../../styles/site.css";
import { AuthChrome, SignPanel } from "../sign-in/_chrome";
import { OnboardingWizard } from "./OnboardingWizard";
import { getCurrentUserAndMemberships } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Set up your business" };

/* Onboarding — steps 1-4 of the drawn sign-up flow (Business → Services →
   Hours → Publish), resumed after the first real sign-in (sign-up requires
   email confirmation, so setup cannot happen in the sign-up request).
   Guards: signed-out → /sign-in?next=/onboarding; already owns a business
   → /app. Submitting Publish calls create_business_setup, which creates
   THIS owner's business, first service and weekly hours — never anyone
   else's. */
export default async function OnboardingPage() {
  const { user, memberships } = await getCurrentUserAndMemberships();
  if (!user) redirect("/sign-in?next=/onboarding");
  if (memberships.length > 0) redirect("/app");

  const cookieStore = await cookies();
  // Mirrors the literal set by signUp in src/lib/auth-actions.ts.
  const pendingBusiness = cookieStore.get("slotly_pending_business")?.value ?? "";
  const ownerName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";

  return (
    <AuthChrome panel={<SignPanel />}>
      <OnboardingWizard ownerName={ownerName} initialBusinessName={pendingBusiness} />
    </AuthChrome>
  );
}
