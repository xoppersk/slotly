/* Dashboard layout: AppShell (240px sidebar) + the dashboard stylesheet.
   The shell's owner block is fed with the live user email + business name
   and a real Supabase sign-out action, so every dashboard route carries the
   fix for the missing sign-out control. */
import { AppShell, type AppShellNavKey } from "@/components/sl/shells/AppShell";
import { signOutAction } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import "../../styles/dashboard.css";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in?next=/app");

  const sb = serviceClient();
  const { data: membership } = await sb
    .from("memberships")
    .select("business_id")
    .eq("user_id", data.user.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const [{ data: business }, { data: businesses }] = await Promise.all([
    sb.from("businesses").select("name,slug").eq("id", membership.business_id).single(),
    sb
      .from("businesses")
      .select("id,name,slug")
      .in(
        "id",
        (
          (await sb.from("memberships").select("business_id").eq("user_id", data.user.id)).data?.map(
            (m) => m.business_id,
          ) ?? [membership.business_id],
        ),
      ),
  ]);

  const businessesForShell = (businesses ?? []).map((b) => ({
    id: b.id as string,
    name: (b.name as string) ?? "Business",
    current: b.id === membership.business_id,
  }));

  const signOut = async () => {
    "use server";
    await signOutAction();
  };

  return (
    <AppShell
      ownerEmail={data.user.email ?? "Owner"}
      businessName={(business?.name as string) ?? "Business"}
      businesses={businessesForShell}
      onSignOut={signOut}
      navKey={"today" as AppShellNavKey}
    >
      {children}
    </AppShell>
  );
}
