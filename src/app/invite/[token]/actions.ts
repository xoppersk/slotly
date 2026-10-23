"use server";
/* Invite accept (PROD-W4): calls the accept_staff_invite SECURITY
 * DEFINER RPC (migration 00015) as the signed-in user, then routes by
 * the invite's role — owners to the dashboard, staff to their agenda. */
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(token: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
  }
  const { data: invite } = await supabase.rpc("get_staff_invite", { p_token: token });
  const role = (invite as { role?: string } | null)?.role ?? "staff";
  const { data, error } = await supabase.rpc("accept_staff_invite", { p_token: token });
  const accepted = (data as { accepted?: boolean } | null)?.accepted === true;
  if (error || !accepted) {
    redirect(`/invite/${token}?error=accept`);
  }
  redirect(role === "owner" ? "/app" : "/staff");
}
