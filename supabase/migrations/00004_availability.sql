-- 00004_availability.sql — weekly rules, date overrides, blackout dates, time off.
--
-- Run order: after 00002 (references staff).
--
-- NULL staff_id means "business default" (rules) or "all staff" (overrides).
-- Plain UNIQUE constraints treat NULLs as distinct, so uniqueness with NULL
-- handling is enforced with pairs of partial unique indexes instead.

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid references public.staff (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null check (close_time > open_time),
  is_closed boolean not null default false
);

-- Business-default rule: one row per (business, weekday).
create unique index availability_rules_default_uidx
  on public.availability_rules (business_id, weekday)
  where staff_id is null;

-- Staff-specific rule: one row per (business, staff, weekday).
create unique index availability_rules_staff_uidx
  on public.availability_rules (business_id, staff_id, weekday)
  where staff_id is not null;

create index availability_rules_business_id_idx on public.availability_rules (business_id);

create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid references public.staff (id) on delete cascade,
  date date not null,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  reason text,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

-- All-staff override: one row per (business, date).
create unique index availability_overrides_all_uidx
  on public.availability_overrides (business_id, date)
  where staff_id is null;

-- Staff-specific override: one row per (business, staff, date).
create unique index availability_overrides_staff_uidx
  on public.availability_overrides (business_id, staff_id, date)
  where staff_id is not null;

create index availability_overrides_business_id_idx on public.availability_overrides (business_id);

create table public.blackout_dates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  date date not null,
  reason text,
  unique (business_id, date)
);

create table public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text,
  status text not null default 'approved' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now()
);

create index staff_time_off_staff_id_idx on public.staff_time_off (staff_id);
create index staff_time_off_range_idx on public.staff_time_off (staff_id, starts_at, ends_at);
