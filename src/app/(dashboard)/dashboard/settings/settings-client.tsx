"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { formatCents } from "@/lib/format";
import { COMMON_TIMEZONES } from "@/lib/management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Switch, Textarea } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlugField } from "@/components/dashboard/slug-field";
import { StatusChip } from "@/components/ui/StatusChip";

import {
  checkSlugAvailability,
  deleteBusiness,
  setBookingPageEnabled,
  updateBusinessProfile,
  updateDefaultPaymentPolicy,
  updateNotificationPrefs,
  updateReminderPrefs,
  uploadBusinessAsset,
} from "./actions";

import type { BusinessRow, PaymentPolicy, RefundStatus } from "@/lib/supabase/types";

export interface RefundRow {
  id: string;
  amount_cents: number;
  reason: string | null;
  status: RefundStatus;
  created_at: string;
}

interface SettingsClientProps {
  business: BusinessRow;
  refunds: RefundRow[];
  stripeConfigured: boolean;
}

const ACCENT_OPTIONS = [
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
  { value: "violet", label: "Violet" },
  { value: "slate", label: "Slate" },
];

const POLICY_OPTIONS: { value: PaymentPolicy; label: string }[] = [
  { value: "none", label: "No payment now" },
  { value: "deposit", label: "Deposit" },
  { value: "full", label: "Full price now" },
];

function useBusy() {
  const [busy, setBusy] = React.useState(false);
  return { busy, setBusy };
}

export function SettingsClient({ business, refunds, stripeConfigured }: SettingsClientProps) {
  // ---- Business profile ----------------------------------------------------
  const [name, setName] = React.useState(business.name);
  const [slug, setSlug] = React.useState(business.slug);
  const [description, setDescription] = React.useState(business.description);
  const [timezone, setTimezone] = React.useState(business.timezone);
  const [phone, setPhone] = React.useState(business.phone ?? "");
  const [email, setEmail] = React.useState(business.email ?? "");
  const [address, setAddress] = React.useState(business.address ?? "");
  const [accent, setAccent] = React.useState(business.accent_color);
  const [tzConfirmOpen, setTzConfirmOpen] = React.useState(false);
  const [pendingTimezone, setPendingTimezone] = React.useState<string | null>(null);
  const profile = useBusy();

  const requestTimezoneChange = (tz: string) => {
    if (tz === timezone) return;
    if (tz === business.timezone) {
      // Back to the saved value — no warning needed.
      setTimezone(tz);
      return;
    }
    setPendingTimezone(tz);
    setTzConfirmOpen(true);
  };

  const saveProfile = async () => {
    profile.setBusy(true);
    try {
      const result = await updateBusinessProfile({
        name,
        slug,
        description,
        timezone,
        phone,
        email,
        address,
        accentColor: accent,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Business profile updated");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      profile.setBusy(false);
    }
  };

  const uploadAsset = async (kind: "logo" | "cover", file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadBusinessAsset(kind, formData);
      if (!result.ok) toast.error(result.error);
      else toast.success(kind === "logo" ? "Logo updated" : "Cover image updated");
    } catch {
      toast.error("Could not upload the image.");
    }
  };

  // ---- Notifications -------------------------------------------------------
  const [ownerEmail, setOwnerEmail] = React.useState(business.owner_notify_email);
  const [ownerSms, setOwnerSms] = React.useState(business.owner_notify_sms);
  const notif = useBusy();

  const saveNotifications = async () => {
    notif.setBusy(true);
    try {
      const result = await updateNotificationPrefs({
        ownerNotifyEmail: ownerEmail,
        ownerNotifySms: ownerSms,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Notification settings updated");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      notif.setBusy(false);
    }
  };

  // ---- Reminders ------------------------------------------------------------
  const [r24, setR24] = React.useState(business.reminder_24h_enabled);
  const [r2, setR2] = React.useState(business.reminder_2h_enabled);
  const [r24c, setR24c] = React.useState<"email" | "sms">(business.reminder_24h_channel);
  const [r2c, setR2c] = React.useState<"email" | "sms">(business.reminder_2h_channel);
  const reminders = useBusy();

  const saveReminders = async () => {
    reminders.setBusy(true);
    try {
      const result = await updateReminderPrefs({
        reminder24hEnabled: r24,
        reminder2hEnabled: r2,
        reminder24hChannel: r24c,
        reminder2hChannel: r2c,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Reminder settings updated");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      reminders.setBusy(false);
    }
  };

  // ---- Payments --------------------------------------------------------------
  const [defaultPolicy, setDefaultPolicy] = React.useState<PaymentPolicy>(
    business.default_payment_policy,
  );
  const payments = useBusy();

  const saveDefaultPolicy = async () => {
    payments.setBusy(true);
    try {
      const result = await updateDefaultPaymentPolicy(defaultPolicy);
      if (!result.ok) toast.error(result.error);
      else toast.success("Default payment policy updated");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      payments.setBusy(false);
    }
  };

  // ---- Danger zone -------------------------------------------------------------
  const [bookingsPaused, setBookingsPaused] = React.useState(!business.booking_page_enabled);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const danger = useBusy();

  const togglePause = async (paused: boolean) => {
    setBookingsPaused(paused);
    danger.setBusy(true);
    try {
      const result = await setBookingPageEnabled(!paused);
      if (!result.ok) {
        toast.error(result.error);
        setBookingsPaused(!paused);
      } else {
        toast.success(paused ? "New bookings paused" : "Booking page is live");
      }
    } catch {
      toast.error("Could not update the booking page.");
      setBookingsPaused(!paused);
    } finally {
      danger.setBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteBusiness(deleteConfirm);
      // On success this redirects (never returns); on failure show the error.
      if (result && !result.ok) toast.error(result.error);
    } catch {
      toast.error("Could not delete the business.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your business profile, notifications, payments, and danger zone.
        </p>
      </div>

      {/* Business profile */}
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Business profile</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-name">Business name</Label>
            <Input
              id="set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <SlugField
            value={slug}
            onChange={setSlug}
            checkAvailability={checkSlugAvailability}
            currentSlug={business.slug}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logo_url}
                  alt="Business logo"
                  className="size-12 rounded-[0.5rem] border border-border object-cover"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-[0.5rem] border border-dashed border-border text-xs text-muted-foreground">
                  None
                </span>
              )}
              <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAsset("logo", f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cover image</Label>
            <div className="flex items-center gap-3">
              {business.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.cover_url}
                  alt="Business cover"
                  className="h-12 w-24 rounded-[0.5rem] border border-border object-cover"
                />
              ) : (
                <span className="flex h-12 w-24 items-center justify-center rounded-[0.5rem] border border-dashed border-border text-xs text-muted-foreground">
                  None
                </span>
              )}
              <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAsset("cover", f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set-desc">Description</Label>
          <Textarea
            id="set-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What your business does — shown on your booking page."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-tz">Timezone</Label>
            <Select value={timezone} onValueChange={requestTimezoneChange}>
              <SelectTrigger id="set-tz">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-accent">Booking page accent</Label>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger id="set-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCENT_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-phone">Phone</Label>
            <Input
              id="set-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-email">Contact email</Label>
            <Input
              id="set-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-address">Address</Label>
            <Input
              id="set-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveProfile} disabled={profile.busy}>
            {profile.busy ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>

      {/* Timezone warning modal */}
      <Dialog open={tzConfirmOpen} onOpenChange={setTzConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change timezone?</DialogTitle>
            <DialogDescription>
              Future bookings stay pinned to their original times — a 2:00 PM
              appointment stays 2:00 PM on the customer&apos;s calendar, but it will
              now mean 2:00 PM in the new timezone. Availability hours are
              interpreted in the new timezone from the moment you save.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTzConfirmOpen(false);
                setPendingTimezone(null);
              }}
            >
              Keep {business.timezone.replace(/_/g, " ")}
            </Button>
            <Button
              onClick={() => {
                if (pendingTimezone) setTimezone(pendingTimezone);
                setTzConfirmOpen(false);
                setPendingTimezone(null);
              }}
            >
              I understand — change it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications */}
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="set-owner-email">Owner email alerts</Label>
              <p className="text-xs text-muted-foreground">
                Email you about new bookings, cancellations, and payments.
              </p>
            </div>
            <Switch
              id="set-owner-email"
              checked={ownerEmail}
              onCheckedChange={setOwnerEmail}
            />
          </div>
          <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="set-owner-sms">Owner SMS alerts</Label>
              <p className="text-xs text-muted-foreground">
                Text you about new bookings and cancellations.
              </p>
            </div>
            <Switch
              id="set-owner-sms"
              checked={ownerSms}
              onCheckedChange={setOwnerSms}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Staff alerts are managed per person on the Staff page.
        </p>
        <div className="flex justify-end">
          <Button onClick={saveNotifications} disabled={notif.busy}>
            {notif.busy ? "Saving…" : "Save notifications"}
          </Button>
        </div>
      </Card>

      {/* Reminders */}
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Reminders</h2>
        <div className="space-y-3">
          {(
            [
              {
                key: "24h",
                label: "24-hour reminder",
                enabled: r24,
                setEnabled: setR24,
                channel: r24c,
                setChannel: setR24c,
              },
              {
                key: "2h",
                label: "2-hour reminder",
                enabled: r2,
                setEnabled: setR2,
                channel: r2c,
                setChannel: setR2c,
              },
            ] as const
          ).map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-[0.5rem] border border-border px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Switch
                  id={`set-rem-${row.key}`}
                  checked={row.enabled}
                  onCheckedChange={row.setEnabled}
                  aria-label={row.label}
                />
                <Label htmlFor={`set-rem-${row.key}`}>{row.label}</Label>
              </div>
              <Select
                value={row.channel}
                onValueChange={(v) => row.setChannel(v as "email" | "sms")}
                disabled={!row.enabled}
              >
                <SelectTrigger className="w-28" aria-label={`${row.label} channel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={saveReminders} disabled={reminders.busy}>
            {reminders.busy ? "Saving…" : "Save reminders"}
          </Button>
        </div>
      </Card>

      {/* Payments */}
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Payments</h2>
        <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Stripe</p>
            <p className="text-xs text-muted-foreground">
              {stripeConfigured
                ? "Test-mode keys detected. Payments run in test mode."
                : "Not connected — add Stripe test keys to accept deposits and full payments."}
            </p>
          </div>
          <Badge variant={stripeConfigured ? "default" : "secondary"}>
            {stripeConfigured ? "Test mode" : "Not connected"}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set-default-policy">Default payment policy</Label>
          <Select
            value={defaultPolicy}
            onValueChange={(v) => setDefaultPolicy(v as PaymentPolicy)}
          >
            <SelectTrigger id="set-default-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLICY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Pre-selected when you create a new service. Existing services keep
            their own policy.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveDefaultPolicy} disabled={payments.busy}>
            {payments.busy ? "Saving…" : "Save payment settings"}
          </Button>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold">Refund history</h3>
          {refunds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No refunds issued yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-[0.5rem] border border-border">
              {refunds.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="tnum text-sm font-medium">
                      {formatCents(r.amount_cents)}
                    </p>
                    <p className="tnum truncate text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </p>
                  </div>
                  <StatusChip
                    status={
                      r.status === "succeeded"
                        ? "refunded"
                        : r.status === "failed"
                          ? "failed"
                          : "pending"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="space-y-4 border-destructive/30 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
          Danger zone
        </h2>

        <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="set-pause">Pause new bookings</Label>
            <p className="text-xs text-muted-foreground">
              Your public booking page goes offline; existing bookings are
              untouched.
            </p>
          </div>
          <Switch
            id="set-pause"
            checked={bookingsPaused}
            onCheckedChange={togglePause}
            disabled={danger.busy}
          />
        </div>

        <div className="space-y-2 rounded-[0.5rem] border border-border p-3">
          <Label htmlFor="set-delete-confirm">Delete this business</Label>
          <p className="text-xs text-muted-foreground">
            This permanently deletes the business, its services, staff,
            bookings, and availability. This cannot be undone.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="set-delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={`Type "${business.name}" to confirm`}
              className="flex-1"
            />
            <Button
              variant="destructive"
              disabled={deleting || deleteConfirm.trim() !== business.name}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete business"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
