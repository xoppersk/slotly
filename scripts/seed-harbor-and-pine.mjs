#!/usr/bin/env node
/**
 * seed-harbor-and-pine.mjs — idempotent seed enrichment for Harbor & Pine.
 *
 * Enriches the live Harbor & Pine Barbershop business
 * (id d4937b12-dd15-463e-9798-2985fd62c37d, PostgreSQL project
 * nqqmlhqrjjapqranfdcl) with the fixture service catalog and staff:
 *
 *   Services (integer cents; payment_policy 'none' — no Stripe keys exist,
 *   so bookings confirm instantly and deposits are due-at-the-shop display):
 *     Signature haircut 4800c dep 2000c 45m · Skin fade 6000c dep 2000c 45m
 *     Beard trim 2800c dep 2000c 30m · Cut + beard 6800c dep 2000c 60m
 *     Line-up 2000c dep 2000c 20m
 *   Staff: Micah, Nia, Andre — plain `staff` rows (migration 00002: staff
 *   have no auth.users FK; a login attaches later via business_members).
 *   All three staff are linked to all five services (15 service_staff rows).
 *
 * IDEMPOTENT: services/staff are upserted by (business_id, name) — inserted
 * when missing, price/duration/deposit/policy refreshed when drifted — and
 * service_staff links use ignore-duplicates. The script NEVER deletes.
 *
 * CREDENTIAL GATE (hard rule): the script refuses to run without one of —
 *   SLOTLY_SERVICE_ROLE_KEY   a service-role JWT whose decoded `ref` claim
 *                             equals the project ref derived from the
 *                             Supabase URL and whose role is service_role.
 *                             A wrong-project key aborts the run.
 *   SLOTLY_OWNER_ACCESS_TOKEN  the Harbor & Pine owner's JWT (access token).
 *                             Writes then flow through the migration-00009
 *                             owner Row Level Security policies; the script
 *                             preflights that the token can read the
 *                             business row and aborts if it cannot.
 * The public URL + anon key are read from .env.local (or env). Key VALUES
 * are never printed.
 *
 * Usage:
 *   SLOTLY_SERVICE_ROLE_KEY=… node scripts/seed-harbor-and-pine.mjs
 *   SLOTLY_OWNER_ACCESS_TOKEN=… node scripts/seed-harbor-and-pine.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUSINESS_ID = "d4937b12-dd15-463e-9798-2985fd62c37d";
const EXPECTED_SLUG = "harbor-and-pine";

const SERVICES = [
  { name: "Signature haircut", description: "Consultation, precision cut, wash, and style.", duration_minutes: 45, price_cents: 4800, deposit_cents: 2000, color: "teal", sort_order: 1 },
  { name: "Skin fade", description: "Seamless zero-to-blend fade with crisp lineup and razor finish.", duration_minutes: 45, price_cents: 6000, deposit_cents: 2000, color: "blue", sort_order: 2 },
  { name: "Beard trim", description: "Beard sculpting, hot lather neckline cleanup, and conditioning oil.", duration_minutes: 30, price_cents: 2800, deposit_cents: 2000, color: "amber", sort_order: 3 },
  { name: "Cut + beard", description: "The full works: signature cut plus beard trim in one sitting.", duration_minutes: 60, price_cents: 6800, deposit_cents: 2000, color: "violet", sort_order: 4 },
  { name: "Line-up", description: "Edge-up and crisp lines to keep a fresh cut sharp.", duration_minutes: 20, price_cents: 2000, deposit_cents: 2000, color: "green", sort_order: 5 },
];

const STAFF = [
  { name: "Micah", title: "Barber", bio: "", specialties: ["Signature haircut", "Skin fade"] },
  { name: "Nia", title: "Barber", bio: "", specialties: ["Signature haircut", "Beard trim"] },
  { name: "Andre", title: "Barber", bio: "", specialties: ["Cut + beard", "Line-up"] },
];

// ---------------------------------------------------------------------------
// Env + credential gate
// ---------------------------------------------------------------------------

function loadPublicEnv() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  if (!url || !anonKey) {
    const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
    const text = fs.readFileSync(envPath, "utf8");
    url ??= text.match(/^NEXT_PUBLIC_SUPABASE_URL=(\S+)$/m)?.[1] ?? null;
    anonKey ??= text.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)$/m)?.[1] ?? null;
  }
  if (!url || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not found (env or .env.local).");
  return { url: url.replace(/\/$/, ""), anonKey };
}

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function resolveWriteCredential(projectRef) {
  const serviceKey = process.env.SLOTLY_SERVICE_ROLE_KEY ?? null;
  if (serviceKey) {
    const claims = decodeJwt(serviceKey);
    if (!claims) throw new Error("SLOTLY_SERVICE_ROLE_KEY is not a decodable JWT. Aborting.");
    if (claims.ref !== projectRef) {
      throw new Error(
        `SLOTLY_SERVICE_ROLE_KEY ref mismatch: key belongs to project "${claims.ref}", this project is "${projectRef}". Refusing to use a wrong-project key.`,
      );
    }
    if (claims.role !== "service_role") {
      throw new Error(`SLOTLY_SERVICE_ROLE_KEY role is "${claims.role}", expected "service_role". Aborting.`);
    }
    return { token: serviceKey, mode: "service-role (bypasses Row Level Security)" };
  }
  const ownerToken = process.env.SLOTLY_OWNER_ACCESS_TOKEN ?? null;
  if (ownerToken) {
    const claims = decodeJwt(ownerToken);
    if (!claims) throw new Error("SLOTLY_OWNER_ACCESS_TOKEN is not a decodable JWT. Aborting.");
    if (claims.ref !== projectRef) {
      throw new Error(
        `SLOTLY_OWNER_ACCESS_TOKEN ref mismatch: token belongs to project "${claims.ref}", this project is "${projectRef}". Aborting.`,
      );
    }
    if (claims.role !== "authenticated") {
      throw new Error(`SLOTLY_OWNER_ACCESS_TOKEN role is "${claims.role}", expected "authenticated". Aborting.`);
    }
    return { token: ownerToken, mode: "owner JWT (writes via owner Row Level Security policies)" };
  }
  throw new Error(
    "No write credential. Set SLOTLY_SERVICE_ROLE_KEY (ref-verified service-role JWT) or " +
      "SLOTLY_OWNER_ACCESS_TOKEN (Harbor & Pine owner JWT). The SQL twin " +
      "scripts/seed-harbor-and-pine.sql can also be run manually in Supabase Studio.",
  );
}

// ---------------------------------------------------------------------------
// PostgREST helpers
// ---------------------------------------------------------------------------

async function rest(base, token, anonKey, pathAndQuery, init = {}) {
  const res = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${pathAndQuery} → ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

/** Upsert-by-name for one table scoped to the business. Returns the row. */
async function upsertByName(base, token, anonKey, table, businessId, desired) {
  const existing = await rest(
    base, token, anonKey,
    `${table}?select=*&business_id=eq.${businessId}&name=eq.${encodeURIComponent(desired.name)}`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    const row = existing[0];
    const patch = {};
    for (const [k, v] of Object.entries(desired)) {
      if (k === "name" || k === "business_id") continue;
      if (JSON.stringify(row[k]) !== JSON.stringify(v)) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) {
      console.log(`  = ${table}: "${desired.name}" already correct (${row.id})`);
      return row;
    }
    const updated = await rest(base, token, anonKey, `${table}?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    console.log(`  ~ ${table}: "${desired.name}" updated (${row.id}) fields: ${Object.keys(patch).join(", ")}`);
    return updated[0];
  }
  const inserted = await rest(base, token, anonKey, table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ business_id: businessId, ...desired }),
  });
  console.log(`  + ${table}: "${desired.name}" inserted (${inserted[0].id})`);
  return inserted[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { url, anonKey } = loadPublicEnv();
  const projectRef = new URL(url).hostname.split(".")[0];
  const { token, mode } = resolveWriteCredential(projectRef);
  console.log(`Project ref: ${projectRef}`);
  console.log(`Write mode: ${mode}`);

  // Preflight: the target business must be the real Harbor & Pine. With a
  // service-role key this reads the base table; with an owner JWT the RLS
  // member policy must return the row, proving the token owns the business.
  const biz = await rest(url, token, anonKey, `businesses?select=id,name,slug&id=eq.${BUSINESS_ID}`);
  if (!Array.isArray(biz) || biz.length !== 1 || biz[0].slug !== EXPECTED_SLUG) {
    throw new Error(
      `Preflight failed: business ${BUSINESS_ID} not readable as "${EXPECTED_SLUG}" with this credential. ` +
        (mode.startsWith("owner")
          ? "The token is not a member/owner of Harbor & Pine."
          : `Got: ${JSON.stringify(biz)}`),
    );
  }
  console.log(`Preflight OK: ${biz[0].name} (${biz[0].slug})`);

  console.log("Services:");
  const serviceRows = [];
  for (const svc of SERVICES) {
    serviceRows.push(
      await upsertByName(url, token, anonKey, "services", BUSINESS_ID, {
        ...svc,
        payment_policy: "none",
        is_active: true,
      }),
    );
  }

  console.log("Staff:");
  const staffRows = [];
  for (const person of STAFF) {
    staffRows.push(
      await upsertByName(url, token, anonKey, "staff", BUSINESS_ID, {
        ...person,
        is_active: true,
      }),
    );
  }

  console.log("Service ↔ staff links:");
  const links = [];
  for (const svc of serviceRows) {
    for (const person of staffRows) {
      links.push({ service_id: svc.id, staff_id: person.id });
    }
  }
  await rest(url, token, anonKey, "service_staff", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(links),
  });
  console.log(`  = ${links.length} links ensured (insert-or-ignore)`);

  // Verification through the ANON public surface (what visitors actually see).
  console.log("Verification (anon public views + get_availability):");
  const pubServices = await rest(url, anonKey, anonKey, `services_public?select=id,name,price_cents,deposit_cents&business_id=eq.${BUSINESS_ID}&order=sort_order`);
  const pubStaff = await rest(url, anonKey, anonKey, `staff_public?select=id,name&business_id=eq.${BUSINESS_ID}`);
  console.log(`  services_public: ${pubServices.length} rows → ${pubServices.map((s) => s.name).join(", ")}`);
  console.log(`  staff_public: ${pubStaff.length} rows → ${pubStaff.map((s) => s.name).join(", ") || "(none)"}`);
  let allStaffed = true;
  for (const svc of serviceRows) {
    const avail = await rest(url, anonKey, anonKey, "rpc/get_availability", {
      method: "POST",
      body: JSON.stringify({ p_business_id: BUSINESS_ID, p_service_id: svc.id }),
    });
    const names = (avail.staff ?? []).map((s) => s.name);
    if (names.length === 0) allStaffed = false;
    console.log(`  get_availability "${svc.name}": staff = [${names.join(", ")}]`);
  }
  if (pubStaff.length < STAFF.length || !allStaffed) {
    throw new Error("Verification FAILED: seeded staff not fully visible through the public surface.");
  }
  console.log("Seed complete and verified. (service_staff_public view may still 404 until migration 00017 is applied — get_availability is the proof path used here.)");
}

main().catch((err) => {
  console.error(`SEED ABORTED: ${err.message}`);
  process.exit(1);
});
