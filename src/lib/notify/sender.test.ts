import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetEnvCache } from "../env";
import {
  consoleSender,
  defaultSender,
  isSendSuccess,
  resendSender,
  twilioSender,
} from "./sender";

afterEach(() => {
  __resetEnvCache();
  vi.unstubAllEnvs();
});

describe("consoleSender", () => {
  it("always succeeds for email and sms", async () => {
    const sender = consoleSender();
    const email = await sender.sendEmail({
      to: "a@b.com",
      subject: "hi",
      text: "t",
      html: "<p>t</p>",
    });
    expect(isSendSuccess(email)).toBe(true);

    const sms = await sender.sendSms({ to: "+123", body: "hello" });
    expect(isSendSuccess(sms)).toBe(true);
    if (isSendSuccess(sms)) expect(sms.id.startsWith("console-sms-")).toBe(true);
  });
});

describe("provider fallbacks", () => {
  it("resendSender falls back to the console sender when env is missing (never throws)", async () => {
    const sender = resendSender(); // must not throw at construction
    const result = await sender.sendEmail({
      to: "a@b.com",
      subject: "hi",
      text: "t",
      html: "<p>t</p>",
    });
    expect(isSendSuccess(result)).toBe(true);
    if (isSendSuccess(result)) expect(result.id.startsWith("console-")).toBe(true);
  });

  it("twilioSender falls back to the console sender when env is missing (never throws)", async () => {
    const sender = twilioSender();
    const result = await sender.sendSms({ to: "+123", body: "hello" });
    expect(isSendSuccess(result)).toBe(true);
    if (isSendSuccess(result)) expect(result.id.startsWith("console-")).toBe(true);
  });

  it("defaultSender degrades both channels without throwing", async () => {
    const sender = defaultSender();
    const email = await sender.sendEmail({
      to: "a@b.com",
      subject: "hi",
      text: "t",
      html: "<p>t</p>",
    });
    const sms = await sender.sendSms({ to: "+123", body: "hello" });
    expect(isSendSuccess(email)).toBe(true);
    expect(isSendSuccess(sms)).toBe(true);
  });
});
