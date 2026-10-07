-- 00001_businesses.sql — businesses table + shared updated_at trigger.
--
-- Run order: first. Depends on: pgcrypto (uuid generation), auth.users
-- (Supabase Auth schema, present on every Supabase project).

create extension if not exists pgcrypto with schema extensions;

-- Generic trigger: keep updated_at fresh on UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text not null default '',
  logo_url text,
  cover_url text,
  timezone text not null default 'UTC',
  phone text,
  email text,
  address text,
  accent_color text not null default 'teal'
    check (accent_color in ('teal','blue','green','amber','rose','violet','slate')),
  booking_page_enabled boolean not null default true,
  min_lead_time_minutes integer not null default 120 check (min_lead_time_minutes >= 0),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  slot_step_minutes integer not null default 15 check (slot_step_minutes in (5,10,15,20,30,60)),
  free_cancel_hours integer not null default 4 check (free_cancel_hours >= 0),
  stripe_account_id text,
  payments_enabled boolean not null default false,
  reminder_24h_enabled boolean not null default true,
  reminder_2h_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_id_idx on public.businesses (owner_id);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();
