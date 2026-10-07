"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { formatSlotForCustomer, formatDayLabel } from "@/lib/availability";
import { WizardProgress } from "./WizardProgress";
import { StepService } from "./steps/StepService";
import { StepStaff } from "./steps/StepStaff";
import { StepDateTime } from "./steps/StepDateTime";
import { StepDetails } from "./steps/StepDetails";
import { StepPayment } from "./steps/StepPayment";
import { StepReview } from "./steps/StepReview";

import type { WizardContext, WizardState, WizardStepId } from "./types";
import { EMPTY_DETAILS, INITIAL_STATE } from "./types";

/**
 * BookingWizard — the 6-step booking wizard (5 steps when the service's
 * payment policy is `none`; the payment step is skipped).
 *
 * Layout: progress indicator + step content, sticky bottom action bar on
 * mobile, side summary panel on desktop. Each step owns its UI and reports
 * its footer actions (primary button label/disabled/loading) up through
 * the `setPrimary` callback — the wizard renders the Back button itself.
 */
export interface PrimaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface StepProps {
  ctx: WizardContext;
  slug: string;
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  setPrimary: (action: PrimaryAction | null) => void;
  preselect: { serviceId: string | null; staffId: string | null };
  customerTimezone: string;
}

interface BookingWizardProps extends WizardContext {
  slug: string;
  preselect: { serviceId: string | null; staffId: string | null };
}

function stepsForPaymentPolicy(policy: string): WizardStepId[] {
  const base: WizardStepId[] = ["service", "staff", "datetime", "details"];
  return policy === "none" ? [...base, "review"] : [...base, "payment", "review"];
}

export function BookingWizard({
  business,
  services,
  staff,
  slug,
  preselect,
}: BookingWizardProps) {
  const ctx: WizardContext = { business, services, staff };
  const customerTimezone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const [state, setState] = React.useState<WizardState>(() => {
    // Single-staff businesses auto-skip the staff step with a note.
    const singleStaff = staff.length === 1 ? staff[0]?.id ?? null : null;
    return {
      ...INITIAL_STATE,
      serviceId: preselect.serviceId,
      staffId: preselect.staffId ?? singleStaff,
      details: { ...EMPTY_DETAILS },
    };
  });
  const [stepIndex, setStepIndex] = React.useState(() =>
    preselect.serviceId ? 1 : 0
  );
  const [primary, setPrimary] = React.useState<PrimaryAction | null>(null);

  const service = services.find((s) => s.id === state.serviceId) ?? null;
  const staffMember =
    staff.find((s) => s.id === state.staffId) ?? null;
  const steps = stepsForPaymentPolicy(service?.payment_policy ?? "none");
  // Keep the step index valid when the payment policy changes mid-flow
  // (goTo already clamps, so this is render-time only — no effect needed).
  const currentIndex = Math.min(stepIndex, steps.length - 1);
  const stepId = steps[currentIndex] ?? "service";

  const update = React.useCallback(
    (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch })),
    []
  );

  const goTo = React.useCallback(
    (index: number) => {
      setPrimary(null);
      setStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
    },
    [steps.length]
  );

  const onNext = React.useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex]);
  const onBack = React.useCallback(() => {
    if (stepIndex > 0) goTo(stepIndex - 1);
  }, [goTo, stepIndex]);


  const stepProps: StepProps = {
    ctx,
    slug,
    state,
    update,
    onNext,
    onBack,
    setPrimary,
    preselect,
    customerTimezone,
  };

  // Changing the service resets downstream selections (new slot engine inputs).
  const handleServiceStepProps: StepProps = {
    ...stepProps,
    update: (patch) => {
      if ("serviceId" in patch && patch.serviceId !== state.serviceId) {
        update({
          ...patch,
          staffId: staff.length === 1 ? staff[0]?.id ?? null : null,
          dayKey: null,
          slot: null,
          payment: null,
          confirmedBooking: null,
          slotRaceNotice: null,
        });
      } else {
        update(patch);
      }
    },
  };

  const preselectedService =
    preselect.serviceId && preselect.serviceId === state.serviceId
      ? services.find((s) => s.id === preselect.serviceId)
      : null;

  const summaryLines = React.useMemo(() => {
    const lines: { icon?: "service" | "staff" | "datetime" | "policy"; label: string; value: string }[] = [];
    if (service) {
      lines.push({
        icon: "service",
        label: "Service",
        value: `${service.name} · ${service.duration_minutes} min`,
      });
    }
    if (state.staffId === "any") {
      lines.push({ icon: "staff", label: "Staff", value: "First available" });
    } else if (staffMember) {
      lines.push({ icon: "staff", label: "Staff", value: staffMember.name });
    }
    if (state.slot) {
      const dual = formatSlotForCustomer(
        state.slot.startsAt,
        business.timezone,
        customerTimezone
      );
      const dayLabel = formatDayLabel(state.dayKey ?? "", business.timezone);
      lines.push({
        icon: "datetime",
        label: "When",
        value: dual.showDual
          ? `${dayLabel} · ${dual.customerLabel} your time (${dual.businessLabel} business time)`
          : `${dayLabel} at ${dual.customerLabel}`,
      });
    }
    if (state.payment && state.payment.amountDueKind) {
      lines.push({
        icon: "policy",
        label: "Payment",
        value: `${formatCents(state.payment.amountDueCents)} due now`,
      });
    } else if (service && service.payment_policy === "none") {
      lines.push({
        icon: "policy",
        label: "Payment",
        value: `${formatCents(service.price_cents)} due at appointment`,
      });
    }
    return lines;
  }, [service, state, staffMember, business.timezone, customerTimezone]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Compact business header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/${slug}`}
            className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span className="truncate font-medium">{business.name}</span>
          </Link>
          <Badge variant="outline" className="tnum shrink-0">
            Book online
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-4 py-6 pb-32 lg:pb-16">
        {/* Main column */}
        <main className="min-w-0 flex-1">
          <WizardProgress steps={steps} currentIndex={currentIndex} />

          {preselectedService && stepIndex > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[0.5rem] border border-border bg-card px-3 py-2">
              <p className="truncate text-sm">
                <span className="text-muted-foreground">Pre-selected: </span>
                <span className="font-medium">{preselectedService.name}</span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo(0)}
                className="shrink-0"
              >
                <Pencil className="mr-1 size-3.5" aria-hidden />
                Change
              </Button>
            </div>
          )}

          <div className="mt-6">
            {stepId === "service" && (
              <StepService {...handleServiceStepProps} />
            )}
            {stepId === "staff" && <StepStaff {...stepProps} />}
            {stepId === "datetime" && <StepDateTime {...stepProps} />}
            {stepId === "details" && <StepDetails {...stepProps} />}
            {stepId === "payment" && (
              <StepPayment {...stepProps} goToStep={goTo} steps={steps} />
            )}
            {stepId === "review" && (
              <StepReview {...stepProps} goToStep={goTo} steps={steps} />
            )}
          </div>
        </main>

        {/* Desktop side summary panel */}
        <aside
          aria-label="Booking summary"
          className="hidden w-80 shrink-0 lg:block"
        >
          <div className="sticky top-6">
            {summaryLines.length > 0 ? (
              <BookingSummaryCard
                lines={summaryLines}
                totalCents={service ? service.price_cents : null}
              />
            ) : (
              <div className="rounded-[0.75rem] border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Your booking summary appears here as you go.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Sticky bottom action bar (mobile); inline on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:static lg:z-auto lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:justify-end lg:pb-8 lg:pt-0">
          {stepId !== "service" ? (
            <Button
              variant="outline"
              onClick={onBack}
              className="min-h-[48px]"
            >
              Back
            </Button>
          ) : (
            <span className={cn("lg:hidden")} />
          )}
          {primary && (
            <Button
              variant="primary"
              onClick={primary.onClick}
              disabled={primary.disabled || primary.loading}
              className="min-h-[48px] flex-1 lg:flex-none lg:px-10"
            >
              {primary.loading ? "Working…" : primary.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
