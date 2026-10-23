#!/usr/bin/env node
/**
 * proof-isolation.mjs — two-account isolation proof for Slotly.
 *
 * Proves, against the LIVE PostgreSQL database (project nqqmlhqrjjapqranfdcl)
 * with real JWTs, that Row Level Security keeps two business owners apart:
 *
 *   Owners A and B register via Supabase Auth (mailer_autoconfirm = FALSE —
 *   a fresh sign-up returns NO session until the email link is confirmed).
 *   Once confirmed, each owner runs the same onboarding RPC the app uses
 *   (create_business_setup, migration 00014), adds a service + staff via
 *   PostgREST under their own JWT, and the script asserts:
 *
 *     A-side: A reads only A's businesses/services/bookings.
 *     B-side: B reads none of A's (even with an explicit business_id filter).
 *     Anon:   zero rows from the bookings/customers base tables; only the
 *             whitelisted *_public views are readable.
 *     Booking: an anonymous visitor books A's public page via the
 *             create_booking SECURITY DEFINER RPC; the booking then appears
 *             in A's owner booking list and NOT in B's.
 *
 * CONFIRMATION WALL: if sign-up yields no session, every anon-side
 * assertion still runs and the script prints exactly where it stopped and
 * which registered emails need confirmation. Re-run the script after the
 * accounts are confirmed — it signs in with the stored passwords and
 * completes the full proof (setup is skipped for businesses that exist).
 *
 * Passwords are generated once and stored ONLY in
 * ~/workspace/slotly-v2-audit/proofs/credentials.local.json (outside the
 * repo). They are never printed.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CREDS_PATH = path.join(os.homedir(), "workspace", "slotly-v2-audit", "proofs", "credentials.local.json");
const OWNERS = [
  { key: "a", email: "xoppersk+slotly-a@gmail.com", businessName: "Proof Studio A", slugPrefix: "proof-a" },
  { key: "b", email: "xoppersk+slotly-b@gmail.com", businessName: "Proof Studio B", slugPrefix: "proof-b" },
];
const WEEKLY_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday, is_closed: false, open_time: "09:00", close_time: "17:00",
}));

// ---------------------------------------------------------------------------
// Small framework
// ---------------------------------------------------------------------------

const results = [];
function record(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}
const pass = (n, d) => record(n, "PASS", d);
const fail = (n, d) => record(n, "FAIL", d);
const blocked = (n, d) => record(n, "BLOCKED", d);
const info = (n, d) => record(n, "INFO", d);

function loadPublicEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const url = text.match(/^NEXT_PUBLIC_SUPABASE_URL=(\S+)$/m)?.[1];
  const anonKey = text.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)$/m)?.[1];
  if (!url || !anonKey) throw new Error("URL/anon key not found in .env.local");
  return { base: url.replace(/\/$/, ""), anonKey };
}

function loadOrCreateCredentials() {
  if (fs.existsSync(CREDS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
  }
  const gen = () => `Sl!${crypto.randomBytes(15).toString("base64url")}9a`;
  const creds = {
    note: "Slotly isolation-proof throwaway accounts. Passwords live ONLY here; never printed in logs/reports.",
    owners: OWNERS.map((o) => ({ key: o.key, email: o.email, password: gen() })),
  };
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  return creds;
}

// ---------------------------------------------------------------------------
// HTTP helpers (PostgREST + Auth REST; JWTs carried per-request)
// ---------------------------------------------------------------------------

async function rest(base, anonKey, token, pathAndQuery, init = {}) {
  const res = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function rpc(base, anonKey, token, fn, args) {
  return rest(base, anonKey, token, `rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

async function authPost(base, anonKey, pathAndQuery, payload, token) {
  const res = await fetch(`${base}/auth/v1/${pathAndQuery}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token ?? anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Auth: sign in if possible, otherwise sign up and report the wall
// ---------------------------------------------------------------------------

async function obtainSession(base, anonKey, owner, password) {
  const signIn = await authPost(base, anonKey, "token?grant_type=password", {
    email: owner.email, password,
  });
  if (signIn.status === 200 && signIn.body?.access_token) {
    return { session: signIn.body, state: "signed-in" };
  }
  const signInMsg = String(signIn.body?.msg ?? signIn.body?.message ?? "");
  if (/email not confirmed/i.test(signInMsg)) {
    return { session: null, state: "awaiting-confirmation", detail: signInMsg };
  }
  // Not registered yet (or password drift) → attempt sign-up.
  const signUp = await authPost(base, anonKey, "signup", {
    email: owner.email, password, data: { full_name: `Proof Owner ${owner.key.toUpperCase()}` },
  });
  if (signUp.status === 200 && signUp.body?.access_token) {
    return { session: signUp.body, state: "signed-up-autoconfirmed" };
  }
  if (signUp.status === 200 && signUp.body?.id) {
    // User row created (or obfuscated repeat sign-up) but NO session:
    // mailer_autoconfirm = FALSE → confirmation email is the wall.
    return { session: null, state: "awaiting-confirmation", detail: "sign-up accepted, no session returned" };
  }
  return { session: null, state: "error", detail: `sign-in ${signIn.status} (${signInMsg}); sign-up ${signUp.status} ${JSON.stringify(signUp.body).slice(0, 200)}` };
}

// ---------------------------------------------------------------------------
// Owner setup: business via the app's own onboarding RPC + service + staff
// ---------------------------------------------------------------------------

async function ensureBusiness(base, anonKey, session, owner) {
  const token = session.access_token;
  const userId = session.user.id;
  const memberships = await rest(base, anonKey, token, `business_members?select=business_id,role,business:businesses(id,name,slug)&user_id=eq.${userId}`);
  const rows = Array.isArray(memberships.body) ? memberships.body : [];
  if (rows.length > 0 && rows[0].business) {
    return rows[0].business;
  }
  const slug = `${owner.slugPrefix}-${crypto.randomBytes(3).toString("hex")}`;
  const created = await rpc(base, anonKey, token, "create_business_setup", {
    p_name: owner.businessName,
    p_slug: slug,
    p_timezone: "UTC",
    p_service_name: "Proof Cut",
    p_service_duration_minutes: 30,
    p_service_price_cents: 1500,
    p_weekly_hours: WEEKLY_HOURS,
  });
  if (created.status !== 200 || typeof created.body !== "string") {
    throw new Error(`create_business_setup for ${owner.email} → ${created.status}: ${JSON.stringify(created.body).slice(0, 300)}`);
  }
  return { id: created.body, name: owner.businessName, slug };
}

async function ensureServiceAndStaff(base, anonKey, session, business, owner) {
  const token = session.access_token;
  const extraName = `Proof Extra ${owner.key.toUpperCase()}`;
  const existing = await rest(base, anonKey, token, `services?select=id,name&business_id=eq.${business.id}`);
  const mine = Array.isArray(existing.body) ? existing.body : [];
  if (!mine.some((s) => s.name === extraName)) {
    const ins = await rest(base, anonKey, token, "services", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        business_id: business.id, name: extraName, duration_minutes: 30,
        price_cents: 1500, deposit_cents: 0, payment_policy: "none", sort_order: 9,
      }),
    });
    if (ins.status !== 201) throw new Error(`extra service insert (${owner.key}) → ${ins.status}: ${JSON.stringify(ins.body).slice(0, 200)}`);
  }
  const services = (await rest(base, anonKey, token, `services?select=id,name&business_id=eq.${business.id}`)).body ?? [];
  const setupService = services.find((s) => s.name === "Proof Cut") ?? services[0];

  const staffName = `Proof Barber ${owner.key.toUpperCase()}`;
  const staffRows = (await rest(base, anonKey, token, `staff?select=id,name&business_id=eq.${business.id}`)).body ?? [];
  let staff = staffRows.find((s) => s.name === staffName);
  if (!staff) {
    const ins = await rest(base, anonKey, token, "staff", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ business_id: business.id, name: staffName, title: "Barber" }),
    });
    if (ins.status !== 201) throw new Error(`staff insert (${owner.key}) → ${ins.status}: ${JSON.stringify(ins.body).slice(0, 200)}`);
    staff = ins.body[0];
  }
  if (setupService && staff) {
    await rest(base, anonKey, token, "service_staff", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ service_id: setupService.id, staff_id: staff.id }),
    });
  }
  return { services, setupService, staff };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { base, anonKey } = loadPublicEnv();
  const creds = loadOrCreateCredentials();
  const credFor = (key) => creds.owners.find((o) => o.key === key);

  console.log("=== Slotly two-account isolation proof ===");
  console.log(`Project: ${new URL(base).hostname.split(".")[0]} · credentials file: ${CREDS_PATH} (passwords not printed)`);

  // ---- Anon-side assertions (always runnable) -----------------------------
  const anonBookings = await rest(base, anonKey, anonKey, "bookings?select=id&limit=5");
  if (anonBookings.status === 200 && Array.isArray(anonBookings.body) && anonBookings.body.length === 0) {
    pass("ANON-1 anon reads zero rows from bookings base table", "Row Level Security denies anon (200, [])");
  } else {
    fail("ANON-1 anon reads zero rows from bookings base table", `status ${anonBookings.status}, body ${JSON.stringify(anonBookings.body).slice(0, 200)}`);
  }

  const anonCustomers = await rest(base, anonKey, anonKey, "customers?select=id&limit=5");
  if (anonCustomers.status === 200 && Array.isArray(anonCustomers.body) && anonCustomers.body.length === 0) {
    pass("ANON-2 anon reads zero rows from customers base table", "200, []");
  } else {
    fail("ANON-2 anon reads zero rows from customers base table", `status ${anonCustomers.status}, body ${JSON.stringify(anonCustomers.body).slice(0, 200)}`);
  }

  const anonBiz = await rest(base, anonKey, anonKey, "businesses_public?select=id,slug");
  if (anonBiz.status === 200 && Array.isArray(anonBiz.body) && anonBiz.body.some((b) => b.slug === "harbor-and-pine")) {
    pass("ANON-3 anon reads public businesses via businesses_public only", `${anonBiz.body.length} public business(es)`);
  } else {
    fail("ANON-3 anon reads public businesses via businesses_public only", `status ${anonBiz.status}`);
  }

  const anonBizBase = await rest(base, anonKey, anonKey, "businesses?select=id&limit=5");
  if (anonBizBase.status === 200 && Array.isArray(anonBizBase.body) && anonBizBase.body.length === 0) {
    pass("ANON-4 anon reads zero rows from businesses base table", "public data comes only via the *_public views");
  } else {
    fail("ANON-4 anon reads zero rows from businesses base table", `status ${anonBizBase.status}, rows ${Array.isArray(anonBizBase.body) ? anonBizBase.body.length : "?"}`);
  }

  const ssp = await rest(base, anonKey, anonKey, "service_staff_public?select=*&limit=1");
  info("MIGRATION-00017 service_staff_public probe", ssp.status === 200 ? "APPLIED (200)" : `NOT APPLIED (${ssp.status}${ssp.body?.code ? ` ${ssp.body.code}` : ""})`);

  // ---- Owner sessions -------------------------------------------------------
  const sessions = {};
  for (const owner of OWNERS) {
    const { session, state, detail } = await obtainSession(base, anonKey, owner, credFor(owner.key).password);
    sessions[owner.key] = session;
    info(`AUTH owner ${owner.key.toUpperCase()} (${owner.email})`, `${state}${detail ? ` — ${detail}` : ""}`);
  }

  const confirmed = OWNERS.filter((o) => sessions[o.key]);
  if (confirmed.length < OWNERS.length) {
    const missing = OWNERS.filter((o) => !sessions[o.key]).map((o) => o.email).join(", ");
    blocked("OWNER-SETUP create_business_setup + service/staff per owner", `email-confirmation wall (mailer_autoconfirm=FALSE); unconfirmed: ${missing}`);
    blocked("ISO-A A reads only A's businesses/services/bookings", "needs confirmed owner JWTs");
    blocked("ISO-B B reads none of A's businesses/services/bookings", "needs confirmed owner JWTs");
    blocked("BOOKING anon create_booking on A's public page → visible to A, invisible to B", "needs A's confirmed business + staff; note Harbor & Pine also cannot take a proof booking yet — it has zero staff until the seed runs");
    summarize();
    return;
  }

  // ---- Full isolation flow --------------------------------------------------
  const ctx = {};
  for (const owner of OWNERS) {
    const business = await ensureBusiness(base, anonKey, sessions[owner.key], owner);
    const { services, setupService, staff } = await ensureServiceAndStaff(base, anonKey, sessions[owner.key], business, owner);
    ctx[owner.key] = { business, services, setupService, staff };
    info(`SETUP owner ${owner.key.toUpperCase()}`, `business ${business.id} (${business.slug}), ${services.length} services, staff ${staff?.name ?? "?"}`);
  }
  const A = ctx.a, B = ctx.b;
  const tokA = sessions.a.access_token, tokB = sessions.b.access_token;

  const aBiz = await rest(base, anonKey, tokA, "businesses?select=id");
  const aBizIds = (aBiz.body ?? []).map((r) => r.id);
  if (aBizIds.length >= 1 && aBizIds.every((id) => id === A.business.id)) {
    pass("ISO-A1 A reads only A's business via base table", `rows: ${aBizIds.join(", ")}`);
  } else {
    fail("ISO-A1 A reads only A's business via base table", `A saw: ${JSON.stringify(aBizIds)} (own: ${A.business.id}, B's: ${B.business.id})`);
  }

  const bBiz = await rest(base, anonKey, tokB, "businesses?select=id");
  const bBizIds = (bBiz.body ?? []).map((r) => r.id);
  if (bBizIds.length >= 1 && bBizIds.every((id) => id === B.business.id) && !bBizIds.includes(A.business.id)) {
    pass("ISO-B1 B reads only B's business; none of A's", `rows: ${bBizIds.join(", ")}`);
  } else {
    fail("ISO-B1 B reads only B's business; none of A's", `B saw: ${JSON.stringify(bBizIds)}`);
  }

  const aSvcOnB = await rest(base, anonKey, tokA, `services?select=id&business_id=eq.${B.business.id}`);
  if (aSvcOnB.status === 200 && Array.isArray(aSvcOnB.body) && aSvcOnB.body.length === 0) {
    pass("ISO-A2 A querying B's services by explicit business_id gets zero rows", "RLS blocks the cross-read");
  } else {
    fail("ISO-A2 A querying B's services by explicit business_id gets zero rows", `status ${aSvcOnB.status}, rows ${JSON.stringify(aSvcOnB.body).slice(0, 200)}`);
  }

  const bSvcOnA = await rest(base, anonKey, tokB, `services?select=id&business_id=eq.${A.business.id}`);
  if (bSvcOnA.status === 200 && Array.isArray(bSvcOnA.body) && bSvcOnA.body.length === 0) {
    pass("ISO-B2 B querying A's services by explicit business_id gets zero rows", "RLS blocks the cross-read");
  } else {
    fail("ISO-B2 B querying A's services by explicit business_id gets zero rows", `status ${bSvcOnA.status}, rows ${JSON.stringify(bSvcOnA.body).slice(0, 200)}`);
  }

  const aAllBookings = await rest(base, anonKey, tokA, "bookings?select=id,business_id");
  const aForeign = (aAllBookings.body ?? []).filter((r) => r.business_id !== A.business.id);
  if (Array.isArray(aAllBookings.body) && aForeign.length === 0) {
    pass("ISO-A3 A's unfiltered bookings read contains only A's rows", `${aAllBookings.body.length} row(s), all business_id = A`);
  } else {
    fail("ISO-A3 A's unfiltered bookings read contains only A's rows", `foreign rows: ${JSON.stringify(aForeign).slice(0, 200)}`);
  }

  // ---- Real anonymous booking on A's public page ----------------------------
  try {
    if (!A.setupService || !A.staff) throw new Error("A has no service/staff to book");
    const avail = await rpc(base, anonKey, anonKey, "get_availability", {
      p_business_id: A.business.id, p_service_id: A.setupService.id,
    });
    if (avail.status !== 200) throw new Error(`get_availability → ${avail.status}: ${JSON.stringify(avail.body).slice(0, 200)}`);
    const staffIds = (avail.body.staff ?? []).map((s) => s.id);
    if (!staffIds.includes(A.staff.id)) throw new Error(`get_availability staff ${JSON.stringify(staffIds)} does not include A's proof staff`);
    // Next open weekday at open_time (business tz UTC), ≥ tomorrow so the
    // 120-minute minimum lead time always holds; duration from the service.
    const duration = A.setupService ? 30 : 30;
    let slot = null;
    for (let d = 1; d <= 10 && !slot; d++) {
      const date = new Date(Date.now() + d * 86400000);
      const rule = (avail.body.rules ?? []).find((r) => r.weekday === date.getUTCDay() && !r.is_closed && r.staff_id === null);
      if (!rule) continue;
      const [oh, om] = rule.open_time.split(":").map(Number);
      const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), oh, om));
      slot = { start, end: new Date(start.getTime() + duration * 60000) };
    }
    if (!slot) throw new Error("no open rule found in the next 10 days");
    const booked = await rpc(base, anonKey, anonKey, "create_booking", {
      p_business_id: A.business.id,
      p_service_id: A.setupService.id,
      p_staff_id: A.staff.id,
      p_starts_at: slot.start.toISOString(),
      p_ends_at: slot.end.toISOString(),
      p_customer_name: "Proof Visitor",
      p_customer_phone: "+1 215 555 0199",
      p_customer_email: "proof.visitor@example.com",
      p_customer_notes: "isolation proof booking",
      p_source: "online",
    });
    if (booked.status !== 200 || !booked.body?.booking?.id) {
      throw new Error(`create_booking → ${booked.status}: ${JSON.stringify(booked.body).slice(0, 300)}`);
    }
    const bookingId = booked.body.booking.id;
    pass("BOOK-1 anon create_booking on A's public page succeeds", `booking ${bookingId}, status ${booked.body.status}`);

    const aList = await rest(base, anonKey, tokA, `bookings?select=id,business_id&business_id=eq.${A.business.id}`);
    if ((aList.body ?? []).some((r) => r.id === bookingId)) {
      pass("BOOK-2 booking appears in A's owner booking list", bookingId);
    } else {
      fail("BOOK-2 booking appears in A's owner booking list", `A's list: ${JSON.stringify(aList.body).slice(0, 200)}`);
    }

    const bListOnA = await rest(base, anonKey, tokB, `bookings?select=id&business_id=eq.${A.business.id}`);
    const bAll = await rest(base, anonKey, tokB, "bookings?select=id,business_id");
    const bSeesIt = (bListOnA.body ?? []).some((r) => r.id === bookingId) || (bAll.body ?? []).some((r) => r.id === bookingId);
    if (!bSeesIt && Array.isArray(bListOnA.body) && bListOnA.body.length === 0) {
      pass("BOOK-3 booking is invisible to B (filtered and unfiltered reads)", "B sees zero of A's bookings");
    } else {
      fail("BOOK-3 booking is invisible to B (filtered and unfiltered reads)", `B filtered rows: ${JSON.stringify(bListOnA.body).slice(0, 200)}`);
    }
  } catch (err) {
    fail("BOOK-* anonymous booking chain", err.message);
  }

  summarize();
}

function summarize() {
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log("\n=== Summary ===");
  console.log(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" · "));
  if (counts.FAIL) {
    console.log("RESULT: FAIL");
    process.exitCode = 1;
  } else if (counts.BLOCKED) {
    console.log("RESULT: PARTIAL — blocked at the email-confirmation wall (see BLOCKED lines).");
  } else {
    console.log("RESULT: PASS");
  }
}

main().catch((err) => {
  console.error(`PROOF CRASHED: ${err.message}`);
  process.exit(2);
});
