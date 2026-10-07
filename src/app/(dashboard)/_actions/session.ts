"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Persist the active business (used by the switcher + `?b=` deep links). */
export async function setActiveBusiness(businessId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Only persist businesses the user actually belongs to.
  const { data } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return;

  const cookieStore = await cookies();
  cookieStore.set("slotly_business", businessId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
}

/** Sign out of the dashboard and return to the sign-in screen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
