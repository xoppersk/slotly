-- seed-harbor-and-pine.sql — SQL twin of scripts/seed-harbor-and-pine.mjs.
--
-- HOW TO RUN: Supabase Studio → project nqqmlhqrjjapqranfdcl → SQL Editor →
-- paste this whole file → Run. It executes as the postgres role (bypasses
-- PostgreSQL Row Level Security), so no service-role key is needed here.
--
-- WHAT IT DOES: enriches Harbor & Pine Barbershop
-- (id d4937b12-dd15-463e-9798-2985fd62c37d) with the fixture service catalog
-- and staff, idempotently:
--   * 5 services (integer cents; payment_policy 'none' — no Stripe keys
--     exist, so bookings confirm instantly and the deposit is a
--     due-at-the-shop display amount only)
--   * 3 staff — plain rows in public.staff (migration 00002: staff carry no
--     auth.users FK; a login attaches later via business_members.staff_id)
--   * all 15 service_staff links (every staffer performs every service)
-- IDEMPOTENT: guarded by WHERE NOT EXISTS on (business_id, name); existing
-- rows get their price/duration/deposit/policy refreshed. NEVER deletes.
-- The pre-existing live "Haircut" (2500c) service is left untouched.

begin;

-- Guard: the target business must be Harbor & Pine.
do $$
begin
  if not exists (
    select 1 from public.businesses
    where id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
      and slug = 'harbor-and-pine'
  ) then
    raise exception 'seed aborted: Harbor & Pine business row not found';
  end if;
end $$;

-- Services ---------------------------------------------------------------
insert into public.services
  (business_id, name, description, duration_minutes, price_cents,
   payment_policy, deposit_cents, color, is_active, sort_order)
select 'd4937b12-dd15-463e-9798-2985fd62c37d', v.name, v.description,
       v.duration_minutes, v.price_cents, 'none', v.deposit_cents,
       v.color, true, v.sort_order
from (values
  ('Signature haircut', 'Consultation, precision cut, wash, and style.', 45, 4800, 2000, 'teal',   1),
  ('Skin fade',         'Seamless zero-to-blend fade with crisp lineup and razor finish.', 45, 6000, 2000, 'blue', 2),
  ('Beard trim',        'Beard sculpting, hot lather neckline cleanup, and conditioning oil.', 30, 2800, 2000, 'amber', 3),
  ('Cut + beard',       'The full works: signature cut plus beard trim in one sitting.', 60, 6800, 2000, 'violet', 4),
  ('Line-up',           'Edge-up and crisp lines to keep a fresh cut sharp.', 20, 2000, 2000, 'green', 5)
) as v(name, description, duration_minutes, price_cents, deposit_cents, color, sort_order)
where not exists (
  select 1 from public.services s
  where s.business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
    and s.name = v.name
);

-- Refresh drifted values on already-seeded services (keeps reruns honest).
update public.services s
set duration_minutes = v.duration_minutes,
    price_cents      = v.price_cents,
    deposit_cents    = v.deposit_cents,
    payment_policy   = 'none',
    is_active        = true
from (values
  ('Signature haircut', 45, 4800, 2000),
  ('Skin fade',         45, 6000, 2000),
  ('Beard trim',        30, 2800, 2000),
  ('Cut + beard',       60, 6800, 2000),
  ('Line-up',           20, 2000, 2000)
) as v(name, duration_minutes, price_cents, deposit_cents)
where s.business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
  and s.name = v.name;

-- Staff ------------------------------------------------------------------
insert into public.staff (business_id, name, title, bio, specialties, is_active)
select 'd4937b12-dd15-463e-9798-2985fd62c37d', v.name, 'Barber', '', v.specialties, true
from (values
  ('Micah', array['Signature haircut','Skin fade']),
  ('Nia',   array['Signature haircut','Beard trim']),
  ('Andre', array['Cut + beard','Line-up'])
) as v(name, specialties)
where not exists (
  select 1 from public.staff st
  where st.business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
    and st.name = v.name
);

update public.staff st
set is_active = true
where st.business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
  and st.name in ('Micah', 'Nia', 'Andre');

-- Service ↔ staff links (all 3 staff × all 5 seeded services) ------------
insert into public.service_staff (service_id, staff_id)
select s.id, st.id
from public.services s
join public.staff st on st.business_id = s.business_id
where s.business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
  and s.name in ('Signature haircut','Skin fade','Beard trim','Cut + beard','Line-up')
  and st.name in ('Micah','Nia','Andre')
on conflict do nothing;

commit;

-- Verification (run after commit; expect 5 seeded services, 3 staff,
-- 15 links, and a non-empty staff array from get_availability) ------------
select name, price_cents, deposit_cents, duration_minutes, payment_policy
from public.services_public
where business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
order by sort_order;

select name from public.staff_public
where business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
order by name;

select count(*) as seeded_links
from public.service_staff ss
join public.services s on s.id = ss.service_id
where s.business_id = 'd4937b12-dd15-463e-9798-2985fd62c37d'
  and s.name in ('Signature haircut','Skin fade','Beard trim','Cut + beard','Line-up');
