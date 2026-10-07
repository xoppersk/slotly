"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * Realtime bookings feed for the Today agenda. New bookings slide in via
 * `router.refresh()` plus a toast; updates refresh silently. Shows a subtle
 * "Reconnecting…" pill while the channel is down — never a blocking modal.
 */
export function TodayRealtime({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-today-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { status?: string };
            toast.success(
              row.status === "pending"
                ? "New booking request received"
                : "New booking added to your day"
            );
          }
          router.refresh();
        }
      )
      .subscribe((status) => {
        setReconnecting(status !== "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  if (!reconnecting) return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
    >
      <WifiOff className="size-3.5" aria-hidden />
      Reconnecting…
    </span>
  );
}
