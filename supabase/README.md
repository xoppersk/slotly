# Slotly — PostgreSQL schema

Versioned migrations plus the demo seed. Authorization is PostgreSQL Row
Level Security (RLS), deny-by-default on every table; the anon key only ever
reads through the three `*_public` views or calls the SECURITY DEFINER
functions in `00010`.

## Migration order

| File | Contents |
|---|---|
| `migrations/00001_businesses.sql` | `pgcrypto` extension, `set_updated_at()` trigger, `businesses` |
| `migrations/00002_members_staff.sql` | `staff`, `business_members`, `staff_invites` |
| `migrations/00003_services.sql` | `services` (incl. `payment_policy`/`deposit_cents`), `service_staff` |
| `migrations/00004_availability.sql` | `availability_rules`, `availability_overrides`, `blackout_dates`, `staff_time_off` — partial unique indexes handle NULL `staff_id` |
| `migrations/00005_customers.sql` | `customers` + `update_customer_counters()` trigger function |
| `migrations/00006_bookings.sql` | `btree_gist` extension, `bookings`, the `no_overlap` EXCLUDE constraint, attaches the counters trigger |
| `migrations/00007_payments.sql` | `payments`, `refunds`, `webhook_events` |
| `migrations/00008_notifications.sql` | `notification_log` + reminder idempotency partial unique index |
| `migrations/00009_views_rls.sql` | RLS on, `is_business_member()` / `business_role()` / `own_staff_id()` helpers, `businesses_public` / `services_public` / `staff_public` views, all RLS policies |
| `migrations/00010_functions.sql` | SECURITY DEFINER: `check_slot_bookable()` (internal), `get_availability()`, `create_booking()`, `manage_booking()`, `create_payment_intent()`, `issue_refund()`, `get_booking_receipt()` |
| `migrations/00011_storage.sql` | Storage RLS policies (buckets are created via dashboard/CLI — see note in file) |
| `migrations/00012_realtime.sql` | `supabase_realtime` publication: `bookings`, `staff_time_off`, `availability_overrides` |
| `seed.sql` | "Harbor & Pine Barbershop" demo (not a migration — run manually once) |

## How to apply

With the Supabase CLI linked to a project:

```bash
supabase db push        # applies migrations/00001..00012 in order
```

Or paste each file, in order, into the dashboard SQL editor (each file is
self-contained; extensions use `IF NOT EXISTS` guards).

Seed (run once, after creating a real auth user — see the header of
`seed.sql` for the `v_owner` placeholder):

```bash
supabase db execute -f supabase/seed.sql
```

## Key invariants

- **No double bookings:** the `no_overlap` EXCLUDE constraint on
  `(staff_id, tstzrange(starts_at, ends_at))` covers `pending`,
  `payment_pending`, and `confirmed` rows — the database, not the app,
  is the race-safety guard. `create_booking()` also pre-checks overlaps
  so failures surface as clean errors before the constraint fires.
- **Manage tokens:** 32 random bytes, sha256 stored, 72h expiry, rotated
  after every `manage_booking()` call. Raw tokens are returned once and
  never stored.
- **Refunds:** total refunded per payment (pending + succeeded) can never
  exceed the payment amount — enforced in `issue_refund()`.
- **Reminders:** the partial unique index on
  `notification_log(booking_id, kind)` makes 24h/2h reminder sends
  idempotent.
- **Customers:** `total_visits` / `no_show_count` are maintained by the
  `update_customer_counters()` trigger on `bookings`.
