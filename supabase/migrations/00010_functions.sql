-- 00010_functions.sql — SECURITY DEFINER functions (the anon-safe API surface).
--
-- Run order: after 00009. Every function runs as the migration owner
-- (bypasses RLS) with a locked search_path, and re-validates everything the
-- RLS policies would have checked: membership, slot availability, token
-- ownership. The anon key can call these via PostgREST RPC but can never
-- touch the underlying tables directly.
--
-- Public signatures (for the API phase):
--   get_availability(p_business_id, p_service_id, p_staff_id = null,
--                    p_from_date = today, p_to_date = today + 60) -> jsonb
--   create_booking(p_business_id, p_service_id, p_staff_id, p_starts_at, p_ends_at,
--                  p_customer_name, p_customer_phone = null, p_customer_email = null,
--                  p_customer_notes = '', p_source = 'online') -> jsonb
--   manage_booking(p_token, p_action, p_reason = null, p_new_starts_at = null,
--                  p_new_ends_at = null, p_new_staff_id = null) -> jsonb
--   create_payment_intent(p_token, p_kind, p_stripe_payment_intent_id) -> jsonb
--   issue_refund(p_payment_id, p_amount_cents, p_stripe_refund_id, p_reason = null) -> jsonb
--   get_booking_receipt(p_token) -> jsonb
--
-- Manage-token lifecycle: 32 random bytes, sha256 stored, 72h expiry,
-- rotated after every manage_booking() call. The raw token is returned exactly
-- once per issuance and never stored.

-- ---------------------------------------------------------------------------
-- Internal: validates a slot against business rules. Raises on any violation.
-- The no_overlap EXCLUDE constraint remains the final race-safety guard.
-- ---------------------------------------------------------------------------
create or replace function public.check_slot_bookable(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_ignore_booking_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tz text;
  v_slot_step integer;
  v_lead integer;
  v_advance integer;
  v_duration integer;
  v_date date;
  v_dow integer;
  v_local_start time;
  v_local_end time;
  v_open time;
  v_close time;
  v_offset_min integer;
  v_ov record;
  v_rule record;
begin
  select b.timezone, b.slot_step_minutes, b.min_lead_time_minutes, b.max_advance_days
    into v_tz, v_slot_step, v_lead, v_advance
    from public.businesses b where b.id = p_business_id;
  if not found then
    raise exception 'business_not_found';
  end if;

  select s.duration_minutes into v_duration
    from public.services s
    where s.id = p_service_id and s.business_id = p_business_id and s.is_active;
  if not found then
    raise exception 'service_not_available';
  end if;
  if p_ends_at <= p_starts_at
     or (extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer <> v_duration then
    raise exception 'slot_duration_mismatch';
  end if;

  if not exists (
    select 1 from public.staff st
    where st.id = p_staff_id and st.business_id = p_business_id and st.is_active
  ) then
    raise exception 'staff_not_available';
  end if;
  if not exists (
    select 1 from public.service_staff ss
    where ss.service_id = p_service_id and ss.staff_id = p_staff_id
  ) then
    raise exception 'staff_does_not_perform_service';
  end if;

  if p_starts_at < now() + make_interval(mins => v_lead) then
    raise exception 'below_min_lead_time';
  end if;
  if (p_starts_at at time zone v_tz)::date
     > (now() at time zone v_tz)::date + v_advance then
    raise exception 'beyond_max_advance';
  end if;

  v_date := (p_starts_at at time zone v_tz)::date;
  v_dow := extract(dow from (p_starts_at at time zone v_tz))::integer; -- 0 = Sunday
  v_local_start := (p_starts_at at time zone v_tz)::time;
  v_local_end := (p_ends_at at time zone v_tz)::time;

  if exists (
    select 1 from public.blackout_dates bd
    where bd.business_id = p_business_id and bd.date = v_date
  ) then
    raise exception 'blackout_date';
  end if;

  -- Date override wins over weekly rules; staff override wins over all-staff.
  select o.open_time, o.close_time, o.is_closed into v_ov
    from public.availability_overrides o
    where o.business_id = p_business_id and o.staff_id = p_staff_id and o.date = v_date;
  if not found then
    select o.open_time, o.close_time, o.is_closed into v_ov
      from public.availability_overrides o
      where o.business_id = p_business_id and o.staff_id is null and o.date = v_date;
  end if;

  if found then
    if v_ov.is_closed then
      raise exception 'closed_for_date';
    end if;
    v_open := v_ov.open_time;
    v_close := v_ov.close_time;
  else
    select r.open_time, r.close_time, r.is_closed into v_rule
      from public.availability_rules r
      where r.business_id = p_business_id and r.staff_id = p_staff_id and r.weekday = v_dow;
    if not found then
      select r.open_time, r.close_time, r.is_closed into v_rule
        from public.availability_rules r
        where r.business_id = p_business_id and r.staff_id is null and r.weekday = v_dow;
    end if;
    if not found or v_rule.is_closed then
      raise exception 'outside_hours';
    end if;
    v_open := v_rule.open_time;
    v_close := v_rule.close_time;
  end if;

  if v_local_start < v_open or v_local_end > v_close then
    raise exception 'outside_hours';
  end if;
  v_offset_min := (extract(epoch from (v_local_start - v_open)) / 60)::integer;
  if mod(v_offset_min, v_slot_step) <> 0 then
    raise exception 'slot_not_on_grid';
  end if;

  if exists (
    select 1 from public.staff_time_off t
    where t.staff_id = p_staff_id
      and t.status = 'approved'
      and t.starts_at < p_ends_at
      and t.ends_at > p_starts_at
  ) then
    raise exception 'staff_time_off';
  end if;

  -- Best-effort overlap check; the EXCLUDE constraint is the real guard.
  if exists (
    select 1 from public.bookings b
    where b.staff_id = p_staff_id
      and b.status in ('pending','payment_pending','confirmed')
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, p_ends_at)
      and (p_ignore_booking_id is null or b.id <> p_ignore_booking_id)
  ) then
    raise exception 'slot_taken';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_availability: everything the slot engine needs, no rule internals leaked
-- beyond what the booking page requires.
-- ---------------------------------------------------------------------------
create or replace function public.get_availability(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid default null,
  p_from_date date default current_date,
  p_to_date date default (current_date + 60)
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tz text;
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_result jsonb;
begin
  if p_from_date > p_to_date then
    raise exception 'invalid_date_range';
  end if;
  if p_to_date - p_from_date > 93 then
    raise exception 'date_range_too_wide';
  end if;

  select b.timezone into v_tz
    from public.businesses b
    where b.id = p_business_id and b.booking_page_enabled;
  if not found then
    raise exception 'business_not_found_or_disabled';
  end if;

  if not exists (
    select 1 from public.services s
    where s.id = p_service_id and s.business_id = p_business_id and s.is_active
  ) then
    raise exception 'service_not_available';
  end if;

  if p_staff_id is not null and not exists (
    select 1 from public.staff st
    join public.service_staff ss on ss.staff_id = st.id
    where st.id = p_staff_id and st.business_id = p_business_id
      and st.is_active and ss.service_id = p_service_id
  ) then
    raise exception 'staff_not_available';
  end if;

  v_range_start := (p_from_date::timestamp at time zone v_tz);
  v_range_end := ((p_to_date + 1)::timestamp at time zone v_tz);

  select jsonb_build_object(
    'business', (select jsonb_build_object(
        'id', b.id, 'name', b.name, 'slug', b.slug, 'timezone', b.timezone,
        'slot_step_minutes', b.slot_step_minutes,
        'min_lead_time_minutes', b.min_lead_time_minutes,
        'max_advance_days', b.max_advance_days,
        'free_cancel_hours', b.free_cancel_hours
      ) from public.businesses b where b.id = p_business_id),
    'service', (select jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'buffer_before_minutes', s.buffer_before_minutes,
        'buffer_after_minutes', s.buffer_after_minutes,
        'payment_policy', s.payment_policy,
        'price_cents', s.price_cents, 'deposit_cents', s.deposit_cents
      ) from public.services s where s.id = p_service_id),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'title', st.title, 'photo_url', st.photo_url
      ) order by st.name)
      from public.staff st
      join public.service_staff ss on ss.staff_id = st.id and ss.service_id = p_service_id
      where st.business_id = p_business_id and st.is_active
        and (p_staff_id is null or st.id = p_staff_id)), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(jsonb_build_object(
        'staff_id', r.staff_id, 'weekday', r.weekday,
        'open_time', to_char(r.open_time, 'HH24:MI'),
        'close_time', to_char(r.close_time, 'HH24:MI'),
        'is_closed', r.is_closed
      ) order by r.weekday)
      from public.availability_rules r
      where r.business_id = p_business_id
        and (p_staff_id is null or r.staff_id is null or r.staff_id = p_staff_id)), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object(
        'staff_id', o.staff_id, 'date', o.date,
        'open_time', to_char(o.open_time, 'HH24:MI'),
        'close_time', to_char(o.close_time, 'HH24:MI'),
        'is_closed', o.is_closed, 'reason', o.reason
      ) order by o.date)
      from public.availability_overrides o
      where o.business_id = p_business_id
        and o.date between p_from_date and p_to_date
        and (p_staff_id is null or o.staff_id is null or o.staff_id = p_staff_id)), '[]'::jsonb),
    'blackouts', coalesce((select jsonb_agg(jsonb_build_object(
        'date', bd.date, 'reason', bd.reason
      ) order by bd.date)
      from public.blackout_dates bd
      where bd.business_id = p_business_id
        and bd.date between p_from_date and p_to_date), '[]'::jsonb),
    'time_off', coalesce((select jsonb_agg(jsonb_build_object(
        'staff_id', t.staff_id, 'starts_at', t.starts_at,
        'ends_at', t.ends_at, 'reason', t.reason
      ) order by t.starts_at)
      from public.staff_time_off t
      where t.business_id = p_business_id and t.status = 'approved'
        and t.starts_at < v_range_end and t.ends_at > v_range_start
        and (p_staff_id is null or t.staff_id = p_staff_id)), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'staff_id', bk.staff_id, 'starts_at', bk.starts_at, 'ends_at', bk.ends_at
      ) order by bk.starts_at)
      from public.bookings bk
      where bk.business_id = p_business_id
        and bk.status in ('pending','payment_pending','confirmed')
        and bk.starts_at < v_range_end and bk.ends_at > v_range_start
        and (p_staff_id is null or bk.staff_id = p_staff_id)), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_booking: validate slot in-transaction, find-or-create the customer,
-- snapshot the price, issue the manage token. EXCLUDE violations (23P01)
-- mean the slot was taken in a race — the API maps that to a 409.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_customer_notes text default '',
  p_source text default 'online'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer_id uuid;
  v_price integer;
  v_policy text;
  v_deposit integer;
  v_status text;
  v_hold timestamptz;
  v_raw_token text;
  v_token_hash text;
begin
  if p_source not in ('online','phone','walk_in','dashboard') then
    raise exception 'invalid_source';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'customer_name_required';
  end if;
  if p_customer_phone is null and p_customer_email is null then
    raise exception 'customer_contact_required';
  end if;

  if p_source = 'online' and not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.booking_page_enabled
  ) then
    raise exception 'booking_page_disabled';
  end if;

  perform public.check_slot_bookable(
    p_business_id, p_service_id, p_staff_id, p_starts_at, p_ends_at
  );

  select s.price_cents, s.payment_policy, s.deposit_cents
    into v_price, v_policy, v_deposit
    from public.services s where s.id = p_service_id;

  -- Repeat-customer matching stays server-side: no customer rows leak to anon.
  select c.id into v_customer_id
    from public.customers c
    where c.business_id = p_business_id
      and ((p_customer_phone is not null and c.phone = p_customer_phone)
        or (p_customer_email is not null and c.email = p_customer_email))
    order by c.created_at desc
    limit 1;

  if found then
    update public.customers c
      set name = p_customer_name,
          phone = coalesce(c.phone, p_customer_phone),
          email = coalesce(c.email, p_customer_email),
          notes = case when p_customer_notes <> '' then p_customer_notes else c.notes end
      where c.id = v_customer_id;
  else
    insert into public.customers (business_id, name, phone, email, notes)
      values (p_business_id, p_customer_name, p_customer_phone, p_customer_email, p_customer_notes)
      returning id into v_customer_id;
  end if;

  if v_policy = 'none' then
    v_status := 'confirmed';
    v_hold := null;
  else
    v_status := 'payment_pending';
    v_hold := now() + interval '10 minutes';
  end if;

  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  insert into public.bookings (
    business_id, service_id, staff_id, customer_id,
    starts_at, ends_at, status, price_cents, hold_expires_at,
    customer_notes, manage_token_hash,
    manage_token_expires_at, source
  ) values (
    p_business_id, p_service_id, p_staff_id, v_customer_id,
    p_starts_at, p_ends_at, v_status, v_price, v_hold,
    p_customer_notes, v_token_hash,
    now() + interval '72 hours', p_source
  )
  returning * into v_booking;

  return jsonb_build_object(
    'booking', to_jsonb(v_booking),
    'customer_id', v_customer_id,
    'manage_token', v_raw_token,
    'status', v_status,
    'hold_expires_at', v_hold,
    'amount_due_cents', case
      when v_policy = 'deposit' then v_deposit
      when v_policy = 'full' then v_price
      else 0 end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- manage_booking: cancel or reschedule via the magic-link token. The token is
-- rotated after every successful call (old token stops working).
-- ---------------------------------------------------------------------------
create or replace function public.manage_booking(
  p_token text,
  p_action text,
  p_reason text default null,
  p_new_starts_at timestamptz default null,
  p_new_ends_at timestamptz default null,
  p_new_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_booking public.bookings%rowtype;
  v_hash text;
  v_new_staff uuid;
  v_raw_token text;
begin
  if p_action not in ('cancel','reschedule') then
    raise exception 'invalid_action';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select * into v_booking
    from public.bookings b where b.manage_token_hash = v_hash;
  if not found then
    raise exception 'invalid_manage_token';
  end if;
  if v_booking.manage_token_expires_at < now() then
    raise exception 'manage_token_expired';
  end if;

  if p_action = 'cancel' then
    if v_booking.status not in ('pending','payment_pending','confirmed') then
      raise exception 'booking_not_cancellable';
    end if;
    update public.bookings b
      set status = 'cancelled',
          cancelled_at = now(),
          cancel_reason = p_reason
      where b.id = v_booking.id
      returning * into v_booking;
  else
    if v_booking.status not in ('pending','payment_pending','confirmed') then
      raise exception 'booking_not_reschedulable';
    end if;
    if p_new_starts_at is null or p_new_ends_at is null then
      raise exception 'new_slot_required';
    end if;
    v_new_staff := coalesce(p_new_staff_id, v_booking.staff_id);
    perform public.check_slot_bookable(
      v_booking.business_id, v_booking.service_id, v_new_staff,
      p_new_starts_at, p_new_ends_at, v_booking.id
    );
    update public.bookings b
      set starts_at = p_new_starts_at,
          ends_at = p_new_ends_at,
          staff_id = v_new_staff
      where b.id = v_booking.id
      returning * into v_booking;
  end if;

  -- Rotate the manage token: the link the customer just used stops working.
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  update public.bookings b
    set manage_token_hash = encode(digest(v_raw_token, 'sha256'), 'hex'),
        manage_token_expires_at = now() + interval '72 hours'
    where b.id = v_booking.id
    returning * into v_booking;

  return jsonb_build_object(
    'booking', to_jsonb(v_booking),
    'manage_token', v_raw_token
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- create_payment_intent: record a Stripe Payment Intent the API route just
-- created (idempotency key `slotly:{booking_id}:{kind}`). Re-checks the slot
-- guard in-transaction so a PI is never recorded for a stolen slot.
-- ---------------------------------------------------------------------------
create or replace function public.create_payment_intent(
  p_token text,
  p_kind text,
  p_stripe_payment_intent_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_booking public.bookings%rowtype;
  v_hash text;
  v_amount integer;
  v_policy text;
  v_payment public.payments%rowtype;
  v_idem text;
begin
  if p_kind not in ('deposit','full_payment') then
    raise exception 'invalid_payment_kind';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select * into v_booking
    from public.bookings b where b.manage_token_hash = v_hash;
  if not found then
    raise exception 'invalid_manage_token';
  end if;
  if v_booking.manage_token_expires_at < now() then
    raise exception 'manage_token_expired';
  end if;
  if v_booking.status <> 'payment_pending' then
    raise exception 'booking_not_awaiting_payment';
  end if;

  select case
      when p_kind = 'deposit' then s.deposit_cents
      else s.price_cents end,
    s.payment_policy
    into v_amount, v_policy
    from public.services s where s.id = v_booking.service_id;

  -- kind must match the service's payment policy
  if (p_kind = 'deposit' and v_policy <> 'deposit')
     or (p_kind = 'full_payment' and v_policy <> 'full') then
    raise exception 'payment_kind_mismatch';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_payment_amount';
  end if;

  -- Re-check the EXCLUDE guard in-transaction (hold-then-pay race safety).
  if exists (
    select 1 from public.bookings b
    where b.staff_id = v_booking.staff_id
      and b.status in ('pending','payment_pending','confirmed')
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_booking.starts_at, v_booking.ends_at)
      and b.id <> v_booking.id
  ) then
    raise exception 'slot_taken';
  end if;

  v_idem := 'slotly:' || v_booking.id::text || ':' || p_kind;

  insert into public.payments (
    business_id, booking_id, stripe_payment_intent_id,
    amount_cents, kind, idempotency_key
  ) values (
    v_booking.business_id, v_booking.id, p_stripe_payment_intent_id,
    v_amount, p_kind, v_idem
  )
  returning * into v_payment;

  return jsonb_build_object('payment', to_jsonb(v_payment));
end;
$$;

-- ---------------------------------------------------------------------------
-- issue_refund: owner/staff-only. Enforces total refunded (pending + succeeded)
-- never exceeds the payment amount — CHECK constraints cannot use subqueries.
-- The API route creates the Stripe refund first, then records it here.
-- ---------------------------------------------------------------------------
create or replace function public.issue_refund(
  p_payment_id uuid,
  p_amount_cents integer,
  p_stripe_refund_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payment public.payments%rowtype;
  v_refund public.refunds%rowtype;
  v_total integer;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_refund_amount';
  end if;

  select * into v_payment from public.payments p where p.id = p_payment_id;
  if not found then
    raise exception 'payment_not_found';
  end if;

  v_role := public.business_role(v_payment.business_id);
  if v_role is null or v_role not in ('owner','staff') then
    raise exception 'not_authorized';
  end if;

  if v_payment.status <> 'succeeded' then
    raise exception 'payment_not_refundable';
  end if;

  select coalesce(sum(r.amount_cents), 0) into v_total
    from public.refunds r
    where r.payment_id = p_payment_id
      and r.status in ('pending','succeeded');
  if v_total + p_amount_cents > v_payment.amount_cents then
    raise exception 'refund_exceeds_payment';
  end if;

  insert into public.refunds (
    business_id, payment_id, stripe_refund_id,
    amount_cents, reason, initiated_by
  ) values (
    v_payment.business_id, p_payment_id, p_stripe_refund_id,
    p_amount_cents, p_reason, auth.uid()
  )
  returning * into v_refund;

  return jsonb_build_object('refund', to_jsonb(v_refund));
end;
$$;

-- ---------------------------------------------------------------------------
-- get_booking_receipt: the booker's read path — booking + public-safe joins.
-- ---------------------------------------------------------------------------
create or replace function public.get_booking_receipt(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_booking public.bookings%rowtype;
  v_hash text;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select * into v_booking
    from public.bookings b where b.manage_token_hash = v_hash;
  if not found then
    raise exception 'invalid_manage_token';
  end if;
  if v_booking.manage_token_expires_at < now() then
    raise exception 'manage_token_expired';
  end if;

  return jsonb_build_object(
    'booking', to_jsonb(v_booking),
    'business', (
      select to_jsonb(bp) from public.businesses_public bp where bp.id = v_booking.business_id
    ),
    'service', (
      select to_jsonb(sp) from public.services_public sp where sp.id = v_booking.service_id
    ),
    'staff', (
      select to_jsonb(stp) from public.staff_public stp where stp.id = v_booking.staff_id
    ),
    'customer', (
      select jsonb_build_object('id', c.id, 'name', c.name)
      from public.customers c where c.id = v_booking.customer_id
    ),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'amount_cents', p.amount_cents,
        'status', p.status, 'created_at', p.created_at
      ) order by p.created_at)
      from public.payments p where p.booking_id = v_booking.id
    ), '[]'::jsonb)
  );
end;
$$;
