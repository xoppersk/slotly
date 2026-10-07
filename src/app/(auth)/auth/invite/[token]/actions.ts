"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions for the staff-invite flow (/auth/invite/[token]).
 *
 * These call the SECURITY DEFINER RPCs `get_staff_invite(p_token)` and
 * `accept_staff_invite(p_token)` (typed in src/lib/supabase/types.ts),
 * implemented by migration 00015_staff_invite_rpcs.sql. The raw token is
 * hashed server-side and only ever travels inside the emailed link.
 */

export interface InviteDetails {
  businessName: string;
  role: string;
  expired: boolean;
}

export async function getInviteDetails(
  token: string
): Promise<{ ok: true; invite: InviteDetails } | { ok: false; code: string }> {
  if (!token || token.length < 20) {
    return { ok: false, code: "invalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_invite", {
    p_token: token,
  });
  if (error) {
    return { ok: false, code: "unavailable" };
  }
  const row = data as unknown as {
    business_name?: string;
    role?: string;
    expired?: boolean;
  } | null;
  if (!row) {
    return { ok: false, code: "not_found" };
  }
  return {
    ok: true,
    invite: {
      businessName: row.business_name ?? "a business",
      role: row.role ?? "staff",
      expired: row.expired === true,
    },
  };
}

export async function acceptInvite(
  token: string
): Promise<{ ok: true } | { ok: false; code: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "not_signed_in" };
  }
  const { data, error } = await supabase.rpc("accept_staff_invite", {
    p_token: token,
  });
  if (error) {
    return { ok: false, code: "unavailable" };
  }
  const row = data as unknown as { accepted?: boolean } | null;
  if (!row || row.accepted !== true) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true };
}
