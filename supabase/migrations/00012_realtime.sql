-- 00012_realtime.sql — realtime publication membership.
--
-- Run order: last. Enables row-level replication for the three tables the
-- dashboard subscribes to. Replica identity FULL so UPDATEs and DELETEs also
-- replicate (the default index would only carry the PK for deletes).
-- RLS still gates which rows each client receives: subscribe with
-- `filter: business_id=eq.<id>` and the 00009 policies decide visibility.
--
-- The lightweight "slot just taken" UX for the public booking wizard uses a
-- `booking_events` broadcast channel (no row data), which needs no migration.

alter table public.bookings replica identity full;
alter table public.staff_time_off replica identity full;
alter table public.availability_overrides replica identity full;

alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.staff_time_off;
alter publication supabase_realtime add table public.availability_overrides;
