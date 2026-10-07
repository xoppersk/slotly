-- 00007_payments.sql — payments, refunds, webhook_events.
--
-- Run order: after 00006 (references bookings). Stripe Payment Intents are
-- created by the API route with idempotency key `slotly:{booking_id}:{kind}`;
-- rows are recorded via the create_payment_intent() SECURITY DEFINER
-- function (00010). Refunds are recorded via issue_refund() (00010), which
-- enforces total-refunded ≤ payment amount (CHECK constraints cannot use
-- subqueries, so this lives in the function).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  stripe_payment_intent_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  kind text not null check (kind in ('deposit','full_payment')),
  status text not null default 'requires_payment'
    check (status in ('requires_payment','processing','succeeded','failed','canceled')),
  idempotency_key text not null unique,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, kind)
);

create index payments_business_id_idx on public.payments (business_id);
create index payments_booking_id_idx on public.payments (booking_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  stripe_refund_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  reason text,
  initiated_by uuid references auth.users (id),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at timestamptz not null default now()
);

create index refunds_payment_id_idx on public.refunds (payment_id);
create index refunds_business_id_idx on public.refunds (business_id);

-- Stripe event deduplication + audit. Writes come from the /api/webhooks/stripe
-- handler running with the service role (bypasses RLS); owners get read access.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  stripe_event_id text not null unique,
  type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index webhook_events_business_id_idx on public.webhook_events (business_id);
