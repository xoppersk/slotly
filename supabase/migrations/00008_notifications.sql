-- 00008_notifications.sql — notification_log + reminder idempotency.
--
-- Run order: after 00006 (references bookings). The reminder cron inserts one
-- row per (booking, kind); the partial unique index makes reminder sends
-- idempotent — a second insert for the same kind fails instead of double
-- sending.

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  channel text not null check (channel in ('email','sms')),
  kind text not null check (kind in ('confirmation','reminder_24h','reminder_2h','reschedule','cancellation','staff_alert','invite')),
  recipient text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','bounced')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create index notification_log_business_id_idx on public.notification_log (business_id);
create index notification_log_booking_id_idx on public.notification_log (booking_id);

-- Reminder idempotency: at most one 24h / 2h reminder row per booking.
create unique index notification_log_reminder_uidx
  on public.notification_log (booking_id, kind)
  where kind in ('reminder_24h','reminder_2h');
