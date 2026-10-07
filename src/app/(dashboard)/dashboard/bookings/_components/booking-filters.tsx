"use client";

import { Input, Label } from "@/components/ui/form";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "pending", label: "Pending requests" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
] as const;

interface BookingFiltersProps {
  staff: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  hideStaff?: boolean;
}

interface FilterState {
  q: string;
  from: string;
  to: string;
  staff: string;
  service: string;
  status: string;
}

/**
 * Bookings filter bar. Desktop: inline controls. Mobile: a bottom Sheet
 * (the spec's filter sheet) opened from the Filters button.
 */
export function BookingFilters({ staff, services, hideStaff }: BookingFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const initial: FilterState = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      staff: searchParams.get("staff") ?? "all",
      service: searchParams.get("service") ?? "all",
      status: searchParams.get("status") ?? "all",
    }),
    [searchParams]
  );

  const [draft, setDraft] = useState<FilterState>(initial);

  const apply = (next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: keyof FilterState, empty: string) => {
      if (next[key] && next[key] !== empty) params.set(key, next[key]);
      else params.delete(key);
    };
    set("q", "");
    set("from", "");
    set("to", "");
    set("staff", "all");
    set("service", "all");
    set("status", "all");
    // Keep the open drawer booking param when filtering.
    startTransition(() => {
      router.push(`/dashboard/bookings?${params.toString()}`, { scroll: false });
      setSheetOpen(false);
    });
  };

  const clearAll = () => {
    const next: FilterState = {
      q: "",
      from: "",
      to: "",
      staff: "all",
      service: "all",
      status: "all",
    };
    setDraft(next);
    apply(next);
  };

  const activeCount = [
    draft.q,
    draft.from,
    draft.to,
    draft.staff !== "all" ? draft.staff : "",
    draft.service !== "all" ? draft.service : "",
    draft.status !== "all" ? draft.status : "",
  ].filter(Boolean).length;

  const fields = (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor="booking-search">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="booking-search"
            placeholder="Customer name or phone"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply(draft);
            }}
            className="pl-9"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="booking-from">From</Label>
          <Input
            id="booking-from"
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="tnum"
          />
        </div>
        <div>
          <Label htmlFor="booking-to">To</Label>
          <Input
            id="booking-to"
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="tnum"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {!hideStaff && (
          <div>
            <Label>Staff</Label>
            <Select
              value={draft.staff}
              onValueChange={(v) => setDraft({ ...draft, staff: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any staff</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Service</Label>
          <Select
            value={draft.service}
            onValueChange={(v) => setDraft({ ...draft, service: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any service</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={draft.status}
            onValueChange={(v) => setDraft({ ...draft, status: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={() => apply(draft)} disabled={pending} className="flex-1">
          Apply filters
        </Button>
        <Button variant="ghost" onClick={clearAll} disabled={pending}>
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop inline bar */}
      <div className="hidden items-end gap-3 md:flex">
        <div className="relative w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Search bookings"
            placeholder="Customer name or phone"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply(draft);
            }}
            className="pl-9"
          />
        </div>
        <div className="tnum flex items-center gap-2">
          <Input
            aria-label="From date"
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="w-40"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            aria-label="To date"
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="w-40"
          />
        </div>
        {!hideStaff && (
          <Select
            value={draft.staff}
            onValueChange={(v) => {
              const next = { ...draft, staff: v };
              setDraft(next);
              apply(next);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by staff">
              <SelectValue placeholder="Any staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any staff</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={draft.service}
          onValueChange={(v) => {
            const next = { ...draft, service: v };
            setDraft(next);
            apply(next);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by service">
            <SelectValue placeholder="Any service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any service</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={draft.status}
          onValueChange={(v) => {
            const next = { ...draft, status: v };
            setDraft(next);
            apply(next);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => apply(draft)} disabled={pending}>
          Apply
        </Button>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearAll}
            aria-label="Clear all filters"
            disabled={pending}
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      {/* Mobile: bottom filter sheet */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
              {activeCount > 0 && (
                <span
                  className={cn(
                    "tnum ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                  )}
                >
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>Filter bookings</SheetTitle>
            </SheetHeader>
            <Separator className="mb-4" />
            {fields}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
