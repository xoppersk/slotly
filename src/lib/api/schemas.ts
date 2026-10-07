/**
 * Zod schemas for Slotly's API routes (Wave 3C).
 *
 * Shared between route handlers and unit tests. Query-param schemas parse
 * `Object.fromEntries(searchParams)`; body schemas parse the JSON payload.
 * Every failure surfaces as `{ code: "invalid_input", message }` (400).
 */

import { z } from "zod";

const uuid = z.uuid();
const isoDateTime = z.iso.datetime({ offset: true });
const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(
    (d) => {
      const parts = d.split("-").map(Number);
      const y = parts[0];
      const m = parts[1];
      const day = parts[2];
      if (y === undefined || m === undefined || day === undefined) return false;
      const t = new Date(Date.UTC(y, m - 1, day));
      return (
        t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === day
      );
    },
    { message: "Not a real calendar date" },
  );

const phone = z
  .string()
  .min(4, "Phone number looks too short")
  .max(32)
  .regex(/^[+\d][\d\s().-]*$/, "Phone number contains invalid characters");

const staffSelector = z.union([uuid, z.literal("any")], {
  error: 'staffId must be a staff UUID or "any"',
});

/** GET /api/availability query params. Range is capped at 93 days. */
export const AvailabilityQuerySchema = z
  .object({
    businessId: uuid,
    serviceId: uuid,
    staffId: staffSelector,
    from: ymd,
    to: ymd,
  })
  .refine((v) => v.from <= v.to, {
    message: "`from` must be on or before `to`",
    path: ["to"],
  })
  .refine(
    (v) => {
      const days =
        (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) /
        86_400_000;
      return days <= 92; // inclusive range => at most 93 days
    },
    { message: "Date range must be 93 days or fewer", path: ["to"] },
  );

export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

const CustomerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    phone: phone.optional(),
    email: z.email().max(320).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((c) => c.phone !== undefined || c.email !== undefined, {
    message: "Provide at least a phone number or an email address",
    path: ["phone"],
  });

/** POST /api/bookings body. */
export const CreateBookingSchema = z
  .object({
    businessId: uuid,
    serviceId: uuid,
    staffId: staffSelector,
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    customer: CustomerSchema,
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

/** POST /api/payments/create-intent body. */
export const CreateIntentSchema = z.object({
  manageToken: z.string().min(1, "manageToken is required"),
});

export type CreateIntentInput = z.infer<typeof CreateIntentSchema>;

/** POST /api/bookings/manage body. */
export const ManageBookingSchema = z
  .object({
    token: z.string().min(1, "token is required"),
    action: z.enum(["cancel", "reschedule"]),
    reason: z.string().max(500).optional(),
    newStartsAt: isoDateTime.optional(),
    newEndsAt: isoDateTime.optional(),
    newStaffId: uuid.optional(),
  })
  .refine(
    (v) =>
      v.action === "cancel" ||
      (v.newStartsAt !== undefined && v.newEndsAt !== undefined),
    {
      message: "Rescheduling requires newStartsAt and newEndsAt",
      path: ["newStartsAt"],
    },
  )
  .refine(
    (v) =>
      v.newStartsAt === undefined ||
      v.newEndsAt === undefined ||
      Date.parse(v.newEndsAt) > Date.parse(v.newStartsAt),
    { message: "newEndsAt must be after newStartsAt", path: ["newEndsAt"] },
  );

export type ManageBookingInput = z.infer<typeof ManageBookingSchema>;

/** POST /api/payments/refund body. */
export const RefundSchema = z.object({
  paymentId: uuid,
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

export type RefundInput = z.infer<typeof RefundSchema>;

/** GET /api/bookings/receipt query params. */
export const ReceiptQuerySchema = z.object({
  token: z.string().min(1, "token is required"),
});

export type ReceiptQuery = z.infer<typeof ReceiptQuerySchema>;

/** GET /api/customers/lookup query params. */
export const CustomerLookupQuerySchema = z.object({
  businessId: uuid,
  phone: phone,
});

export type CustomerLookupQuery = z.infer<typeof CustomerLookupQuerySchema>;
