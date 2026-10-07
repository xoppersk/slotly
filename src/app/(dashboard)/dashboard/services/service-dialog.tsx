"use client";

import * as React from "react";
import { toast } from "sonner";

import { formatCents } from "@/lib/format";
import {
  clampDuration,
  dollarsToCents,
  formatDuration,
} from "@/lib/management";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Slider,
  Switch,
  Textarea,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

import { saveService, type ServiceFormInput } from "./actions";

import type { PaymentPolicy, StaffRow } from "@/lib/supabase/types";

export interface ServiceDialogModel {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  payment_policy: PaymentPolicy;
  deposit_cents: number;
  is_active: boolean;
  staffIds: string[];
}

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null → create mode. */
  service: ServiceDialogModel | null;
  staff: Pick<StaffRow, "id" | "name" | "is_active">[];
  /** Future bookings on this service (for the deactivation warning). */
  futureBookings: number;
  defaultPaymentPolicy: PaymentPolicy;
  onSaved: () => void;
}

const DURATION_MIN = 5;
const DURATION_MAX = 480;
const DURATION_STEP = 5;

export function ServiceDialog({
  open,
  onOpenChange,
  service,
  staff,
  futureBookings,
  defaultPaymentPolicy,
  onSaved,
}: ServiceDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const [price, setPrice] = React.useState("0");
  const [bufferBefore, setBufferBefore] = React.useState("0");
  const [bufferAfter, setBufferAfter] = React.useState("0");
  const [paymentPolicy, setPaymentPolicy] =
    React.useState<PaymentPolicy>("none");
  const [deposit, setDeposit] = React.useState("0");
  const [isActive, setIsActive] = React.useState(true);
  const [staffIds, setStaffIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Reset the form whenever the dialog opens or a different service is
  // edited. Done during render (keyed session) instead of an effect — this is
  // the documented "adjust state when props change" pattern.
  const sessionKey = `${open ? "open" : "closed"}:${service?.id ?? "new"}`;
  const [lastSession, setLastSession] = React.useState(sessionKey);
  if (sessionKey !== lastSession) {
    setLastSession(sessionKey);
    if (open) {
      setFormError(null);
      setSaving(false);
      if (service) {
        setName(service.name);
        setDescription(service.description);
        setDuration(service.duration_minutes);
        setPrice((service.price_cents / 100).toFixed(2));
        setBufferBefore(String(service.buffer_before_minutes));
        setBufferAfter(String(service.buffer_after_minutes));
        setPaymentPolicy(service.payment_policy);
        setDeposit((service.deposit_cents / 100).toFixed(2));
        setIsActive(service.is_active);
        setStaffIds(service.staffIds);
      } else {
        setName("");
        setDescription("");
        setDuration(30);
        setPrice("0.00");
        setBufferBefore("0");
        setBufferAfter("0");
        setPaymentPolicy(defaultPaymentPolicy);
        setDeposit("0.00");
        setIsActive(true);
        setStaffIds(staff.filter((s) => s.is_active).map((s) => s.id));
      }
    }
  }

  const toggleStaff = (id: string) =>
    setStaffIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const showDeactivateWarning =
    !!service && service.is_active && !isActive && futureBookings > 0;

  const handleSave = async () => {
    setFormError(null);
    const priceCents = dollarsToCents(Number(price));
    const depositCents = dollarsToCents(Number(deposit));
    if (depositCents > priceCents) {
      setFormError("Deposit cannot be more than the full price.");
      return;
    }
    if (paymentPolicy === "deposit" && depositCents <= 0) {
      setFormError("A deposit policy needs a deposit amount greater than $0.");
      return;
    }

    const input: ServiceFormInput = {
      id: service?.id,
      name,
      description,
      durationMinutes: clampDuration(duration),
      priceCents,
      bufferBeforeMinutes: Math.max(0, Math.round(Number(bufferBefore) || 0)),
      bufferAfterMinutes: Math.max(0, Math.round(Number(bufferAfter) || 0)),
      paymentPolicy,
      depositCents,
      isActive,
      staffIds,
    };

    setSaving(true);
    try {
      const result = await saveService(input);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(service ? "Service updated" : "Service created");
      onOpenChange(false);
      onSaved();
    } catch {
      setFormError("Could not save the service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>
            {service
              ? "Changes apply to new bookings immediately."
              : "Define what customers can book."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Name</Label>
            <Input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Haircut"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Shown to customers on your booking page.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">Description</Label>
            <Textarea
              id="svc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is included, who it is for…"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Shown under the service name on service cards.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="svc-duration">Duration</Label>
              <span className="tnum text-sm font-medium">
                {formatDuration(duration)}
              </span>
            </div>
            <Slider
              id="svc-duration"
              value={[duration]}
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={DURATION_STEP}
              onValueChange={(v) => setDuration(v[0] ?? 30)}
              aria-label="Service duration in minutes"
            />
            <p className="text-xs text-muted-foreground">
              5-minute steps. Customers see the duration next to the price.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="svc-price">Price (USD)</Label>
              <Input
                id="svc-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tnum"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-buf-before">Buffer before (min)</Label>
              <Input
                id="svc-buf-before"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={bufferBefore}
                onChange={(e) => setBufferBefore(e.target.value)}
                className="tnum"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-buf-after">Buffer after (min)</Label>
              <Input
                id="svc-buf-after"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={bufferAfter}
                onChange={(e) => setBufferAfter(e.target.value)}
                className="tnum"
              />
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Buffers add prep/cleanup time around the appointment that customers
            cannot book into.
          </p>

          <div className="space-y-2">
            <Label>Staff who perform this service</Label>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff members yet — invite your team first.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {staff.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-[0.5rem] border border-border px-3 py-2 transition-colors",
                      staffIds.includes(s.id) && "border-primary/50 bg-primary/5",
                      !s.is_active && "opacity-50",
                    )}
                  >
                    <Checkbox
                      checked={staffIds.includes(s.id)}
                      onCheckedChange={() => toggleStaff(s.id)}
                      aria-label={`Assign ${s.name}`}
                    />
                    <Avatar className="size-7">
                      <AvatarFallback
                        initials={getInitials(s.name)}
                        className="text-[10px]"
                      />
                    </Avatar>
                    <span className="truncate text-sm">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment policy</Label>
            <RadioGroup
              value={paymentPolicy}
              onValueChange={(v) => setPaymentPolicy(v as PaymentPolicy)}
              className="space-y-2"
            >
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[0.5rem] border border-border px-3 py-2.5">
                <RadioGroupItem value="none" id="pp-none" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">
                    No payment now
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Customers book without paying; you collect at the
                    appointment.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[0.5rem] border border-border px-3 py-2.5">
                <RadioGroupItem value="deposit" id="pp-deposit" className="mt-0.5" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">Deposit</span>
                  <span className="block text-xs text-muted-foreground">
                    Charged now; the rest is due at the appointment.
                  </span>
                  {paymentPolicy === "deposit" && (
                    <span className="mt-2 flex items-center gap-2">
                      <Label htmlFor="svc-deposit" className="text-xs">
                        Deposit (USD)
                      </Label>
                      <Input
                        id="svc-deposit"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={deposit}
                        onChange={(e) => setDeposit(e.target.value)}
                        className="tnum w-28"
                      />
                    </span>
                  )}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[0.5rem] border border-border px-3 py-2.5">
                <RadioGroupItem value="full" id="pp-full" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">
                    Full price now{" "}
                    <span className="tnum text-muted-foreground">
                      ({formatCents(dollarsToCents(Number(price) || 0))})
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    The whole amount is charged when booking.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="svc-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive services are hidden from customers.
              </p>
            </div>
            <Switch
              id="svc-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {showDeactivateWarning && (
            <Alert>
              <AlertDescription>
                <span className="tnum font-medium">{futureBookings}</span>{" "}
                upcoming {futureBookings === 1 ? "booking keeps" : "bookings keep"}{" "}
                {futureBookings === 1 ? "its" : "their"} original details —
                deactivating only hides this service from new bookings.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : service ? "Save changes" : "Create service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
