-- 00009_views_rls.sql — public views, RLS helpers, and every RLS policy.
--
-- Run order: after 00008 (all tables exist). Authorization model: PostgreSQL
-- Row Level Security is deny-by-default on every table. The anon key can only
-- read through the three whitelisted *_public views (SECURITY DEFINER views,
-- i.e. security_invoker = false); everything else goes through member
-- policies or the SECURITY DEFINER functions in 00010.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.staff enable row level security;
alter table public.staff_invites enable row level security;
alter table public.services enable row level security;
alter table public.service_staff enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.blackout_dates enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;
alter table public.notification_log enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER so policies never recurse into
--    business_members RLS; auth.uid() still reads the caller's JWT)
-- ---------------------------------------------------------------------------
create or replace function public.is_business_member(biz uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = biz
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.business_role(biz uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select m.role
  from public.business_members m
  where m.business_id = biz
    and m.user_id = auth.uid();
$$;

-- The staff profile linked to the caller's membership (null when none).
create or replace function public.own_staff_id(biz uuid)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select m.staff_id
  from public.business_members m
  where m.business_id = biz
    and m.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3. Public views (whitelisted columns only; RLS-bypassing so anon gets
--    exactly these columns and nothing else — no direct table access)
-- ---------------------------------------------------------------------------
create view public.businesses_public with (security_invoker = false) as
select
  id, name, slug, description, logo_url, cover_url,
  timezone, phone, address, accent_color
from public.businesses
where booking_page_enabled = true;

create view public.services_public with (security_invoker = false) as
select
  id, business_id, name, description, duration_minutes,
  price_cents, price_display, payment_policy, deposit_cents,
  color, sort_order
from public.services
where is_active = true;

create view public.staff_public with (security_invoker = false) as
select id, business_id, name, title, bio, photo_url, specialties
from public.staff
where is_active = true;

grant select on public.businesses_public to anon, authenticated;
grant select on public.services_public to anon, authenticated;
grant select on public.staff_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS policies
-- ---------------------------------------------------------------------------

-- businesses: public reads go through businesses_public (no anon policy here).
create policy businesses_insert_owner on public.businesses
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy businesses_select_member on public.businesses
  for select to authenticated
  using (public.is_business_member(id));

create policy businesses_update_member on public.businesses
  for update to authenticated
  using (public.is_business_member(id));

-- business_members: owner manages; members can read their own row.
create policy business_members_owner_all on public.business_members
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy business_members_self_select on public.business_members
  for select to authenticated
  using (user_id = auth.uid());

-- staff: public reads go through staff_public; owner full CRUD; staff read-only.
create policy staff_owner_all on public.staff
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy staff_member_select on public.staff
  for select to authenticated
  using (public.is_business_member(business_id));

-- services: public reads go through services_public; owner full CRUD; staff read-only.
create policy services_owner_all on public.services
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy services_member_select on public.services
  for select to authenticated
  using (public.is_business_member(business_id));

-- service_staff: no public access; owner full CRUD; staff read-only.
create policy service_staff_owner_all on public.service_staff
  for all to authenticated
  using (
    public.business_role((select s.business_id from public.staff s where s.id = service_staff.staff_id)) = 'owner'
  )
  with check (
    public.business_role((select s.business_id from public.staff s where s.id = service_staff.staff_id)) = 'owner'
  );

create policy service_staff_member_select on public.service_staff
  for select to authenticated
  using (
    public.is_business_member((select s.business_id from public.staff s where s.id = service_staff.staff_id))
  );

-- availability_rules / availability_overrides / blackout_dates: no public
-- direct access (slot math goes through get_availability); owner full CRUD;
-- staff read-only.
create policy availability_rules_owner_all on public.availability_rules
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy availability_rules_member_select on public.availability_rules
  for select to authenticated
  using (public.is_business_member(business_id));

create policy availability_overrides_owner_all on public.availability_overrides
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy availability_overrides_member_select on public.availability_overrides
  for select to authenticated
  using (public.is_business_member(business_id));

create policy blackout_dates_owner_all on public.blackout_dates
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy blackout_dates_member_select on public.blackout_dates
  for select to authenticated
  using (public.is_business_member(business_id));

-- staff_time_off: owner sees all; staff insert/select their own (requests start pending).
create policy staff_time_off_owner_all on public.staff_time_off
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy staff_time_off_own_select on public.staff_time_off
  for select to authenticated
  using (staff_id = public.own_staff_id(business_id));

create policy staff_time_off_own_insert on public.staff_time_off
  for insert to authenticated
  with check (
    staff_id = public.own_staff_id(business_id)
    and status = 'pending'
  );

-- customers: no public access. Owner/staff SELECT + UPDATE; inserts happen
-- server-side inside create_booking() (SECURITY DEFINER) so repeat-customer
-- matching never exposes records to anon.
create policy customers_member_select on public.customers
  for select to authenticated
  using (public.is_business_member(business_id));

create policy customers_member_update on public.customers
  for update to authenticated
  using (public.is_business_member(business_id));

-- bookings: no public direct access (create via create_booking(), manage via
-- manage_booking()). Owner full CRUD; staff SELECT/UPDATE their own bookings.
create policy bookings_owner_all on public.bookings
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy bookings_staff_select on public.bookings
  for select to authenticated
  using (
    public.is_business_member(business_id)
    and staff_id = public.own_staff_id(business_id)
  );

create policy bookings_staff_update on public.bookings
  for update to authenticated
  using (
    public.is_business_member(business_id)
    and staff_id = public.own_staff_id(business_id)
  );

-- staff_invites / notification_log: owner-only.
create policy staff_invites_owner_all on public.staff_invites
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

create policy notification_log_owner_all on public.notification_log
  for all to authenticated
  using (public.business_role(business_id) = 'owner')
  with check (public.business_role(business_id) = 'owner');

-- payments / refunds: no public direct access (functions in 00010 handle
-- writes). Owner/staff read their business's rows; service role bypasses RLS.
create policy payments_member_select on public.payments
  for select to authenticated
  using (public.is_business_member(business_id));

create policy refunds_member_select on public.refunds
  for select to authenticated
  using (public.is_business_member(business_id));

-- webhook_events: service-role writes (no policy = denied for anon/authed
-- writes); owners get read access for audit visibility.
create policy webhook_events_owner_select on public.webhook_events
  for select to authenticated
  using (business_id is not null and public.is_business_member(business_id));
