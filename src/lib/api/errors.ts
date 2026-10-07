/**
 * Database/Stripe error mapping for Slotly's API routes.
 *
 * The SECURITY DEFINER functions raise errors whose SQLERRM carries a
 * snake_case code (e.g. `slot_taken`); Postgres also reports the EXCLUDE
 * race as SQLSTATE 23P01. This module maps both to HTTP responses without
 * ever leaking raw database text to the client.
 */

export interface MappedApiError {
  status: number;
  code: string;
  message: string;
}

const SNAKE_CODE_MAP: Array<{
  code: string;
  status: number;
  message: string;
}> = [
  {
    code: "slot_taken",
    status: 409,
    message: "That slot was just taken. Please pick another time.",
  },
  {
    code: "invalid_manage_token",
    status: 400,
    message: "This manage link is invalid.",
  },
  {
    code: "manage_token_expired",
    status: 410,
    message: "This manage link has expired.",
  },
  {
    code: "outside_hours",
    status: 400,
    message: "The requested time is outside business hours.",
  },
  {
    code: "below_min_lead_time",
    status: 400,
    message: "Bookings must be made further in advance.",
  },
  {
    code: "beyond_max_advance",
    status: 400,
    message: "That date is too far in the future.",
  },
  {
    code: "staff_unavailable",
    status: 400,
    message: "That staff member is unavailable at the requested time.",
  },
  {
    code: "staff_not_found",
    status: 404,
    message: "That staff member was not found.",
  },
  {
    code: "service_not_found",
    status: 404,
    message: "That service was not found.",
  },
  {
    code: "service_inactive",
    status: 400,
    message: "This service is no longer bookable.",
  },
  {
    code: "hold_expired",
    status: 410,
    message: "Your payment hold expired. Please book again.",
  },
  {
    code: "booking_not_payable",
    status: 400,
    message: "This booking cannot be paid online.",
  },
  {
    code: "payment_in_progress",
    status: 409,
    message: "A payment is already in progress. Please retry this request.",
  },
  {
    code: "already_cancelled",
    status: 400,
    message: "This booking is already cancelled.",
  },
  {
    code: "exceeds_refundable_amount",
    status: 400,
    message: "The requested refund exceeds the refundable amount.",
  },
  {
    code: "payment_not_refundable",
    status: 400,
    message: "This payment cannot be refunded.",
  },
  {
    code: "invalid_action",
    status: 400,
    message: "That action is not allowed on this booking.",
  },
];

/**
 * Map an unknown thrown value (PostgrestError, Stripe error, or anything
 * else) to a safe API error. Raw database/Stripe messages are never
 * returned — the client gets a stable `code` and a human message.
 */
export function mapDbError(err: unknown): MappedApiError {
  const record =
    typeof err === "object" && err !== null
      ? (err as { code?: unknown; message?: unknown })
      : null;
  const pgCode = typeof record?.code === "string" ? record.code : null;
  const message =
    typeof record?.message === "string" ? record.message : String(err ?? "");

  // EXCLUDE race on the booking range: two writers grabbed the same slot.
  if (pgCode === "23P01") {
    return {
      status: 409,
      code: "slot_taken",
      message: "That slot was just taken. Please pick another time.",
    };
  }

  for (const entry of SNAKE_CODE_MAP) {
    if (message.includes(entry.code)) {
      return {
        status: entry.status,
        code: entry.code,
        message: entry.message,
      };
    }
  }

  // Unique violations (e.g. duplicate payment row on a retried intent).
  if (pgCode === "23505") {
    if (message.includes("payments_booking_id_kind")) {
      return {
        status: 409,
        code: "payment_in_progress",
        message: "A payment is already in progress. Please retry this request.",
      };
    }
    return {
      status: 409,
      code: "conflict",
      message: "This request was already processed.",
    };
  }

  return {
    status: 500,
    code: "internal_error",
    message: "Something went wrong. Please try again.",
  };
}
