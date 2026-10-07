"use client";

import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { formatCents } from "@/lib/format";
import { formatDuration } from "@/lib/management";
import { Avatar, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Switch } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";

import { setServiceActive } from "./actions";
import { ServiceDialog, type ServiceDialogModel } from "./service-dialog";

import type { PaymentPolicy } from "@/lib/supabase/types";

export interface ServiceListItem {
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
  staff: { id: string; name: string }[];
  futureBookings: number;
}

interface ServicesClientProps {
  services: ServiceListItem[];
  staff: { id: string; name: string; is_active: boolean }[];
  defaultPaymentPolicy: PaymentPolicy;
}

const POLICY_LABEL: Record<PaymentPolicy, string> = {
  none: "No payment now",
  deposit: "Deposit",
  full: "Full price now",
};

export function ServicesClient({
  services,
  staff,
  defaultPaymentPolicy,
}: ServicesClientProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceDialogModel | null>(null);
  const [toggling, setToggling] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (item: ServiceListItem) => {
    setEditing({
      id: item.id,
      name: item.name,
      description: item.description,
      duration_minutes: item.duration_minutes,
      price_cents: item.price_cents,
      buffer_before_minutes: item.buffer_before_minutes,
      buffer_after_minutes: item.buffer_after_minutes,
      payment_policy: item.payment_policy,
      deposit_cents: item.deposit_cents,
      is_active: item.is_active,
      staffIds: item.staff.map((s) => s.id),
    });
    setDialogOpen(true);
  };

  const handleToggle = async (item: ServiceListItem, active: boolean) => {
    if (active === item.is_active) return;
    if (
      !active &&
      item.futureBookings > 0 &&
      !window.confirm(
        `${item.futureBookings} upcoming booking${item.futureBookings === 1 ? "" : "s"} ` +
          `keep their original details. Deactivate "${item.name}" anyway?`,
      )
    ) {
      return;
    }
    setToggling(item.id);
    try {
      const result = await setServiceActive(item.id, active);
      if (!result.ok) toast.error(result.error);
      else toast.success(active ? "Service activated" : "Service deactivated");
    } catch {
      toast.error("Could not update the service.");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">
            What customers can book — durations, prices, and who performs them.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          New service
        </Button>
      </div>

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Create your first service so customers have something to book."
          actionLabel="Create your first service"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {services.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{item.name}</p>
                    {!item.is_active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="tnum mt-0.5 text-sm text-muted-foreground">
                    {formatDuration(item.duration_minutes)} ·{" "}
                    {formatCents(item.price_cents)} ·{" "}
                    {POLICY_LABEL[item.payment_policy]}
                    {item.payment_policy === "deposit" &&
                      ` (${formatCents(item.deposit_cents)} now)`}
                  </p>
                  {item.staff.length > 0 && (
                    <div
                      className="mt-2 flex -space-x-1.5"
                      aria-label={`Performed by ${item.staff.map((s) => s.name).join(", ")}`}
                    >
                      {item.staff.slice(0, 5).map((s) => (
                        <Avatar
                          key={s.id}
                          className="size-6 ring-2 ring-card"
                          title={s.name}
                        >
                          <AvatarFallback
                            initials={getInitials(s.name)}
                            className="text-[9px]"
                          />
                        </Avatar>
                      ))}
                      {item.staff.length > 5 && (
                        <span className="tnum flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-card">
                          +{item.staff.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Switch
                    checked={item.is_active}
                    disabled={toggling === item.id}
                    onCheckedChange={(checked) => handleToggle(item, checked)}
                    aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ServiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={editing}
        staff={staff}
        futureBookings={editing?.id ? (services.find((s) => s.id === editing.id)?.futureBookings ?? 0) : 0}
        defaultPaymentPolicy={defaultPaymentPolicy}
        onSaved={() => {}}
      />
    </div>
  );
}

/** Skeleton shown while the services page streams in. */
export function ServicesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
