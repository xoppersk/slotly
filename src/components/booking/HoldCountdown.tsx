"use client";

import * as React from "react";
import { Timer } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * HoldCountdown — live mm:ss countdown banner for the payment hold.
 * The slot is held server-side; this is the visible ticking clock.
 *
 * `expiresAt` is an epoch-ms timestamp (server-provided). When the timer
 * hits zero, `onExpire` fires once.
 */
interface HoldCountdownProps {
  expiresAt: number;
  onExpire?: () => void;
  className?: string;
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function HoldCountdown({ expiresAt, onExpire, className }: HoldCountdownProps) {
  const [now, setNow] = React.useState(() => Date.now());
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = expiresAt - now;

  React.useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const urgent = remaining <= 60_000;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Payment hold expires in ${mmss(remaining)}`}
      className={cn(
        "flex items-center gap-2 rounded-[0.5rem] border px-3 py-2 text-sm",
        urgent
          ? "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/15"
          : "border-warning/30 bg-warning/10 text-foreground dark:bg-warning/15",
        className
      )}
    >
      <Timer
        className={cn("size-4 shrink-0", urgent ? "text-destructive" : "text-warning")}
        aria-hidden
      />
      <p>
        Your slot is held for{" "}
        <span className="font-semibold tnum">{mmss(remaining)}</span>
        {urgent && remaining > 0 && " — almost out of time"}
      </p>
    </div>
  );
}
