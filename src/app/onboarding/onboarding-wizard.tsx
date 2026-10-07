"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { COMMON_TIMEZONES, clampDuration, defaultWeeklyGrid, dollarsToCents, formatDuration, type WeeklyDayInput } from "@/lib/management";
import { slugify } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Slider } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoursGrid } from "@/components/dashboard/hours-grid";
import { SlugField } from "@/components/dashboard/slug-field";

import { checkSlugAvailability, createBusiness } from "./actions";

const STEPS = ["Business", "First service", "Hours", "Publish"] as const;

export function OnboardingWizard() {
  const [step, setStep] = React.useState(0);

  // Step 1
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [timezone, setTimezone] = React.useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );

  // Step 2
  const [serviceName, setServiceName] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const [price, setPrice] = React.useState("0.00");

  // Step 3
  const [grid, setGrid] = React.useState<WeeklyDayInput[]>(defaultWeeklyGrid());

  // Publish
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const autoSlug = name.trim() !== "" && slug === "";

  const stepValid = (s: number): boolean => {
    if (s === 0) return name.trim() !== "" && slugify(slug) !== "" && timezone !== "";
    if (s === 1) return serviceName.trim() !== "";
    return true;
  };

  const next = () => {
    if (!stepValid(step)) {
      toast.error(
        step === 0
          ? "Add your business name and slug to continue."
          : "Name your first service to continue.",
      );
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const publish = async () => {
    setError(null);
    setPublishing(true);
    try {
      const result = await createBusiness({
        name,
        slug,
        timezone,
        serviceName,
        serviceDurationMinutes: clampDuration(duration),
        servicePriceCents: dollarsToCents(Number(price)),
        weeklyHours: grid,
      });
      if (!result.ok || !result.slug) {
        setError(result.ok ? "Could not create your business." : result.error);
        return;
      }
      setPublishedSlug(result.slug);
    } catch {
      setError("Could not create your business. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    if (!publishedSlug) return;
    const url = `${window.location.origin}/${publishedSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  if (publishedSlug) {
    const url = `/${publishedSlug}`;
    return (
      <Card className="mx-auto w-full max-w-lg space-y-6 p-6 text-center sm:p-8">
        <span
          aria-hidden
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Check className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your booking page is live
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers can now book at{" "}
            <span className="tnum font-medium text-foreground">{url}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={copyLink} variant="secondary" className="gap-1.5">
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild>
            <Link href={url}>Test the booking flow</Link>
          </Button>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your booking page
        </h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
        <Progress value={((step + 1) / STEPS.length) * 100} className="mx-auto max-w-xs" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-4 sm:p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ob-name">Business name</Label>
              <Input
                id="ob-name"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (autoSlug || slug === "") setSlug(slugify(v));
                }}
                placeholder="Harbor & Pine Barbershop"
                maxLength={80}
                autoComplete="organization"
              />
            </div>
            <SlugField
              value={slug}
              onChange={setSlug}
              checkAvailability={checkSlugAvailability}
              id="ob-slug"
            />
            <div className="space-y-1.5">
              <Label htmlFor="ob-tz">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="ob-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                  {!COMMON_TIMEZONES.includes(timezone) && (
                    <SelectItem value={timezone}>
                      {timezone.replace(/_/g, " ")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Your hours and bookings are anchored to this timezone.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="ob-svc">Service name</Label>
              <Input
                id="ob-svc"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Haircut"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                You can add more services, staff, and prices later.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ob-duration">Duration</Label>
                <span className="tnum text-sm font-medium">{formatDuration(duration)}</span>
              </div>
              <Slider
                id="ob-duration"
                value={[duration]}
                min={5}
                max={480}
                step={5}
                onValueChange={(v) => setDuration(v[0] ?? 30)}
                aria-label="Service duration in minutes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-price">Price (USD)</Label>
              <Input
                id="ob-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tnum max-w-40"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When are you usually open? You can fine-tune per-staff hours,
              overrides, and holidays later.
            </p>
            <HoursGrid value={grid} onChange={setGrid} idPrefix="ob" />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Ready to publish?
            </h2>
            <dl className="divide-y divide-border rounded-[0.75rem] border border-border">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Business</dt>
                <dd className="text-sm font-medium">{name}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Booking page</dt>
                <dd className="tnum text-sm font-medium">/{slugify(slug)}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Timezone</dt>
                <dd className="text-sm font-medium">{timezone.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">First service</dt>
                <dd className="tnum text-sm font-medium">
                  {serviceName} · {formatDuration(duration)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">Open days</dt>
                <dd className="tnum text-sm font-medium">
                  {grid.filter((d) => !d.isClosed).length} of 7
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Publishing creates your business, your owner account, the service,
              and your weekly hours all at once.
            </p>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0 || publishing}
          className="gap-1.5"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} className="gap-1.5">
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={publish} disabled={publishing || !stepValid(0) || !stepValid(1)}>
            {publishing ? "Publishing…" : "Publish my booking page"}
          </Button>
        )}
      </div>
    </div>
  );
}
