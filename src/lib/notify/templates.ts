/**
 * Notification templates for Slotly (email + plaintext).
 *
 * SERVER-SIDE USE — rendered by the reminders cron, booking API routes, and
 * the webhook handler. Pure functions: no I/O, no secrets.
 *
 * Voice: warm and precise, in the customer's own words — "You're booked for
 * Thursday at 2:00 PM." No emojis. Every template carries the booking
 * reference and the appointment time so a forwarded email still makes sense.
 */

export interface TemplateContext {
  businessName: string;
  serviceName: string;
  staffName: string;
  customerName: string;
  /** Short label, e.g. "Thursday at 2:00 PM". */
  whenLabel: string;
  /** Full label, e.g. "Thursday, March 12 at 2:00 PM". */
  dateTimeLabel: string;
  bookingReference: string;
  /** Magic-link manage URL for this booking. */
  manageUrl: string;
  address?: string;
  businessPhone?: string;
  /** Formatted, e.g. "$20.00". */
  amountCharged?: string;
  /** Formatted remainder due at the appointment (deposits). */
  amountDueLater?: string;
  /** Formatted, e.g. "$20.00" — when present, the cancellation includes a refund notice. */
  refundAmount?: string;
  /** E.g. "Wednesday at 2:00 PM". */
  freeCancelUntilLabel?: string;
  /** Staff invite link. */
  inviteUrl?: string;
  inviteRole?: string;
}

export interface NotificationTemplate {
  subject: string;
  text: string;
  html: string;
}

/** Escape user-controlled values before interpolating into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function whereLine(ctx: TemplateContext): string {
  return ctx.address ? `${ctx.businessName}, ${ctx.address}` : ctx.businessName;
}

function contactLine(ctx: TemplateContext): string {
  return ctx.businessPhone ? `Questions? Call ${ctx.businessPhone}.` : "";
}

function manageBlock(ctx: TemplateContext): { text: string; html: string } {
  return {
    text: `Manage your booking (reschedule or cancel): ${ctx.manageUrl}`,
    html: `<p><a href="${escapeHtml(ctx.manageUrl)}">Manage your booking</a> — reschedule or cancel.</p>`,
  };
}

function wrapHtml(title: string, body: string): string {
  return (
    `<!doctype html><html><body style="font-family:sans-serif;line-height:1.6;color:#1a1a1a;">` +
    `<h2 style="margin-bottom:4px;">${title}</h2>${body}</body></html>`
  );
}

function detailRows(ctx: TemplateContext): string {
  const rows: Array<[string, string]> = [
    ["Service", ctx.serviceName],
    ["With", ctx.staffName],
    ["When", ctx.dateTimeLabel],
    ["Where", whereLine(ctx)],
  ];
  if (ctx.amountCharged) rows.push(["Paid", ctx.amountCharged]);
  if (ctx.amountDueLater) rows.push(["Due at your appointment", ctx.amountDueLater]);
  rows.push(["Booking reference", ctx.bookingReference]);
  return rows
    .map(
      ([k, v]) =>
        `<p style="margin:2px 0;"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`,
    )
    .join("");
}

function detailText(ctx: TemplateContext): string {
  const lines = [
    `${ctx.serviceName} with ${ctx.staffName}`,
    ctx.dateTimeLabel,
    whereLine(ctx),
  ];
  if (ctx.amountCharged) lines.push(`Paid: ${ctx.amountCharged}`);
  if (ctx.amountDueLater) lines.push(`Due at your appointment: ${ctx.amountDueLater}`);
  lines.push(`Booking reference: ${ctx.bookingReference}`);
  return lines.join("\n");
}

/** Customer booking confirmation. */
export function bookingConfirmationCustomer(ctx: TemplateContext): NotificationTemplate {
  const subject = `You're booked: ${ctx.serviceName} on ${ctx.whenLabel}`;
  const manage = manageBlock(ctx);
  const text =
    `Hi ${ctx.customerName},\n\n` +
    `You're booked for ${ctx.whenLabel}.\n\n` +
    `${detailText(ctx)}\n\n` +
    `${manage.text}\n\n` +
    `What happens next:\n` +
    `- We'll send a reminder 24 hours before, and another 2 hours before your appointment.\n` +
    (ctx.freeCancelUntilLabel
      ? `- Need to change plans? You can reschedule or cancel free of charge until ${ctx.freeCancelUntilLabel}.\n`
      : "") +
    (contactLine(ctx) ? `\n${contactLine(ctx)}\n` : "") +
    `\nSee you soon,\n${ctx.businessName}`;
  const html = wrapHtml(
    escapeHtml(`You're booked for ${ctx.whenLabel}`),
    `<p>Hi ${escapeHtml(ctx.customerName)},</p>` +
      detailRows(ctx) +
      manage.html +
      `<p><strong>What happens next:</strong><br>` +
      `We'll send a reminder 24 hours before, and another 2 hours before your appointment.` +
      (ctx.freeCancelUntilLabel
        ? `<br>Need to change plans? You can reschedule or cancel free of charge until ${escapeHtml(ctx.freeCancelUntilLabel)}.`
        : "") +
      `</p>` +
      (contactLine(ctx) ? `<p>${escapeHtml(contactLine(ctx))}</p>` : "") +
      `<p>See you soon,<br>${escapeHtml(ctx.businessName)}</p>`,
  );
  return { subject, text, html };
}

/** Business-side confirmation (owner/staff inbox). */
export function bookingConfirmationBusiness(ctx: TemplateContext): NotificationTemplate {
  const subject = `New booking: ${ctx.serviceName} — ${ctx.whenLabel}`;
  const text =
    `You have a new booking.\n\n` +
    `Customer: ${ctx.customerName}\n` +
    `${detailText(ctx)}\n\n` +
    `View it in your dashboard to confirm, reschedule, or message the customer.`;
  const html = wrapHtml(
    escapeHtml(`New booking — ${ctx.whenLabel}`),
    `<p>You have a new booking.</p>` +
      `<p><strong>Customer:</strong> ${escapeHtml(ctx.customerName)}</p>` +
      detailRows(ctx) +
      `<p>View it in your dashboard to confirm, reschedule, or message the customer.</p>`,
  );
  return { subject, text, html };
}

/** Customer reschedule notice. */
export function bookingRescheduled(ctx: TemplateContext): NotificationTemplate {
  const subject = `Your booking moved to ${ctx.whenLabel}`;
  const manage = manageBlock(ctx);
  const text =
    `Hi ${ctx.customerName},\n\n` +
    `Your booking has been moved to ${ctx.whenLabel}.\n\n` +
    `${detailText(ctx)}\n\n` +
    `${manage.text}\n\n` +
    (contactLine(ctx) ? `${contactLine(ctx)}\n\n` : "") +
    `Thanks,\n${ctx.businessName}`;
  const html = wrapHtml(
    escapeHtml(`Your booking moved to ${ctx.whenLabel}`),
    `<p>Hi ${escapeHtml(ctx.customerName)},</p>` +
      `<p>Your booking has been moved to <strong>${escapeHtml(ctx.whenLabel)}</strong>.</p>` +
      detailRows(ctx) +
      manage.html +
      (contactLine(ctx) ? `<p>${escapeHtml(contactLine(ctx))}</p>` : "") +
      `<p>Thanks,<br>${escapeHtml(ctx.businessName)}</p>`,
  );
  return { subject, text, html };
}

/**
 * Customer cancellation notice. When `refundAmount` is set, the notice
 * confirms the refund was issued (auto-refund inside the free-cancel window).
 */
export function bookingCancelled(ctx: TemplateContext): NotificationTemplate {
  const subject = `Your booking on ${ctx.whenLabel} was cancelled`;
  const refundText = ctx.refundAmount
    ? `\nWe've issued a refund of ${ctx.refundAmount} to your original payment method. It usually arrives within 5–10 business days.\n`
    : "";
  const text =
    `Hi ${ctx.customerName},\n\n` +
    `Your booking for ${ctx.dateTimeLabel} has been cancelled.` +
    refundText +
    `\nBooking reference: ${ctx.bookingReference}\n\n` +
    `We hope to see you another time.\n${ctx.businessName}`;
  const html = wrapHtml(
    escapeHtml(`Your booking on ${ctx.whenLabel} was cancelled`),
    `<p>Hi ${escapeHtml(ctx.customerName)},</p>` +
      `<p>Your booking for <strong>${escapeHtml(ctx.dateTimeLabel)}</strong> has been cancelled.</p>` +
      (ctx.refundAmount
        ? `<p>We've issued a refund of <strong>${escapeHtml(ctx.refundAmount)}</strong> to your original payment method. It usually arrives within 5–10 business days.</p>`
        : "") +
      `<p>Booking reference: ${escapeHtml(ctx.bookingReference)}</p>` +
      `<p>We hope to see you another time.<br>${escapeHtml(ctx.businessName)}</p>`,
  );
  return { subject, text, html };
}

/** 24-hour reminder (email). The plaintext doubles as the SMS body. */
export function reminder24h(ctx: TemplateContext): NotificationTemplate {
  const subject = `Reminder: ${ctx.serviceName} tomorrow at ${ctx.whenLabel}`;
  const manage = manageBlock(ctx);
  const text =
    `Hi ${ctx.customerName},\n\n` +
    `Just a heads-up — you have ${ctx.serviceName} with ${ctx.staffName} tomorrow at ${ctx.whenLabel}.\n\n` +
    `${whereLine(ctx)}\n` +
    `Booking reference: ${ctx.bookingReference}\n\n` +
    `${manage.text}`;
  const html = wrapHtml(
    escapeHtml(`Reminder: ${ctx.serviceName} tomorrow`),
    `<p>Hi ${escapeHtml(ctx.customerName)},</p>` +
      `<p>Just a heads-up — you have <strong>${escapeHtml(ctx.serviceName)}</strong> with ${escapeHtml(ctx.staffName)} tomorrow at <strong>${escapeHtml(ctx.whenLabel)}</strong>.</p>` +
      `<p>${escapeHtml(whereLine(ctx))}<br>Booking reference: ${escapeHtml(ctx.bookingReference)}</p>` +
      manage.html,
  );
  return { subject, text, html };
}

/** 2-hour reminder (email/SMS). */
export function reminder2h(ctx: TemplateContext): NotificationTemplate {
  const subject = `Starting soon: ${ctx.serviceName} at ${ctx.whenLabel}`;
  const text =
    `Hi ${ctx.customerName},\n\n` +
    `Your ${ctx.serviceName} with ${ctx.staffName} starts in about 2 hours (${ctx.whenLabel}).\n\n` +
    `${whereLine(ctx)}\n` +
    `Booking reference: ${ctx.bookingReference}\n\n` +
    `Running late? ${ctx.manageUrl}`;
  const html = wrapHtml(
    escapeHtml(`Starting soon: ${ctx.serviceName}`),
    `<p>Hi ${escapeHtml(ctx.customerName)},</p>` +
      `<p>Your <strong>${escapeHtml(ctx.serviceName)}</strong> with ${escapeHtml(ctx.staffName)} starts in about 2 hours (<strong>${escapeHtml(ctx.whenLabel)}</strong>).</p>` +
      `<p>${escapeHtml(whereLine(ctx))}<br>Booking reference: ${escapeHtml(ctx.bookingReference)}</p>` +
      `<p>Running late? <a href="${escapeHtml(ctx.manageUrl)}">Manage your booking</a>.</p>`,
  );
  return { subject, text, html };
}

/** Staff alert: a new booking landed on their book. */
export function staffNewBookingAlert(ctx: TemplateContext): NotificationTemplate {
  const subject = `New booking: ${ctx.customerName} — ${ctx.serviceName} ${ctx.whenLabel}`;
  const text =
    `Heads-up — a new booking just landed on your book.\n\n` +
    `Customer: ${ctx.customerName}\n` +
    `${ctx.serviceName}\n` +
    `${ctx.dateTimeLabel}\n` +
    `Booking reference: ${ctx.bookingReference}`;
  const html = wrapHtml(
    escapeHtml("New booking on your book"),
    `<p>Heads-up — a new booking just landed on your book.</p>` +
      `<p><strong>Customer:</strong> ${escapeHtml(ctx.customerName)}<br>` +
      `<strong>Service:</strong> ${escapeHtml(ctx.serviceName)}<br>` +
      `<strong>When:</strong> ${escapeHtml(ctx.dateTimeLabel)}<br>` +
      `Booking reference: ${escapeHtml(ctx.bookingReference)}</p>`,
  );
  return { subject, text, html };
}

/** Staff alert: one of their bookings was cancelled. */
export function staffCancellationAlert(ctx: TemplateContext): NotificationTemplate {
  const subject = `Cancelled: ${ctx.customerName} — ${ctx.serviceName} ${ctx.whenLabel}`;
  const text =
    `A booking on your book was cancelled.\n\n` +
    `Customer: ${ctx.customerName}\n` +
    `${ctx.serviceName}\n` +
    `${ctx.dateTimeLabel}\n` +
    `Booking reference: ${ctx.bookingReference}\n\n` +
    `The slot is open again.`;
  const html = wrapHtml(
    escapeHtml("A booking was cancelled"),
    `<p>A booking on your book was cancelled.</p>` +
      `<p><strong>Customer:</strong> ${escapeHtml(ctx.customerName)}<br>` +
      `<strong>Service:</strong> ${escapeHtml(ctx.serviceName)}<br>` +
      `<strong>When:</strong> ${escapeHtml(ctx.dateTimeLabel)}<br>` +
      `Booking reference: ${escapeHtml(ctx.bookingReference)}</p>` +
      `<p>The slot is open again.</p>`,
  );
  return { subject, text, html };
}

/** Staff invite (7-day expiry, sent by the owner). */
export function staffInvite(ctx: TemplateContext): NotificationTemplate {
  const role = ctx.inviteRole ?? "staff member";
  const subject = `You've been invited to join ${ctx.businessName} on Slotly`;
  const text =
    `Hi ${ctx.customerName},\n\n` +
    `You've been invited to join ${ctx.businessName} on Slotly as ${role}.\n\n` +
    `Accept your invite (valid for 7 days): ${ctx.inviteUrl}\n\n` +
    `Once you accept, you'll see your own schedule, bookings, and availability settings.`;
  const html = wrapHtml(
    escapeHtml(`You're invited to join ${ctx.businessName}`),
    `<p>Hi ${escapeHtml(ctx.customerName)},</p>` +
      `<p>You've been invited to join <strong>${escapeHtml(ctx.businessName)}</strong> on Slotly as ${escapeHtml(role)}.</p>` +
      `<p><a href="${escapeHtml(ctx.inviteUrl ?? "")}">Accept your invite</a> — valid for 7 days.</p>` +
      `<p>Once you accept, you'll see your own schedule, bookings, and availability settings.</p>`,
  );
  return { subject, text, html };
}

/** Every customer/staff-facing template, for exhaustive render tests. */
export const ALL_TEMPLATES = {
  bookingConfirmationCustomer,
  bookingConfirmationBusiness,
  bookingRescheduled,
  bookingCancelled,
  reminder24h,
  reminder2h,
  staffNewBookingAlert,
  staffCancellationAlert,
  staffInvite,
} as const;
