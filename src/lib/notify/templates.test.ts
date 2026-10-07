import { describe, expect, it } from "vitest";

import {
  ALL_TEMPLATES,
  bookingCancelled,
  bookingConfirmationCustomer,
  escapeHtml,
  reminder2h,
  TemplateContext,
} from "./templates";

const CTX: TemplateContext = {
  businessName: "Harbor & Pine Barbershop",
  serviceName: "Signature Haircut",
  staffName: "Kofi Mensah",
  customerName: "Amara Diallo",
  whenLabel: "Thursday at 2:00 PM",
  dateTimeLabel: "Thursday, March 12 at 2:00 PM",
  bookingReference: "SLT-8F3K2A",
  manageUrl: "https://slotly.app/manage/abc123",
  address: "123 Main St, Philadelphia, PA",
  businessPhone: "(215) 555-0142",
  amountCharged: "$20.00",
  amountDueLater: "$30.00",
  freeCancelUntilLabel: "Wednesday at 2:00 PM",
  inviteUrl: "https://slotly.app/invite/xyz",
  inviteRole: "barber",
};

describe("templates", () => {
  it("every template renders without throwing", () => {
    for (const [name, fn] of Object.entries(ALL_TEMPLATES)) {
      expect(() => fn(CTX), name).not.toThrow();
      const t = fn(CTX);
      expect(t.subject.length, `${name} subject`).toBeGreaterThan(0);
      expect(t.text.length, `${name} text`).toBeGreaterThan(0);
      expect(t.html.length, `${name} html`).toBeGreaterThan(0);
    }
  });

  it("every booking template contains the booking reference and the appointment time", () => {
    // staffInvite is not about a booking time; every other template is.
    const bookingTemplates = {
      bookingConfirmationCustomer: ALL_TEMPLATES.bookingConfirmationCustomer,
      bookingConfirmationBusiness: ALL_TEMPLATES.bookingConfirmationBusiness,
      bookingRescheduled: ALL_TEMPLATES.bookingRescheduled,
      bookingCancelled: ALL_TEMPLATES.bookingCancelled,
      reminder24h: ALL_TEMPLATES.reminder24h,
      reminder2h: ALL_TEMPLATES.reminder2h,
      staffNewBookingAlert: ALL_TEMPLATES.staffNewBookingAlert,
      staffCancellationAlert: ALL_TEMPLATES.staffCancellationAlert,
    };
    for (const [name, fn] of Object.entries(bookingTemplates)) {
      const t = fn(CTX);
      expect(t.text, `${name} text`).toContain(CTX.bookingReference);
      // some templates use the full date-time label instead of the short one
      const hasTime =
        t.text.includes(CTX.whenLabel) || t.text.includes(CTX.dateTimeLabel);
      expect(hasTime, `${name} text has appointment time`).toBe(true);
      expect(t.html, `${name} html`).toContain(escapeHtml(CTX.bookingReference));
    }
  });

  it("confirmation uses the warm Slotly voice", () => {
    const t = bookingConfirmationCustomer(CTX);
    expect(t.text).toContain(`You're booked for ${CTX.whenLabel}.`);
    expect(t.text).toContain(CTX.manageUrl);
    expect(t.text).toContain("free of charge until Wednesday at 2:00 PM");
    for (const tpl of Object.values(ALL_TEMPLATES)) {
      const rendered = tpl(CTX);
      expect(rendered.subject + rendered.text, "no emojis").not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
      );
    }
  });

  it("cancellation includes a refund notice only when a refund was issued", () => {
    const withRefund = bookingCancelled({ ...CTX, refundAmount: "$20.00" });
    expect(withRefund.text).toContain("refund of $20.00");
    expect(withRefund.text).toContain("5–10 business days");

    const plain = bookingCancelled({ ...CTX, refundAmount: undefined });
    expect(plain.text).not.toContain("refund");
  });

  it("reminders carry the manage link", () => {
    expect(reminder2h(CTX).text).toContain(CTX.manageUrl);
  });

  it("html escapes customer input (XSS)", () => {
    const evil = {
      ...CTX,
      customerName: `<script>alert("xss")</script>`,
      businessName: `Evil & Co <img src=x onerror=alert(1)>`,
    };
    // Templates that render the business name in HTML:
    const withBusinessName = new Set([
      "bookingConfirmationCustomer",
      "bookingRescheduled",
      "bookingCancelled",
      "reminder24h",
      "reminder2h",
      "staffInvite",
    ]);
    for (const [name, fn] of Object.entries(ALL_TEMPLATES)) {
      const t = fn(evil);
      expect(t.html, `${name} html`).not.toContain("<script>");
      expect(t.html, `${name} html`).not.toContain("<img src=x");
      expect(t.html, `${name} html`).toContain("&lt;script&gt;");
      if (withBusinessName.has(name)) {
        expect(t.html, `${name} html`).toContain("Evil &amp; Co");
      }
    }
  });

  it("escapeHtml handles the five critical characters", () => {
    expect(escapeHtml(`<a href="x">'&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;");
  });
});
