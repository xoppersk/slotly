/**
 * Shared types for the Slotly data layer (`src/lib/db/*`).
 *
 * Row types come from the hand-written PostgreSQL schema types in
 * `@/lib/supabase/types` (source of truth: supabase/migrations/). Every db
 * function accepts an optional client so callers can pass a browser,
 * server, or service-role client; when omitted, the server client is used.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

export type DbClient = SupabaseClient<Database>;

export type {
  AvailabilityOverrideRow,
  AvailabilityRuleRow,
  BlackoutDateRow,
  BookingRow,
  BusinessMemberRow,
  BusinessPublicRow,
  BusinessRow,
  CustomerRow,
  PaymentRow,
  ServicePublicRow,
  ServiceRow,
  ServiceStaffPublicRow,
  ServiceStaffRow,
  StaffPublicRow,
  StaffRow,
  StaffTimeOffRow,
} from "@/lib/supabase/types";

export type {
  BookingSource,
  BookingStatus as DbBookingStatus,
  MemberRole,
  PaymentPolicy,
  PaymentStatus,
  TimeOffStatus,
} from "@/lib/supabase/types";
