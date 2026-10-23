-- 00015_staff_invite_rpcs.sql — staff-invite SECURITY DEFINER RPCs.
--
-- Run order: after 00014. The /auth/invite/[token] page calls
-- get_staff_invite(p_token) and accept_staff_invite(p_token) via Server
-- Actions; these RPCs never existed as a migration, so the accept flow
-- always errored "unavailable". Both are SECURITY DEFINER so signed-out
-- visitors can resolve an invite link (the raw token is the bearer
-- credential — it only ever travels inside the emailed link) and new
-- members can bootstrap their business_members row without an existing
-- membership to satisfy RLS.
--
-- Token scheme (matches src/app/(dashboard)/staff/actions.ts): the raw
-- token is randomBytes(32).base64url; stored as
-- sha256(raw).digest("hex") in staff_invites.token_hash.

-- ---------------------------------------------------------------------------
-- get_staff_invite: resolve an invite link for the accept page.
-- Returns { business_name, role, email, expired } or null (unknown token).
-- expired covers: already accepted, or past expires_at.
-- ---------------------------------------------------------------------------
create or replace function public.get_staff_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := encode(digest(p_token::bytea, 'sha256'), 'hex');
  v_invite public.staff_invites%rowtype;
  v_business_name text;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  select * into v_invite
  from public.staff_invites
  where token_hash = v_hash;

  if not found then
    return null;
  end if;

  select b.name into v_business_name
  from public.businesses b
  where b.id = v_invite.business_id;

  return jsonb_build_object(
    'business_name', coalesce(v_business_name, 'a business'),
    'role', v_invite.role,
    'email', v_invite.email,
    'expired', v_invite.accepted_at is not null or v_invite.expires_at < now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_staff_invite: join the business as the invited staff member.
-- Must be called signed-in (the page pre-checks; the function double-checks
-- via auth.uid()). Creates the staff profile row + business_members link
-- and marks the invite accepted. Idempotent: re-accepting an already-joined
-- membership returns accepted=true without duplicating rows.
-- Returns { accepted: boolean }.
-- ---------------------------------------------------------------------------
create or replace function public.accept_staff_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := encode(digest(p_token::bytea, 'sha256'), 'hex');
  v_invite public.staff_invites%rowtype;
  v_staff_id uuid;
  v_user_email text;
  v_user_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite
  from public.staff_invites
  where token_hash = v_hash;

  -- Unknown, already-accepted, or expired token: no join.
  if not found
    or v_invite.accepted_at is not null
    or v_invite.expires_at < now()
  then
    return jsonb_build_object('accepted', false);
  end if;

  -- Already a member (e.g. double-click / re-opened link): idempotent.
  if exists (
    select 1 from public.business_members m
    where m.business_id = v_invite.business_id and m.user_id = v_uid
  ) then
    return jsonb_build_object('accepted', true);
  end if;

  select u.email,
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))
    into v_user_email, v_user_name
  from auth.users u
  where u.id = v_uid;

  -- Create the staff profile row; the owner can refine it later.
  insert into public.staff (business_id, name, phone)
  values (v_invite.business_id, v_user_name, null)
  returning id into v_staff_id;

  insert into public.business_members (business_id, user_id, role, staff_id)
  values (v_invite.business_id, v_uid, v_invite.role, v_staff_id)
  on conflict (business_id, user_id) do nothing;

  update public.staff_invites
  set accepted_at = now()
  where id = v_invite.id and accepted_at is null;

  return jsonb_build_object('accepted', true);
end;
$$;

grant execute on function public.get_staff_invite(text) to anon, authenticated;
grant execute on function public.accept_staff_invite(text) to authenticated;
