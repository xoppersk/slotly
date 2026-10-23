-- 00017_service_staff_public.sql — public service→staff mapping view.
--
-- Run order: after 00009 (public views + RLS). STATUS: written by the v2
-- production pass (W1) — NOT YET APPLIED to the live database; the
-- coordinator arranges application. The app codes against this view and
-- degrades to an empty mapping until it exists.
--
-- Why: the base `service_staff` table has NO anon policy (00009 — owner
-- CRUD, member select only), and the three *_public views carry no link
-- between services and staff. A public booking page therefore cannot tell
-- which staff offer a given service (v1's public pages never joined them;
-- only the get_availability() SECURITY DEFINER function's `staff` array
-- exposes it, one service at a time). This view closes that gap with the
-- same whitelisting discipline as 00009: SECURITY DEFINER view
-- (security_invoker = false), only id columns, only pairs where BOTH the
-- service and the staff member are active, only for businesses whose
-- booking page is enabled.

create view public.service_staff_public with (security_invoker = false) as
select
  ss.service_id,
  ss.staff_id,
  s.business_id
from public.service_staff ss
join public.services s on s.id = ss.service_id and s.is_active = true
join public.staff st on st.id = ss.staff_id and st.is_active = true
join public.businesses b
  on b.id = s.business_id and b.booking_page_enabled = true;

grant select on public.service_staff_public to anon, authenticated;
