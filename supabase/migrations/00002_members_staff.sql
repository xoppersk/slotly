-- 00002_members_staff.sql — staff profiles, business memberships, staff invites.
--
-- Run order: after 00001. staff is created before business_members because
-- business_members.staff_id references staff.id.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  title text,
  bio text not null default '',
  photo_url text,
  specialties text[] not null default '{}',
  is_active boolean not null default true,
  notify_new_booking boolean not null default true,
  notify_cancellation boolean not null default true,
  phone text,
  created_at timestamptz not null default now()
);

create index staff_business_id_idx on public.staff (business_id);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('owner','staff')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index staff_invites_business_id_idx on public.staff_invites (business_id);
