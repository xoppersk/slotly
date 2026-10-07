import { redirect } from "next/navigation";

import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

import { OnboardingWizard } from "./onboarding-wizard";

/**
 * /onboarding — first-run wizard for signed-in users with no business yet
 * (UI-DESIGN Flow 3). Users who already have a business go to the dashboard.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const ctx = await getCurrentBusiness();
  if (ctx) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <OnboardingWizard />
    </div>
  );
}
