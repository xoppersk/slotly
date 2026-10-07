"use client";

import * as React from "react";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";

import type { StepProps } from "../BookingWizard";

/**
 * Wizard Step 2 — Staff. "First available" is the first selectable card
 * (highlighted "Fastest booking" badge — the staff-agnostic slot query),
 * then staff cards with photo, name, specialty, and next-available time.
 * Single-staff businesses auto-skip this step (handled by the wizard).
 */
export function StepStaff({ ctx, state, update, onNext, setPrimary }: StepProps) {
  const { staff, services, business } = ctx;
  const service = services.find((s) => s.id === state.serviceId);
  const [nextByStaff, setNextByStaff] = React.useState<Record<string, string | null>>({});

  // "First available" = earliest slot across all staff (staffId "any").
  const firstAvailable = state.staffId === "any";

  // Fetch next-available per staff card so the list feels alive. Each card
  // queries availability for its own staff member over the next 7 days and
  // keeps the first slot label.
  React.useEffect(() => {
    if (!service) return;
    let cancelled = false;
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 7);
    Promise.all(
      staff.map(async (member) => {
        try {
          const params = new URLSearchParams({
            businessId: business.id,
            serviceId: service.id,
            staffId: member.id,
            from: ymd(from),
            to: ymd(to),
          });
          const res = await fetch(`/api/availability?${params.toString()}`);
          if (!res.ok) return [member.id, null] as const;
          const data = (await res.json()) as {
            days: { slots: { startsAt: string }[] }[];
          };
          const slot = data.days.flatMap((d) => d.slots)[0];
          return [member.id, slot ? slot.startsAt : null] as const;
        } catch {
          return [member.id, null] as const;
        }
      })
    ).then((pairs) => {
      if (!cancelled) setNextByStaff(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [service, staff, business.id]);

  React.useEffect(() => {
    setPrimary(
      state.staffId
        ? { label: "Continue", onClick: onNext, disabled: false }
        : { label: "Continue", onClick: onNext, disabled: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.staffId]);

  const select = (id: string) => update({ staffId: id, slot: null, dayKey: null });

  const nextAvailableLabel = (startsAt: string | null | undefined) => {
    if (startsAt === undefined) return null; // still loading
    if (startsAt === null) return "No openings this week";
    const d = new Date(startsAt);
    return `Next: ${d.toLocaleDateString("en-US", {
      weekday: "short",
    })} ${d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Choose your {service ? "provider" : "staff"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a person, or let us find the fastest opening.
      </p>

      <ul className="mt-4 grid gap-3" role="listbox" aria-label="Staff">
        <li>
          <Card
            role="option"
            aria-selected={firstAvailable}
            tabIndex={0}
            onClick={() => select("any")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select("any");
              }
            }}
            className={cn(
              "cursor-pointer border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              firstAvailable
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-primary/50"
            )}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <span
                aria-hidden
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full",
                  firstAvailable
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary"
                )}
              >
                <Zap className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                  First available
                  <Badge variant="default">Fastest booking</Badge>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The earliest open slot with any team member.
                </p>
              </div>
            </CardContent>
          </Card>
        </li>

        {staff.map((member) => {
          const selected = state.staffId === member.id;
          const nextLabel = nextAvailableLabel(nextByStaff[member.id]);
          return (
            <li key={member.id}>
              <Card
                role="option"
                aria-selected={selected}
                tabIndex={0}
                onClick={() => select(member.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(member.id);
                  }
                }}
                className={cn(
                  "cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-primary/50"
                )}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar className="size-12 shrink-0">
                    {member.photo_url && (
                      <AvatarImage src={member.photo_url} alt={member.name} />
                    )}
                    <AvatarFallback initials={getInitials(member.name)} />
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {member.name}
                    </p>
                    {member.title && (
                      <p className="truncate text-sm text-muted-foreground">
                        {member.title}
                      </p>
                    )}
                    {nextLabel && (
                      <p className="tnum mt-0.5 text-xs text-muted-foreground">
                        {nextLabel}
                      </p>
                    )}
                  </div>
                  {selected && (
                    <Badge variant="default" className="shrink-0">
                      Selected
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
