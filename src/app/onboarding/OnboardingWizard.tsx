"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { IconArrowRight } from "@/components/sl/icons";
import { checkSlugAvailability, completeOnboarding, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

const STEP_NAMES = ["Business", "Services", "Hours", "Publish"] as const;

/** Display order (Mon first) mapped to PostgreSQL weekday numbers (0 = Sun). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

function defaultHours(): Record<number, DayHours> {
  const hours: Record<number, DayHours> = {};
  for (const weekday of DAY_ORDER) {
    hours[weekday] =
      weekday >= 1 && weekday <= 5
        ? { closed: false, open: "09:00", close: "17:00" }
        : { closed: true, open: "09:00", close: "17:00" };
  }
  return hours;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function timezoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];
  }
}

/* Onboarding wizard — steps 1-4 of the drawn sign-up flow (Business →
   Services → Hours → Publish), run after the first real sign-in. Submitting
   the Publish step calls the create_business_setup PostgreSQL function via
   completeOnboarding; the new owner's public page is live at /b/<slug>
   immediately (booking_page_enabled defaults true). */
export function OnboardingWizard({
  ownerName,
  initialBusinessName,
}: {
  ownerName: string;
  initialBusinessName: string;
}) {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const [step, setStep] = useState(1);

  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [slug, setSlug] = useState(() => slugify(initialBusinessName));
  const slugEdited = useRef(false);
  const [slugMessage, setSlugMessage] = useState<string | null>(null);
  const [slugOk, setSlugOk] = useState(false);
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch {
      return "America/New_York";
    }
  });
  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState<Record<number, DayHours>>(defaultHours);

  const timezones = useMemo(() => timezoneOptions(), []);

  // Live slug availability (debounced) against businesses_public. The
  // "Checking…" state is set by the slug change handlers; this effect only
  // does the async check.
  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(async () => {
      const result = await checkSlugAvailability(slug);
      if (!result.valid) {
        setSlugOk(false);
        setSlugMessage(result.message ?? "That page name can't be used.");
      } else if (!result.available) {
        setSlugOk(false);
        setSlugMessage(result.message ?? "That page name is taken — try another.");
      } else {
        setSlugOk(true);
        setSlugMessage("Available — this will be your public page name.");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  /** Single path for slug changes (typed directly, or derived from the
   *  business name): resets the availability state to "checking". */
  function applySlug(nextSlug: string) {
    setSlug(nextSlug);
    setSlugOk(false);
    setSlugMessage(nextSlug ? "Checking…" : null);
  }

  const priceCents = useMemo(() => {
    const n = Number.parseFloat(price);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }, [price]);

  const weeklyHoursJson = useMemo(
    () =>
      JSON.stringify(
        DAY_ORDER.map((weekday) => {
          const day = hours[weekday] ?? { closed: true, open: "09:00", close: "17:00" };
          return {
            weekday,
            is_closed: day.closed,
            open_time: day.open,
            close_time: day.close,
          };
        }),
      ),
    [hours],
  );

  const stepValid =
    step === 1
      ? businessName.trim().length > 0 && slug.length >= 3 && slugOk
      : step === 2
        ? serviceName.trim().length > 0 &&
          Number(duration) >= 5 &&
          Number(duration) <= 480 &&
          price.trim().length > 0 &&
          Number.isFinite(Number.parseFloat(price)) &&
          Number.parseFloat(price) >= 0
        : true;

  return (
    <>
      <ol className="sl-steps" aria-label="Setup steps">
        {STEP_NAMES.map((name, i) => (
          <li key={name} className={i < step ? "on" : undefined}>
            <span className="sl-sr-only">
              Step {i + 1} of 4{ i + 1 === step ? ", current" : ""}: {name}
            </span>
          </li>
        ))}
      </ol>
      <p className="sl-steps-eyebrow">
        Step {step} of 4 · {STEP_NAMES[step - 1]}
        {step < 4 ? ` · then ${STEP_NAMES.slice(step).join(", ").toLowerCase()}` : ""}
      </p>

      {state.error && (
        <p className="sl-auth-note" role="alert" style={{ margin: "0 0 20px" }}>
          {state.error}
        </p>
      )}

      <form className="sl-form" action={formAction}>
        {step === 1 && (
          <>
            <h1 className="sl-auth-h1">Name your business</h1>
            <p className="sl-auth-sub" style={{ marginBottom: 28 }}>
              {ownerName ? `Welcome, ${ownerName}. ` : ""}This is the business your customers will book
              with — yours, set up from scratch.
            </p>
            <div className="sl-field">
              <label htmlFor="bn">Business name</label>
              <input
                id="bn"
                className="sl-inp"
                required
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (!slugEdited.current) applySlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="sl-field">
              <label htmlFor="slug">Page name</label>
              <input
                id="slug"
                className="sl-inp"
                required
                value={slug}
                onChange={(e) => {
                  slugEdited.current = true;
                  applySlug(slugify(e.target.value));
                }}
              />
              <span className="sl-hint">
                Your page: slotly.app/b/{slug || "your-business"}
                {slugMessage ? ` — ${slugMessage}` : ""}
              </span>
            </div>
            <div className="sl-field">
              <label htmlFor="tz">Timezone</label>
              <select
                id="tz"
                className="sl-inp"
                value={timezone}
                suppressHydrationWarning
                onChange={(e) => setTimezone(e.target.value)}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <span className="sl-hint">Booking times are shown to customers in this timezone.</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="sl-auth-h1">Your first service</h1>
            <p className="sl-auth-sub" style={{ marginBottom: 28 }}>
              You can add more services later — this one gets your page started.
            </p>
            <div className="sl-field">
              <label htmlFor="sn">Service name</label>
              <input
                id="sn"
                className="sl-inp"
                required
                placeholder="e.g. Haircut"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </div>
            <div className="sl-field">
              <label htmlFor="dur">Duration (minutes)</label>
              <input
                id="dur"
                className="sl-inp"
                type="number"
                min={5}
                max={480}
                step={5}
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="sl-field">
              <label htmlFor="pr">Price (USD)</label>
              <input
                id="pr"
                className="sl-inp"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="25.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <span className="sl-hint">Customers pay you directly — Slotly never takes the payment in the app.</span>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="sl-auth-h1">When are you open?</h1>
            <p className="sl-auth-sub" style={{ marginBottom: 28 }}>
              Customers can only book inside these hours. Defaults are Monday to Friday, 9 to 5.
            </p>
            {DAY_ORDER.map((weekday) => {
              const day: DayHours = hours[weekday] ?? { closed: true, open: "09:00", close: "17:00" };
              return (
                <div className="sl-field" key={weekday}>
                  <div className="sl-field-head">
                    <label htmlFor={`open-${weekday}`}>{DAY_LABELS[weekday]}</label>
                    <label style={{ fontWeight: 400, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={day.closed}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [weekday]: { ...day, closed: e.target.checked } }))
                        }
                      />{" "}
                      Closed
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      id={`open-${weekday}`}
                      className="sl-inp"
                      type="time"
                      disabled={day.closed}
                      value={day.open}
                      onChange={(e) =>
                        setHours((h) => ({ ...h, [weekday]: { ...day, open: e.target.value } }))
                      }
                    />
                    <span aria-hidden="true">to</span>
                    <input
                      className="sl-inp"
                      type="time"
                      aria-label={`${DAY_LABELS[weekday]} closing time`}
                      disabled={day.closed}
                      value={day.close}
                      onChange={(e) =>
                        setHours((h) => ({ ...h, [weekday]: { ...day, close: e.target.value } }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="sl-auth-h1">Ready to publish</h1>
            <p className="sl-auth-sub" style={{ marginBottom: 28 }}>
              Publishing creates your business and makes your booking page live.
            </p>
            <div className="sl-field">
              <span className="sl-hint">Business</span>
              <p style={{ margin: 0, fontSize: 15 }}>
                {businessName} · {timezone.replace(/_/g, " ")}
              </p>
            </div>
            <div className="sl-field">
              <span className="sl-hint">Public booking page</span>
              <p style={{ margin: 0, fontSize: 15 }}>
                slotly.app/b/{slug} — live as soon as you publish, at{" "}
                <a href={`/b/${slug}`}>/b/{slug}</a>
              </p>
            </div>
            <div className="sl-field">
              <span className="sl-hint">First service</span>
              <p style={{ margin: 0, fontSize: 15 }}>
                {serviceName} · {duration} min · ${(priceCents / 100).toFixed(2)}
              </p>
            </div>
            <div className="sl-field">
              <span className="sl-hint">Weekly hours</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
                {DAY_ORDER.map((weekday) => {
                  const day: DayHours = hours[weekday] ?? { closed: true, open: "09:00", close: "17:00" };
                  return (
                    <span key={weekday} style={{ display: "block" }}>
                      {DAY_LABELS[weekday]}:{" "}
                      {day.closed ? "Closed" : `${day.open} – ${day.close}`}
                    </span>
                  );
                })}
              </p>
            </div>
          </>
        )}

        {/* The action reads these hidden mirrors of the wizard state, so
            values from every step are present no matter which step is
            mounted when the form submits. */}
        <input type="hidden" name="businessName" value={businessName} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="timezone" value={timezone} />
        <input type="hidden" name="serviceName" value={serviceName} />
        <input type="hidden" name="serviceDurationMinutes" value={duration} />
        <input type="hidden" name="servicePriceCents" value={priceCents} />
        <input type="hidden" name="weeklyHours" value={weeklyHoursJson} />

        {step < 4 ? (
          <button
            type="button"
            className="sl-pri"
            style={{ marginTop: 6 }}
            disabled={!stepValid}
            onClick={() => setStep((s) => Math.min(4, s + 1))}
          >
            Continue <IconArrowRight />
          </button>
        ) : (
          <button type="submit" className="sl-pri" style={{ marginTop: 6 }} disabled={pending}>
            Publish my page <IconArrowRight />
          </button>
        )}
        {step > 1 && (
          <button
            type="button"
            className="sl-sec"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </button>
        )}
      </form>
    </>
  );
}
