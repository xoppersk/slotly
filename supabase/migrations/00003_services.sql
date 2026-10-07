-- 00003_services.sql — services catalog + service_staff link table.
--
-- Run order: after 00002. payment_policy drives the booking flow:
--   'none'    → booking confirms immediately, no payment step
--   'deposit' → deposit_cents collected now, booking held 10 min while paying
--   'full'    → full price_cents collected now

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  price_cents integer not null default 0 check (price_cents >= 0),
  price_display text,
  payment_policy text not null default 'none' check (payment_policy in ('none','deposit','full')),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  color text not null default 'teal',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (deposit_cents <= price_cents)
);

create index services_business_id_idx on public.services (business_id);

create table public.service_staff (
  service_id uuid not null references public.services (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  primary key (service_id, staff_id)
);

create index service_staff_staff_id_idx on public.service_staff (staff_id);
