"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RotateCcw } from "lucide-react";

import {
  Input,
  Textarea,
  Switch,
  Label,
} from "@/components/ui/form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form-field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { StepProps } from "../BookingWizard";
import type { CustomerLookupResponse } from "@/lib/booking/public-api";

/**
 * Details form schema. Mirrors the DB CHECK: at least one of phone/email
 * is required; name is always required; notes are optional.
 */
const detailsSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter your name"),
    phone: z.string().trim(),
    email: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "Enter a valid email address"
      ),
    notes: z.string().trim().max(500, "Keep notes under 500 characters").default(""),
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone or email is required",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Phone or email is required",
      });
    }
  });


/**
 * Wizard Step 4 — Details. RHF + zod with inline per-field errors (the
 * step never resets on validation failure). Repeat customers are matched
 * by phone via GET /api/customers/lookup and get a "Welcome back" pre-fill
 * banner with a "Not you? Clear" action.
 */
export function StepDetails({ ctx, state, update, setPrimary }: StepProps) {
  const { business, services } = ctx;
  const service = services.find((s) => s.id === state.serviceId);
  const [lookupName, setLookupName] = React.useState<string | null>(null);
  const [lookupPending, setLookupPending] = React.useState(false);

  const form = useForm<z.input<typeof detailsSchema>, unknown, z.output<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    mode: "onChange",
    defaultValues: {
      name: state.details.name,
      phone: state.details.phone,
      email: state.details.email,
      notes: state.details.notes,
    },
  });
  const { isValid } = form.formState;

  // Keep the wizard summary panel in sync without forcing revalidation.
  // useWatch is the compiler-safe subscription primitive (form.watch()
  // can't be memoized, so the React Compiler skips components that call
  // it). Deps are the watched scalars only — state.details is fresh from
  // the render that precedes each effect run.
  const [watchedName, watchedPhone, watchedEmail, watchedNotes] = useWatch({
    control: form.control,
    name: ["name", "phone", "email", "notes"],
  });
  React.useEffect(() => {
    update({
      details: {
        ...state.details,
        name: watchedName ?? "",
        phone: watchedPhone ?? "",
        email: watchedEmail ?? "",
        notes: watchedNotes ?? "",
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName, watchedPhone, watchedEmail, watchedNotes]);

  const onNext = () => {
    form.handleSubmit(() => {
      // Values are already synced via the watcher; advance.
      // (Validation gates the footer button, so this always succeeds.)
    })();
  };

  React.useEffect(() => {
    setPrimary({ label: "Continue", onClick: onNext, disabled: !isValid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid]);

  const lookupByPhone = async (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || form.getValues("name").trim()) return;
    setLookupPending(true);
    try {
      const params = new URLSearchParams({
        businessId: business.id,
        phone,
      });
      const res = await fetch(`/api/customers/lookup?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as CustomerLookupResponse | null;
        if (data && data.name && !form.getValues("name").trim()) {
          form.setValue("name", data.name, { shouldValidate: true });
          if (data.email && !form.getValues("email").trim()) {
            form.setValue("email", data.email, { shouldValidate: true });
          }
          setLookupName(data.name);
        }
      }
    } catch {
      // Lookup is a convenience only — never blocks the flow.
    } finally {
      setLookupPending(false);
    }
  };

  const clearPrefill = () => {
    form.setValue("name", "", { shouldValidate: true });
    form.setValue("email", "", { shouldValidate: true });
    setLookupName(null);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Your details
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {service
          ? `Booking ${service.name} — how do we reach you?`
          : "How do we reach you?"}
      </p>

      {lookupName && (
        <Alert className="mt-4 border-primary/30 bg-primary/5">
          <AlertTitle>Welcome back, {lookupName}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>Details from your last visit were filled in.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPrefill}
              className="shrink-0"
            >
              <RotateCcw className="mr-1 size-3.5" aria-hidden />
              Not you? Clear
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={form.handleSubmit(() => onNext())}
          noValidate
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="name"
                    placeholder="Jordan Lee"
                    aria-invalid={!!form.formState.errors.name}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      autoComplete="tel"
                      placeholder="(215) 555-0100"
                      onBlur={(e) => {
                        field.onBlur();
                        lookupByPhone(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="jordan@example.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Phone or email is required — that&apos;s where your manage-booking link
            goes.
          </p>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Notes for the business{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder="Anything they should know before your visit?"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between gap-3 rounded-[0.5rem] border border-border bg-card px-3 py-3">
            <div>
              <Label htmlFor="reminder-opt-in" className="text-sm font-medium">
                Appointment reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Email 24 hours and 2 hours before your visit.
              </p>
            </div>
            <Switch
              id="reminder-opt-in"
              checked={state.details.reminderOptIn}
              onCheckedChange={(checked) =>
                update({ details: { ...state.details, reminderOptIn: checked } })
              }
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to the business&apos;s booking and cancellation
            policy. Free cancellation is available until the stated cutoff —
            the exact window is shown on the review step.
          </p>
          {lookupPending && (
            <span className="sr-only" aria-live="polite">
              Looking up your previous details…
            </span>
          )}
        </form>
      </Form>
    </div>
  );
}
