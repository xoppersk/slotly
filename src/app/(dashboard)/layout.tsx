import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getBusinessMemberships, getCurrentBusiness } from "@/lib/business";

import { DashboardShell } from "./_components/dashboard-shell";

/**
 * Dashboard shell: resolves the active business via getCurrentBusiness()
 * (search-param `?b=` → cookie → first membership). No session → sign-in;
 * session with no membership → onboarding (sibling wave's route).
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getCurrentBusiness();

  if (!ctx) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/onboarding" : "/auth/sign-in");
  }

  const memberships = await getBusinessMemberships();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <DashboardShell
      businessId={ctx.business.id}
      businessName={ctx.business.name}
      role={ctx.membership.role}
      memberships={memberships}
      userEmail={user?.email ?? null}
      userName={(user?.user_metadata?.full_name as string | undefined) ?? null}
    >
      {children}
    </DashboardShell>
  );
}
