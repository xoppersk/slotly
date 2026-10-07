"use client";

import * as React from "react";
import { Clock, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";

import type { StepProps } from "../BookingWizard";

/**
 * Wizard Step 1 — Service. Cards with duration + price; Continue is disabled
 * until a service is selected. When the business links straight to a
 * service (?service=), the wizard starts at step 2 and shows a
 * "Pre-selected — change" chip instead.
 */
export function StepService({ ctx, state, update, onNext, setPrimary }: StepProps) {
  const [query, setQuery] = React.useState("");
  const { services } = ctx;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [services, query]);

  React.useEffect(() => {
    setPrimary(
      state.serviceId
        ? { label: "Continue", onClick: onNext, disabled: false }
        : { label: "Continue", onClick: onNext, disabled: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.serviceId]);

  if (services.length === 0) {
    return (
      <EmptyState
        title="No services available"
        description="This business isn't taking bookings right now. Please check back later."
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Choose a service
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What are you booking today?
      </p>

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services"
          aria-label="Search services"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No matching services"
            description={`Nothing matches "${query}". Try a different search.`}
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3" role="listbox" aria-label="Services">
          {filtered.map((service) => {
            const selected = state.serviceId === service.id;
            return (
              <li key={service.id}>
                <Card
                  role="option"
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={() => update({ serviceId: service.id })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      update({ serviceId: service.id });
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
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-[0.5rem] text-sm font-bold",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      )}
                      style={
                        service.color
                          ? { backgroundColor: `${service.color}1A`, color: service.color }
                          : undefined
                      }
                    >
                      {service.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {service.name}
                      </p>
                      <p className="tnum mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden />
                          {service.duration_minutes} min
                        </span>
                        <span aria-hidden>·</span>
                        <span className="font-medium text-foreground">
                          {service.price_display ?? formatCents(service.price_cents)}
                        </span>
                      </p>
                      {service.description && (
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {service.description}
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
      )}
    </div>
  );
}
