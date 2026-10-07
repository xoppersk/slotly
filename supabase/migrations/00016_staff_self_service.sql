-- 00016_staff_self_service.sql — staff self-service on their own profile.
--
-- Run order: after 00015. Staff already read staff rows
-- (staff_member_select, 00009) and insert/select their own time-off
-- requests (staff_time_off_own_*, 00009). This adds an UPDATE policy so a
-- staff member can edit their own staff profile row (name, title, bio,
-- specialties, phone); the app layer whitelists exactly those columns in
-- its UPDATE statement, so is_active / notify_* flags stay owner-only.
-- Owners keep full control via staff_owner_all (00009).

create policy staff_own_update on public.staff
  for update to authenticated
  using (id = public.own_staff_id(business_id))
  with check (id = public.own_staff_id(business_id));
