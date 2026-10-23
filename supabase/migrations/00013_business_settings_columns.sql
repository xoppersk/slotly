-- 00013_business_settings_columns.sql — settings the dashboard writes.
--
-- Run order: after 00012. All columns carry defaults so existing rows are
-- unaffected. Authorization: businesses_update_member (00009) already lets any
-- business member update; owner-only gating for the settings screen happens
-- in the app layer (business_role(business_id) = 'owner' is checked by the
-- Server Actions before writing).

alter table public.businesses
  add column buffer_before_default_minutes integer not null default 15
    check (buffer_before_default_minutes >= 0),
  add column buffer_after_default_minutes integer not null default 15
    check (buffer_after_default_minutes >= 0),
  add column reminder_24h_channel text not null default 'email'
    check (reminder_24h_channel in ('email', 'sms')),
  add column reminder_2h_channel text not null default 'email'
    check (reminder_2h_channel in ('email', 'sms')),
  add column owner_notify_email boolean not null default true,
  add column owner_notify_sms boolean not null default false,
  add column default_payment_policy text not null default 'none'
    check (default_payment_policy in ('none', 'deposit', 'full'));
