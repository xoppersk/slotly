-- seed.sql — "Harbor & Pine Barbershop" demo dataset.
--
-- HOW TO APPLY
--   1. Create a real user first (sign up in the app or via the Auth dashboard).
--   2. Copy that user's id from Authentication > Users.
--   3. Replace OWNER_ID below with it, then run this file in the SQL editor
--      (or `supabase db execute -f supabase/seed.sql`).
--   The FK businesses.owner_id -> auth.users.id requires a real user row.
--
-- IDEMPOTENCY: every row uses a fixed UUID and INSERT ... ON CONFLICT DO
-- NOTHING, so re-running is safe for the dimension tables. Re-running WILL
-- double-count customer total_visits/no_show_count (the counters trigger
-- fires again for the completed/no_show bookings) — for a truly clean slate,
-- delete the business row first (cascades everywhere).
--
-- Demo contents: 1 business (slug `harbor-and-pine`, America/New_York),
-- 3 staff, 6 services (payment policies: none x4, deposit x1, full x1),
-- service_staff links, weekly hours Tue-Sat 09:00-20:00 (Sun/Mon closed),
-- 1 blackout date (Christmas), 4 customers, 5 bookings (2 upcoming
-- confirmed incl. one with a succeeded deposit payment, 1 completed,
-- 1 cancelled, 1 no_show).

do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-000000000000'; -- <<< REPLACE with a real auth.users id
  v_biz   uuid := 'a1b2c3d4-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from auth.users u where u.id = v_owner) then
    raise exception 'seed aborted: replace v_owner with a real auth.users id (see file header)';
  end if;

  -- Business ---------------------------------------------------------------
  insert into public.businesses (
    id, owner_id, name, slug, description, logo_url, timezone,
    phone, email, address, accent_color,
    min_lead_time_minutes, max_advance_days, slot_step_minutes, free_cancel_hours
  ) values (
    v_biz, v_owner, 'Harbor & Pine Barbershop', 'harbor-and-pine',
    'Classic cuts, hot-towel shaves, and honest conversation since 2016. Walk-ins welcome, bookings preferred.',
    'business-logos/a1b2c3d4-0000-4000-8000-000000000001/logo.png',
    'America/New_York',
    '+1 (215) 555-0147', 'book@harborandpine.example', '128 Harbor Ave, Philadelphia, PA 19147',
    'teal', 120, 60, 15, 4
  )
  on conflict (id) do nothing;

  insert into public.business_members (business_id, user_id, role)
    values (v_biz, v_owner, 'owner')
    on conflict (business_id, user_id) do nothing;

  -- Staff ------------------------------------------------------------------
  -- NOTE: photo files must be uploaded to the `staff-photos` bucket separately.
  insert into public.staff (id, business_id, name, title, bio, photo_url, specialties, phone) values
    ('a1b2c3d4-0000-4000-8000-000000000002', v_biz, 'Marcus Thompson', 'Master Barber',
     'Fifteen years behind the chair. Known for razor-sharp fades and a steady hand with the straight razor.',
     'staff-photos/a1b2c3d4-0000-4000-8000-000000000001/marcus-thompson.jpg',
     '{Skin Fades,Beard Sculpting,Hot Towel Shaves}', '+1 (215) 555-0148'),
    ('a1b2c3d4-0000-4000-8000-000000000003', v_biz, 'Dre Coleman', 'Senior Barber',
     'Precision clipper work and modern crop styles. Dre keeps the shop playlist as fresh as the cuts.',
     'staff-photos/a1b2c3d4-0000-4000-8000-000000000001/dre-coleman.jpg',
     '{Modern Crops,Taper Fades,Kids Cuts}', '+1 (215) 555-0149'),
    ('a1b2c3d4-0000-4000-8000-000000000004', v_biz, 'Priya Nair', 'Barber & Stylist',
     'Detail-obsessed beard architect and scissor specialist. Ask her about the signature hot-towel finish.',
     'staff-photos/a1b2c3d4-0000-4000-8000-000000000001/priya-nair.jpg',
     '{Beard Design,Scissor Cuts,Hot Towel Shaves}', '+1 (215) 555-0150')
  on conflict (id) do nothing;

  -- Services ---------------------------------------------------------------
  insert into public.services (
    id, business_id, name, description, duration_minutes, price_cents,
    price_display, payment_policy, deposit_cents, color, sort_order
  ) values
    ('a1b2c3d4-0000-4000-8000-000000000011', v_biz, 'Signature Haircut',
     'Consultation, precision cut, wash, and style. Our bread and butter.', 30, 3500,
     null, 'none', 0, 'teal', 1),
    ('a1b2c3d4-0000-4000-8000-000000000012', v_biz, 'Skin Fade',
     'Seamless zero-to-blend fade with crisp lineup and razor finish.', 45, 4000,
     null, 'none', 0, 'blue', 2),
    ('a1b2c3d4-0000-4000-8000-000000000013', v_biz, 'Beard Trim & Shape',
     'Beard sculpting, hot lather neckline cleanup, and conditioning oil.', 20, 2000,
     null, 'none', 0, 'amber', 3),
    ('a1b2c3d4-0000-4000-8000-000000000014', v_biz, 'Haircut + Beard Combo',
     'The full works: signature cut plus beard trim & shape in one sitting.', 60, 5500,
     null, 'deposit', 1500, 'violet', 4),
    ('a1b2c3d4-0000-4000-8000-000000000015', v_biz, 'Hot Towel Shave',
     'Traditional straight-razor shave with hot towels and cooling finish. Paid in full at booking.', 30, 3000,
     null, 'full', 0, 'rose', 5),
    ('a1b2c3d4-0000-4000-8000-000000000016', v_biz, 'Kids Cut (12 & under)',
     'Patient, gentle cuts for young gentlemen. Parent stays in the chair-side seat.', 25, 2500,
     null, 'none', 0, 'green', 6)
  on conflict (id) do nothing;

  -- Who performs what -------------------------------------------------------
  insert into public.service_staff (service_id, staff_id) values
    -- Marcus does everything
    ('a1b2c3d4-0000-4000-8000-000000000011', 'a1b2c3d4-0000-4000-8000-000000000002'),
    ('a1b2c3d4-0000-4000-8000-000000000012', 'a1b2c3d4-0000-4000-8000-000000000002'),
    ('a1b2c3d4-0000-4000-8000-000000000013', 'a1b2c3d4-0000-4000-8000-000000000002'),
    ('a1b2c3d4-0000-4000-8000-000000000014', 'a1b2c3d4-0000-4000-8000-000000000002'),
    ('a1b2c3d4-0000-4000-8000-000000000015', 'a1b2c3d4-0000-4000-8000-000000000002'),
    ('a1b2c3d4-0000-4000-8000-000000000016', 'a1b2c3d4-0000-4000-8000-000000000002'),
    -- Dre: cuts and fades
    ('a1b2c3d4-0000-4000-8000-000000000011', 'a1b2c3d4-0000-4000-8000-000000000003'),
    ('a1b2c3d4-0000-4000-8000-000000000012', 'a1b2c3d4-0000-4000-8000-000000000003'),
    ('a1b2c3d4-0000-4000-8000-000000000014', 'a1b2c3d4-0000-4000-8000-000000000003'),
    ('a1b2c3d4-0000-4000-8000-000000000016', 'a1b2c3d4-0000-4000-8000-000000000003'),
    -- Priya: cuts, beards, shaves
    ('a1b2c3d4-0000-4000-8000-000000000011', 'a1b2c3d4-0000-4000-8000-000000000004'),
    ('a1b2c3d4-0000-4000-8000-000000000013', 'a1b2c3d4-0000-4000-8000-000000000004'),
    ('a1b2c3d4-0000-4000-8000-000000000014', 'a1b2c3d4-0000-4000-8000-000000000004'),
    ('a1b2c3d4-0000-4000-8000-000000000015', 'a1b2c3d4-0000-4000-8000-000000000004')
  on conflict do nothing;

  -- Weekly hours: Tue-Sat 09:00-20:00, Sun/Mon closed (business default) ----
  insert into public.availability_rules (business_id, staff_id, weekday, open_time, close_time, is_closed) values
    (v_biz, null, 0, '09:00', '20:00', true),   -- Sunday: closed
    (v_biz, null, 1, '09:00', '20:00', true),   -- Monday: closed
    (v_biz, null, 2, '09:00', '20:00', false),
    (v_biz, null, 3, '09:00', '20:00', false),
    (v_biz, null, 4, '09:00', '20:00', false),
    (v_biz, null, 5, '09:00', '20:00', false),
    (v_biz, null, 6, '09:00', '20:00', false)
  on conflict do nothing;

  -- Blackout: Christmas -----------------------------------------------------
  insert into public.blackout_dates (business_id, date, reason)
    values (v_biz, '2026-12-25', 'Christmas Day — shop closed')
    on conflict (business_id, date) do nothing;

  -- Customers ---------------------------------------------------------------
  insert into public.customers (id, business_id, name, phone, email, notes) values
    ('a1b2c3d4-0000-4000-8000-000000000021', v_biz, 'Darnell Washington',
     '+1 (215) 555-0111', 'darnell.w@example.com', 'Regular. Likes the 2pm slot.'),
    ('a1b2c3d4-0000-4000-8000-000000000022', v_biz, 'Chris Okafor',
     '+1 (215) 555-0112', 'chris.o@example.com', ''),
    ('a1b2c3d4-0000-4000-8000-000000000023', v_biz, 'Sam Delgado',
     '+1 (215) 555-0113', 'sam.d@example.com', 'First visit — combo booking.'),
    ('a1b2c3d4-0000-4000-8000-000000000024', v_biz, 'Mike Ross',
     '+1 (215) 555-0114', 'mike.r@example.com', '')
  on conflict (id) do nothing;

  -- Bookings (times are America/New_York wall time; all within Tue-Sat hours)
  -- manage_token_hash values are sha256('harbor-pine-seed-token-N').
  insert into public.bookings (
    id, business_id, service_id, staff_id, customer_id,
    starts_at, ends_at, status, price_cents,
    customer_notes, manage_token_hash, manage_token_expires_at, source
  ) values
    -- Past completed visit (drives Darnell's total_visits to 1 via trigger)
    ('a1b2c3d4-0000-4000-8000-000000000031', v_biz,
     'a1b2c3d4-0000-4000-8000-000000000011', 'a1b2c3d4-0000-4000-8000-000000000002',
     'a1b2c3d4-0000-4000-8000-000000000021',
     '2026-09-29 10:00:00-04:00', '2026-09-29 10:30:00-04:00',
     'completed', 3500, '',
     '2f6e85fe1091a305635c68d5dc39f3824c9c0d6b0c390d6175b3752ea13a36fe',
     now() + interval '72 hours', 'online'),
    -- Past no-show (drives Chris's no_show_count to 1 via trigger)
    ('a1b2c3d4-0000-4000-8000-000000000032', v_biz,
     'a1b2c3d4-0000-4000-8000-000000000013', 'a1b2c3d4-0000-4000-8000-000000000004',
     'a1b2c3d4-0000-4000-8000-000000000022',
     '2026-09-29 15:00:00-04:00', '2026-09-29 15:20:00-04:00',
     'no_show', 2000, '',
     '6ffbc3e255e11fbd1647720c16400976eb35265840946660d6c5be48e2c022b0',
     now() + interval '72 hours', 'online'),
    -- Upcoming confirmed (no payment)
    ('a1b2c3d4-0000-4000-8000-000000000033', v_biz,
     'a1b2c3d4-0000-4000-8000-000000000012', 'a1b2c3d4-0000-4000-8000-000000000003',
     'a1b2c3d4-0000-4000-8000-000000000022',
     '2026-10-13 14:00:00-04:00', '2026-10-13 14:45:00-04:00',
     'confirmed', 4000, 'Going to a wedding Saturday — keep the top textured.',
     '020723cf2e34dc78dfe9142550169782c69c10b3181444181afad24a73f5a7df',
     now() + interval '72 hours', 'online'),
    -- Upcoming confirmed with succeeded deposit payment
    ('a1b2c3d4-0000-4000-8000-000000000034', v_biz,
     'a1b2c3d4-0000-4000-8000-000000000014', 'a1b2c3d4-0000-4000-8000-000000000002',
     'a1b2c3d4-0000-4000-8000-000000000023',
     '2026-10-14 11:00:00-04:00', '2026-10-14 12:00:00-04:00',
     'confirmed', 5500, '',
     'd773b3ee39be8b1d0bc84d13b30eb3e9a1db9857968b7dfc958dd52237a37523',
     now() + interval '72 hours', 'online'),
    -- Cancelled booking
    ('a1b2c3d4-0000-4000-8000-000000000035', v_biz,
     'a1b2c3d4-0000-4000-8000-000000000015', 'a1b2c3d4-0000-4000-8000-000000000004',
     'a1b2c3d4-0000-4000-8000-000000000024',
     '2026-10-15 09:30:00-04:00', '2026-10-15 10:00:00-04:00',
     'cancelled', 3000, '',
     '09f6cb88a0e28271f795e66907b52aba155560f4297ea2c6dc6786f8eec37a80',
     now() + interval '72 hours', 'phone')
  on conflict (id) do nothing;

  -- Mark the cancelled booking's audit fields (only on first insert).
  update public.bookings
    set cancelled_at = '2026-10-06 12:00:00-04:00',
        cancel_reason = 'Customer called to cancel — work trip came up.'
    where id = 'a1b2c3d4-0000-4000-8000-000000000035'
      and cancelled_at is null;

  -- Succeeded deposit payment for the combo booking (test-mode placeholder PI id)
  insert into public.payments (
    id, business_id, booking_id, stripe_payment_intent_id,
    amount_cents, currency, kind, status, idempotency_key
  ) values (
    'a1b2c3d4-0000-4000-8000-000000000041', v_biz,
    'a1b2c3d4-0000-4000-8000-000000000034', 'pi_seed_harbor_pine_deposit_001',
    1500, 'usd', 'deposit', 'succeeded',
    'slotly:a1b2c3d4-0000-4000-8000-000000000034:deposit'
  )
  on conflict (id) do nothing;

  -- Confirmation notification for the upcoming fade booking
  insert into public.notification_log (
    business_id, booking_id, channel, kind, recipient, status
  )
  select v_biz, 'a1b2c3d4-0000-4000-8000-000000000033',
         'email', 'confirmation', 'chris.o@example.com', 'sent'
  where not exists (
    select 1 from public.notification_log
    where booking_id = 'a1b2c3d4-0000-4000-8000-000000000033'
      and kind = 'confirmation'
  );
end $$;
