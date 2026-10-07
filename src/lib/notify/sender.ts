/**
 * Notification sender abstraction (email via Resend, SMS via Twilio).
 *
 * SERVER ONLY — never import from a Client Component. Providers are built
 * lazily from `getEnv()` inside the factory functions, so importing this
 * module never throws: when keys are missing, each factory falls back to
 * `consoleSender()` (logs in dev, always "succeeds") instead of failing.
 */

import { getEnv } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export type SendResult = { id: string } | { error: string };

export interface NotificationSender {
  sendEmail(message: EmailMessage): Promise<SendResult>;
  sendSms(message: SmsMessage): Promise<SendResult>;
}

export function isSendSuccess(result: SendResult): result is { id: string } {
  return "id" in result;
}

/** Read env defensively — returns null when env isn't configured (tests, local dev). */
function tryGetEnv(): ReturnType<typeof getEnv> | null {
  try {
    return getEnv();
  } catch {
    return null;
  }
}

/**
 * Dev/test sender: logs the message (except under test) and always reports
 * success with a synthetic id.
 */
export function consoleSender(tag = "notify"): NotificationSender {
  const log = (line: string) => {
    if (process.env.NODE_ENV !== "test") console.log(`[${tag}] ${line}`);
  };
  return {
    async sendEmail({ to, subject }) {
      log(`email -> ${to}: ${subject}`);
      return { id: `console-email-${Date.now()}` };
    },
    async sendSms({ to, body }) {
      log(`sms -> ${to}: ${body.slice(0, 80)}`);
      return { id: `console-sms-${Date.now()}` };
    },
  };
}

const RESEND_API = "https://api.resend.com/emails";

/**
 * Email via Resend. Falls back to `consoleSender` when no API key is
 * configured. SMS is not a Resend channel — it also goes to the console
 * sender so callers can use one sender object for both.
 */
export function resendSender(): NotificationSender {
  const apiKey = tryGetEnv()?.RESEND_API_KEY || null;
  const fallback = consoleSender("resend-fallback");
  if (!apiKey) return fallback;
  const from = "Slotly <noreply@slotly.app>";

  return {
    async sendEmail({ to, subject, text, html }) {
      try {
        const res = await fetch(RESEND_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to, subject, text, html }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return { error: `Resend error ${res.status}: ${detail.slice(0, 200)}` };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { id: data.id ?? `resend-${Date.now()}` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
    sendSms: (message) => fallback.sendSms(message),
  };
}

/**
 * SMS via Twilio. Falls back to `consoleSender` when the account SID, auth
 * token, or from-number is missing. Email is not a Twilio channel — it goes
 * to the console sender.
 */
export function twilioSender(): NotificationSender {
  const env = tryGetEnv();
  const sid = env?.TWILIO_ACCOUNT_SID || null;
  const authToken = env?.TWILIO_AUTH_TOKEN || null;
  const from = env?.TWILIO_FROM_NUMBER || null;
  const fallback = consoleSender("twilio-fallback");
  if (!sid || !authToken || !from) return fallback;

  return {
    sendEmail: (message) => fallback.sendEmail(message),
    async sendSms({ to, body }) {
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
          },
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return { error: `Twilio error ${res.status}: ${detail.slice(0, 200)}` };
        }
        const data = (await res.json().catch(() => ({}))) as { sid?: string };
        return { id: data.sid ?? `twilio-${Date.now()}` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

/**
 * Default sender: email via Resend, SMS via Twilio, each silently degrading
 * to the console sender when its keys are missing. Never throws at
 * construction time.
 */
export function defaultSender(): NotificationSender {
  const email = resendSender();
  const sms = twilioSender();
  return {
    sendEmail: (message) => email.sendEmail(message),
    sendSms: (message) => sms.sendSms(message),
  };
}
