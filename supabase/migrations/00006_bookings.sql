-- 00006_bookings.sql — bookings + the anti-double-booking EXCLUDE constraint.
--
-- Run order: after 00005. Requires btree_gist (uuid equality inside the
-- GiST exclusion constraint). Attaches the customer-counters trigger whose
-- function was defined in 00005.

create extension if not exists btree_gist with schema extensions;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null references public.services (id),
  staff_id uuid not null references public.staff (id),
  customer_id uuid not null references public.customers (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'confirmed'
    check (status in ('pending','payment_pending','payment_failed','confirmed','completed','cancelled','no_show')),
  price_cents integer not null check (price_cents >= 0),
  hold_expires_at timestamptz,
  idempotency_key text unique,
  customer_notes text not null default '',
  internal_notes text not null default '',
  manage_token_hash text not null unique,
  manage_token_expires_at timestamptz not null,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  rescheduled_from_id uuid references public.bookings (id),
  source text not null default 'online' check (source in ('online','phone','walk_in','dashboard')),
  created_at timestamptz not null default now()
);

-- Anti-double-booking: no two live bookings for the same staff member may
-- overlap in time. 'pending' and 'payment_pending' rows block the range too
-- (hold-then-pay race safety); failed/cancelled/completed/no_show rows do not.
alter table public.bookings
  add constraint no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status in ('pending','payment_pending','confirmed'));

create index bookings_business_id_idx on public.bookings (business_id);
create index bookings_staff_starts_idx on public.bookings (staff_id, starts_at);
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_manage_token_hash_idx on public.bookings (manage_token_hash);

-- Attach the customer visit/no-show counter trigger (function in 00005).
create trigger bookings_update_customer_counters
  after insert or update of status, customer_id or delete on public.bookings
  for each row execute function public.update_customer_counters();
