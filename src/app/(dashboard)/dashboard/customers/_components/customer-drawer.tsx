"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Phone, Mail, Check } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/form";
import { Label } from "@/components/ui/form";
import { formatCents } from "@/lib/format";
import {
  formatDateTimeLabel,
  formatDateShort,
} from "@/lib/dashboard/format";
import {
  getCustomerProfile,
  updateCustomerNotes,
  type CustomerProfile,
} from "../../../_actions/customers";
import { BookingStatusChip } from "../../../_components/booking-status-chip";

interface CustomerDrawerProps {
  businessId: string;
  customerId: string;
  timezone: string;
}

/**
 * Customer profile drawer: contact info, visit timeline, private notes
 * (autosaved), no-show badge. Open state is driven by `?customer=`.
 */
export function CustomerDrawer({
  businessId,
  customerId,
  timezone,
}: CustomerDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("customer");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getCustomerProfile(businessId, customerId);
      if (!cancelled) {
        setProfile(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, customerId]);

  return (
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
        aria-label="Customer profile"
      >
        {loading || !profile ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-40 w-full rounded-[0.75rem]" />
          </div>
        ) : (
          <ProfileBody
            profile={profile}
            businessId={businessId}
            timezone={timezone}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProfileBody({
  profile,
  businessId,
  timezone,
}: {
  profile: CustomerProfile;
  businessId: string;
  timezone: string;
}) {
  const { customer, visits } = profile;

  return (
    <>
      <SheetHeader className="px-6 pt-6 text-left">
        <div className="flex items-center justify-between gap-2 pr-8">
          <SheetTitle className="truncate">{customer.name}</SheetTitle>
          {customer.no_show_count > 0 && (
            <span className="tnum shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
              {customer.no_show_count} no-show{customer.no_show_count === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <SheetDescription>
          Customer since{" "}
          <span className="tnum">{formatDateShort(customer.created_at, timezone)}</span>
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="flex flex-col gap-5 pb-6">
          <section aria-label="Contact">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact
            </h3>
            <div className="rounded-[0.75rem] border border-border p-3 text-sm">
              {customer.phone && (
                <p className="tnum flex items-center gap-1.5">
                  <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                  {customer.phone}
                </p>
              )}
              {customer.email && (
                <p className="mt-1 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                  {customer.email}
                </p>
              )}
              {!customer.phone && !customer.email && (
                <p className="text-muted-foreground">No contact details on file.</p>
              )}
              <p className="tnum mt-2 text-xs text-muted-foreground">
                {customer.total_visits} total visits
              </p>
            </div>
          </section>

          <section aria-label="Private notes">
            <NotesEditor
              businessId={businessId}
              customerId={customer.id}
              initialNotes={customer.notes}
            />
          </section>

          <Separator />

          <section aria-label="Visit history">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visit history
            </h3>
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits yet.</p>
            ) : (
              <ol className="flex flex-col gap-0">
                {visits.map((v, i) => (
                  <li
                    key={v.id}
                    className="relative flex gap-3 pb-3 last:pb-0"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    />
                    {i < visits.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[3px] top-4 h-[calc(100%-12px)] w-px bg-border"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {v.service_name ?? "Appointment"}
                        </p>
                        <BookingStatusChip
                          status={
                            v.status as Parameters<typeof BookingStatusChip>[0]["status"]
                          }
                        />
                      </div>
                      <p className="tnum text-xs text-muted-foreground">
                        {formatDateTimeLabel(v.starts_at, timezone)}
                        {v.staff_name ? ` · ${v.staff_name}` : ""} ·{" "}
                        {formatCents(v.price_cents)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </ScrollArea>
    </>
  );
}

/** Private notes with debounced autosave — "Saved" appears on success. */
function NotesEditor({
  businessId,
  customerId,
  initialNotes,
}: {
  businessId: string;
  customerId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const onChange = (value: string) => {
    setNotes(value);
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = await updateCustomerNotes(businessId, customerId, value);
      setState(result.ok ? "saved" : "error");
    }, 800);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor="customer-notes">Private notes</Label>
        <span className="tnum flex items-center gap-1 text-xs text-muted-foreground" role="status">
          {state === "saving" && "Saving…"}
          {state === "saved" && (
            <>
              <Check className="size-3.5 text-success" aria-hidden />
              Saved
            </>
          )}
          {state === "error" && <span className="text-destructive">Save failed</span>}
        </span>
      </div>
      <Textarea
        id="customer-notes"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Preferences, allergies, reminders for next time…"
        rows={4}
      />
    </div>
  );
}
