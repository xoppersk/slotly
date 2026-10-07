"use client";

import { Input, Label, Textarea } from "@/components/ui/form";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createBookingOnBehalf } from "../../../_actions/bookings";
import {
  getBookingCatalog,
  type BookingCatalog,
} from "../../../_actions/scheduling";
import { SlotPicker, type PickedSlot } from "./slot-picker";
import { formatDateTimeLabel } from "@/lib/dashboard/format";

interface NewBookingWizardProps {
  businessId: string;
  timezone: string;
}

const STEPS = ["Service", "Time", "Customer"] as const;

/**
 * Book-on-behalf compact wizard: service → slot (scoped picker) →
 * customer details. Creates via the create_booking RPC (customer upsert
 * stays server-side); the customer is notified with their manage link.
 */
export function NewBookingWizard({ businessId, timezone }: NewBookingWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<BookingCatalog | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const result = await getBookingCatalog(businessId);
      if (!cancelled && !("error" in result)) setCatalog(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, businessId]);

  const reset = () => {
    setStep(0);
    setServiceId(null);
    setSlot(null);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setError(null);
  };

  const service = catalog?.services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = (catalog?.staff ?? []).filter((s) =>
    service ? (catalog?.serviceStaff[service.id] ?? []).includes(s.id) : true
  );

  const canNext =
    (step === 0 && serviceId !== null) ||
    (step === 1 && slot !== null) ||
    (step === 2 && name.trim().length > 0 && (phone.trim() || email.trim()));

  const submit = () => {
    if (!service || !slot) return;
    setError(null);
    startTransition(async () => {
      const result = await createBookingOnBehalf({
        businessId,
        serviceId: service.id,
        staffId: slot.staffId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        customerEmail: email.trim() || undefined,
        customerNotes: notes.trim() || undefined,
      });
      if (!result.ok) {
        setError(friendlyError(result.error));
        return;
      }
      toast.success("Booking created and the customer was notified");
      setOpen(false);
      reset();
      router.push(`/dashboard/bookings?booking=${result.bookingId}`);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          New booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
        </DialogHeader>

        <ol className="flex items-center gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "tnum flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  i === step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="mx-1 h-px w-6 bg-border" aria-hidden />
              )}
            </li>
          ))}
        </ol>
        <Separator />

        {step === 0 && (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Service">
            {!catalog ? (
              <p className="text-sm text-muted-foreground">Loading services…</p>
            ) : catalog.services.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No active services yet — create one under Services first.
                </AlertDescription>
              </Alert>
            ) : (
              catalog.services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={serviceId === s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setSlot(null);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-[0.75rem] border p-3 text-left transition-colors",
                    serviceId === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="tnum text-xs text-muted-foreground">
                      {s.duration_minutes} min
                    </span>
                  </span>
                  <span className="tnum text-sm font-medium">
                    {formatCents(s.price_cents)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {step === 1 && service && (
          <SlotPicker
            businessId={businessId}
            serviceId={service.id}
            staff={eligibleStaff}
            selectedSlot={slot}
            onSelect={setSlot}
          />
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            {service && slot && (
              <p className="tnum rounded-[0.5rem] bg-muted px-3 py-2 text-sm">
                {service.name} · {formatDateTimeLabel(slot.startsAt, timezone)}
              </p>
            )}
            <div>
              <Label htmlFor="nb-name">Customer name</Label>
              <Input
                id="nb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="nb-phone">Phone</Label>
                <Input
                  id="nb-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                  className="tnum"
                />
              </div>
              <div>
                <Label htmlFor="nb-email">Email</Label>
                <Input
                  id="nb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              Phone or email is required — the confirmation goes there.
            </p>
            <div>
              <Label htmlFor="nb-notes">Notes (optional)</Label>
              <Textarea
                id="nb-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the business should know"
                rows={2}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            disabled={step === 0 || pending}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button disabled={!canNext || pending} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button disabled={!canNext || pending} onClick={submit}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create booking
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    not_authorized: "You are not authorized for this business.",
    slot_taken: "That slot was just taken — pick another time.",
  };
  return map[code] ?? code.replace(/_/g, " ");
}
