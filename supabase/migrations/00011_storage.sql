-- 00011_storage.sql — storage RLS policies for the public asset buckets.
--
-- Run order: after 00009 (uses is_business_member()).
--
-- NOTE: the buckets themselves (`business-logos`, `staff-photos`) are created
-- via the Supabase dashboard or `supabase storage` CLI — bucket creation is
-- not expressible in plain SQL migrations, so these policies assume the
-- buckets already exist. Object layout: <business_id>/<filename> (business_id
-- is the first path segment). Both buckets are public-read; only members of
-- the owning business can write.

-- Public read on both buckets.
create policy "slotly_public_read_assets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('business-logos', 'staff-photos'));

-- Owners (and staff) of a business manage objects under <business_id>/...
create policy "slotly_member_manage_assets"
  on storage.objects for all
  to authenticated
  using (
    bucket_id in ('business-logos', 'staff-photos')
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_business_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id in ('business-logos', 'staff-photos')
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_business_member(((storage.foldername(name))[1])::uuid)
  );
