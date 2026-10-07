/**
 * Database types for Slotly's PostgreSQL schema.
 *
 * Hand-written to mirror supabase/migrations/ exactly, following the same
 * simple-alias pattern as the other builds (plain Row/Insert/Update aliases —
 * complex generics break never-inference in supabase-js).
 *
 * In CI/production this file can be regenerated with `supabase gen types
 * typescript` and committed; until then this is the source of truth the app
 * typechecks against.
 *
 * Authorization model: PostgreSQL Row Level Security (RLS) is the
 * authorization layer — every table has RLS enabled, deny-by-default.
 * The anon key can only read through the three *_public views or call the
 * SECURITY DEFINER functions; the service-role key bypasses RLS and is
 * server-only (webhooks + cron).
 *
 * Money is integer cents. Times are ISO strings (timestamptz), dates are
 * YYYY-MM-DD strings, times are HH:MM:SS strings.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "owner" | "staff";
export type PaymentPolicy = "none" | "deposit" | "full";
export type BookingStatus =
  | "pending"
  | "payment_pending"
  | "payment_failed"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";
export type BookingSource = "online" | "phone" | "walk_in" | "dashboard";
export type PaymentKind = "deposit" | "full_payment";
export type PaymentStatus =
  | "requires_payment"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";
export type RefundStatus = "pending" | "succeeded" | "failed";
export type NotificationChannel = "email" | "sms";
export type NotificationKind =
  | "confirmation"
  | "reminder_24h"
  | "reminder_2h"
  | "reschedule"
  | "cancellation"
  | "staff_alert"
  | "invite";
export type NotificationStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced";
export type TimeOffStatus = "pending" | "approved" | "declined";
export type WebhookEventStatus = "received" | "processed" | "failed";

export type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  cover_url: string | null;
  timezone: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  accent_color: string;
  booking_page_enabled: boolean;
  min_lead_time_minutes: number;
  max_advance_days: number;
  slot_step_minutes: number;
  free_cancel_hours: number;
  stripe_account_id: string | null;
  payments_enabled: boolean;
  reminder_24h_enabled: boolean;
  reminder_2h_enabled: boolean;
  reminder_24h_channel: "email" | "sms";
  reminder_2h_channel: "email" | "sms";
  owner_notify_email: boolean;
  owner_notify_sms: boolean;
  buffer_before_default_minutes: number;
  buffer_after_default_minutes: number;
  default_payment_policy: PaymentPolicy;
  created_at: string;
  updated_at: string;
};

export type BusinessMemberRow = {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  staff_id: string | null;
  created_at: string;
};

export type StaffRow = {
  id: string;
  business_id: string;
  name: string;
  title: string | null;
  bio: string;
  photo_url: string | null;
  specialties: string[];
  is_active: boolean;
  notify_new_booking: boolean;
  notify_cancellation: boolean;
  phone: string | null;
  created_at: string;
};

export type StaffInviteRow = {
  id: string;
  business_id: string;
  email: string;
  role: MemberRole;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  price_display: string | null;
  payment_policy: PaymentPolicy;
  deposit_cents: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ServiceStaffRow = {
  service_id: string;
  staff_id: string;
};

export type AvailabilityRuleRow = {
  id: string;
  business_id: string;
  staff_id: string | null;
  weekday: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export type AvailabilityOverrideRow = {
  id: string;
  business_id: string;
  staff_id: string | null;
  date: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  reason: string | null;
};

export type BlackoutDateRow = {
  id: string;
  business_id: string;
  date: string;
  reason: string | null;
};

export type StaffTimeOffRow = {
  id: string;
  business_id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  status: TimeOffStatus;
  created_at: string;
};

export type CustomerRow = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string;
  total_visits: number;
  no_show_count: number;
  created_at: string;
};

export type BookingRow = {
  id: string;
  business_id: string;
  service_id: string;
  staff_id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_cents: number;
  hold_expires_at: string | null;
  idempotency_key: string | null;
  customer_notes: string;
  internal_notes: string;
  manage_token_hash: string;
  manage_token_expires_at: string;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  rescheduled_from_id: string | null;
  source: BookingSource;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  business_id: string;
  booking_id: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  currency: string;
  kind: PaymentKind;
  status: PaymentStatus;
  idempotency_key: string;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
};

export type RefundRow = {
  id: string;
  business_id: string;
  payment_id: string;
  stripe_refund_id: string;
  amount_cents: number;
  reason: string | null;
  initiated_by: string | null;
  status: RefundStatus;
  created_at: string;
};

export type WebhookEventRow = {
  id: string;
  business_id: string | null;
  stripe_event_id: string;
  type: string;
  payload: Json;
  status: WebhookEventStatus;
  processed_at: string | null;
  created_at: string;
};

export type NotificationLogRow = {
  id: string;
  business_id: string;
  booking_id: string | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  recipient: string;
  status: NotificationStatus;
  provider_id: string | null;
  error: string | null;
  created_at: string;
};

/** Whitelisted public business columns (businesses_public view). */
export type BusinessPublicRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  cover_url: string | null;
  timezone: string;
  phone: string | null;
  address: string | null;
  accent_color: string;
};

/** Whitelisted public service columns (services_public view). */
export type ServicePublicRow = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  price_display: string | null;
  payment_policy: PaymentPolicy;
  deposit_cents: number;
  color: string;
  sort_order: number;
};

/** Whitelisted public staff columns (staff_public view, no private phone). */
export type StaffPublicRow = {
  id: string;
  business_id: string;
  name: string;
  title: string | null;
  bio: string;
  photo_url: string | null;
  specialties: string[];
};

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: BusinessRow;
        Insert: Partial<BusinessRow>;
        Update: Partial<BusinessRow>;
        Relationships: [];
      };
      business_members: {
        Row: BusinessMemberRow;
        Insert: Partial<BusinessMemberRow>;
        Update: Partial<BusinessMemberRow>;
        Relationships: [];
      };
      staff: {
        Row: StaffRow;
        Insert: Partial<StaffRow>;
        Update: Partial<StaffRow>;
        Relationships: [];
      };
      staff_invites: {
        Row: StaffInviteRow;
        Insert: Partial<StaffInviteRow>;
        Update: Partial<StaffInviteRow>;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: Partial<ServiceRow>;
        Update: Partial<ServiceRow>;
        Relationships: [];
      };
      service_staff: {
        Row: ServiceStaffRow;
        Insert: Partial<ServiceStaffRow>;
        Update: Partial<ServiceStaffRow>;
        Relationships: [];
      };
      availability_rules: {
        Row: AvailabilityRuleRow;
        Insert: Partial<AvailabilityRuleRow>;
        Update: Partial<AvailabilityRuleRow>;
        Relationships: [];
      };
      availability_overrides: {
        Row: AvailabilityOverrideRow;
        Insert: Partial<AvailabilityOverrideRow>;
        Update: Partial<AvailabilityOverrideRow>;
        Relationships: [];
      };
      blackout_dates: {
        Row: BlackoutDateRow;
        Insert: Partial<BlackoutDateRow>;
        Update: Partial<BlackoutDateRow>;
        Relationships: [];
      };
      staff_time_off: {
        Row: StaffTimeOffRow;
        Insert: Partial<StaffTimeOffRow>;
        Update: Partial<StaffTimeOffRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: Partial<CustomerRow>;
        Update: Partial<CustomerRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Partial<BookingRow>;
        Update: Partial<BookingRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Partial<PaymentRow>;
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
      refunds: {
        Row: RefundRow;
        Insert: Partial<RefundRow>;
        Update: Partial<RefundRow>;
        Relationships: [];
      };
      webhook_events: {
        Row: WebhookEventRow;
        Insert: Partial<WebhookEventRow>;
        Update: Partial<WebhookEventRow>;
        Relationships: [];
      };
      notification_log: {
        Row: NotificationLogRow;
        Insert: Partial<NotificationLogRow>;
        Update: Partial<NotificationLogRow>;
        Relationships: [];
      };
    };
    Views: {
      businesses_public: {
        Row: BusinessPublicRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      services_public: {
        Row: ServicePublicRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      staff_public: {
        Row: StaffPublicRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      create_business_setup: {
        Args: {
          p_name: string;
          p_slug: string;
          p_timezone: string;
          p_service_name: string;
          p_service_duration_minutes: number;
          p_service_price_cents: number;
          p_weekly_hours: Json;
        };
        Returns: string;
      };
      is_business_member: {
        Args: { biz: string };
        Returns: boolean;
      };
      /**
       * Staff invite RPCs — implemented by migration 00015
       * (supabase/migrations/00015_staff_invite_rpcs.sql).
       * get_staff_invite: { business_name, role, email, expired } | null.
       * accept_staff_invite: { accepted: boolean }.
       */
      get_staff_invite: {
        Args: { p_token: string };
        Returns: Json;
      };
      accept_staff_invite: {
        Args: { p_token: string };
        Returns: Json;
      };
      business_role: {
        Args: { biz: string };
        Returns: string | null;
      };
      own_staff_id: {
        Args: { biz: string };
        Returns: string | null;
      };
      check_slot_bookable: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_staff_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_ignore_booking_id?: string | null;
        };
        Returns: undefined;
      };
      get_availability: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_staff_id?: string | null;
          p_from_date?: string;
          p_to_date?: string;
        };
        Returns: Json;
      };
      create_booking: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_staff_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_customer_name: string;
          p_customer_phone?: string | null;
          p_customer_email?: string | null;
          p_customer_notes?: string;
          p_source?: string;
        };
        Returns: Json;
      };
      manage_booking: {
        Args: {
          p_token: string;
          p_action: "cancel" | "reschedule";
          p_reason?: string | null;
          p_new_starts_at?: string | null;
          p_new_ends_at?: string | null;
          p_new_staff_id?: string | null;
        };
        Returns: Json;
      };
      create_payment_intent: {
        Args: {
          p_token: string;
          p_kind: PaymentKind;
          p_stripe_payment_intent_id: string;
        };
        Returns: Json;
      };
      issue_refund: {
        Args: {
          p_payment_id: string;
          p_amount_cents: number;
          p_stripe_refund_id: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      get_booking_receipt: {
        Args: { p_token: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
