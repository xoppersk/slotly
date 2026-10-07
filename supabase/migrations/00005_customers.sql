-- 00005_customers.sql — customers + visit/no-show counters.
--
-- Run order: after 00001. Defines update_customer_counters(); the trigger
-- itself is attached to bookings in 00006 (bookings does not exist yet here).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text not null default '',
  total_visits integer not null default 0 check (total_visits >= 0),
  no_show_count integer not null default 0 check (no_show_count >= 0),
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);

create index customers_business_id_idx on public.customers (business_id);
create index customers_phone_idx on public.customers (business_id, phone);
create index customers_email_idx on public.customers (business_id, email);

-- Keeps total_visits / no_show_count in sync with booking status changes.
-- Counts each *entry* into 'completed' / 'no_show'; moving a booking back out
-- does not decrement (history is append-only for reporting).
create or replace function public.update_customer_counters()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      update public.customers set total_visits = total_visits + 1 where id = new.customer_id;
    elsif new.status = 'no_show' then
      update public.customers set no_show_count = no_show_count + 1 where id = new.customer_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- Customer reassignment: move any counted visit to the new customer.
    if new.customer_id is distinct from old.customer_id then
      if old.status = 'completed' then
        update public.customers set total_visits = total_visits - 1 where id = old.customer_id;
      elsif old.status = 'no_show' then
        update public.customers set no_show_count = no_show_count - 1 where id = old.customer_id;
      end if;
      if new.status = 'completed' then
        update public.customers set total_visits = total_visits + 1 where id = new.customer_id;
      elsif new.status = 'no_show' then
        update public.customers set no_show_count = no_show_count + 1 where id = new.customer_id;
      end if;
    elsif new.status is distinct from old.status then
      if new.status = 'completed' then
        update public.customers set total_visits = total_visits + 1 where id = new.customer_id;
      elsif new.status = 'no_show' then
        update public.customers set no_show_count = no_show_count + 1 where id = new.customer_id;
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'completed' then
      update public.customers set total_visits = total_visits - 1 where id = old.customer_id;
    elsif old.status = 'no_show' then
      update public.customers set no_show_count = no_show_count - 1 where id = old.customer_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;
