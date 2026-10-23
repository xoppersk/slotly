-- 00014_create_business_setup.sql — atomic onboarding transaction.
--
-- Run order: after 00013. The onboarding wizard creates the business, the
-- owner's membership, the first service, and the weekly availability rules in
-- one transaction. This MUST be a SECURITY DEFINER function: RLS on
-- business_members requires an existing owner row to insert a membership, so a
-- brand-new business can never bootstrap its own owner membership through
-- plain inserts.
--
-- p_weekly_hours: jsonb array of
--   { "weekday": 0-6 (0 = Sunday), "is_closed": bool,
--     "open_time": "HH:MM", "close_time": "HH:MM" }
-- Closed days are skipped (an absent availability_rules row means "closed" —
-- see the availability engine's resolveWindow).

create or replace function public.create_business_setup(
  p_name text,
  p_slug text,
  p_timezone text,
  p_service_name text,
  p_service_duration_minutes integer,
  p_service_price_cents integer,
  p_weekly_hours jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_business_id uuid;
  v_hour jsonb;
  v_weekday integer;
  v_is_closed boolean;
begin
  if v_owner is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'business_name_required';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]+$' then
    raise exception 'invalid_slug';
  end if;
  if p_service_name is null or btrim(p_service_name) = '' then
    raise exception 'service_name_required';
  end if;
  if p_service_duration_minutes is null
     or p_service_duration_minutes < 5
     or p_service_duration_minutes > 480 then
    raise exception 'invalid_service_duration';
  end if;
  if p_service_price_cents is null or p_service_price_cents < 0 then
    raise exception 'invalid_service_price';
  end if;

  insert into public.businesses (owner_id, name, slug, timezone)
  values (v_owner, btrim(p_name), p_slug, coalesce(nullif(btrim(p_timezone), ''), 'UTC'))
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, v_owner, 'owner');

  insert into public.services
    (business_id, name, duration_minutes, price_cents, sort_order)
  values
    (v_business_id, btrim(p_service_name), p_service_duration_minutes, p_service_price_cents, 0);

  if p_weekly_hours is not null then
    for v_hour in select * from jsonb_array_elements(p_weekly_hours)
    loop
      v_weekday := (v_hour ->> 'weekday')::integer;
      v_is_closed := coalesce((v_hour ->> 'is_closed')::boolean, false);
      -- Closed days: no row (absent row = closed for the engine).
      if not v_is_closed
         and v_weekday between 0 and 6
         and (v_hour ->> 'open_time') is not null
         and (v_hour ->> 'close_time') is not null then
        insert into public.availability_rules
          (business_id, weekday, open_time, close_time, is_closed)
        values (
          v_business_id,
          v_weekday,
          (v_hour ->> 'open_time')::time,
          (v_hour ->> 'close_time')::time,
          false
        );
      end if;
    end loop;
  end if;

  return v_business_id;
end;
$$;

-- The whole statement is one transaction: any failure rolls everything back,
-- so the Server Action needs no best-effort cleanup of its own.
grant execute on function public.create_business_setup(
  text, text, text, text, integer, integer, jsonb
) to authenticated;
