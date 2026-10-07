"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { slugify } from "@/lib/format";
import { Input, Label } from "@/components/ui/form";

interface SlugFieldProps {
  value: string;
  onChange: (slug: string) => void;
  /** Server action: (slug) => Promise<{ available: boolean }>. */
  checkAvailability: (slug: string) => Promise<{ available: boolean }>;
  /** When editing, the business's current slug is always "available". */
  currentSlug?: string;
  id?: string;
}

type CheckState = "idle" | "checking" | "available" | "taken";

/**
 * SlugInput — slug field with live availability check (UI-DESIGN §4).
 * Debounces 400ms, then calls the server action. Shows available / taken /
 * checking states inline. Format validity and the "unchanged" case are
 * derived during render; only the async server check lives in an effect.
 */
export function SlugField({
  value,
  onChange,
  checkAvailability,
  currentSlug,
  id = "slug",
}: SlugFieldProps) {
  const [checkState, setCheckState] = React.useState<CheckState>("idle");

  const formatValid = value === "" || /^[a-z0-9-]+$/.test(value);
  const isUnchanged = !!currentSlug && value === currentSlug;
  const needsCheck = value !== "" && formatValid && !isUnchanged;

  React.useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      setCheckState("checking");
      checkAvailability(value)
        .then((res) => {
          if (!cancelled) setCheckState(res.available ? "available" : "taken");
        })
        .catch(() => {
          if (!cancelled) setCheckState("idle");
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [needsCheck, value, checkAvailability]);

  const state: CheckState | "invalid" = !formatValid
    ? "invalid"
    : isUnchanged
      ? "available"
      : checkState;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Booking page slug</Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            setCheckState("idle");
            onChange(slugify(e.target.value));
          }}
          placeholder="harbor-and-pine"
          className={cn(
            "tnum pr-9",
            state === "taken" || state === "invalid"
              ? "border-destructive"
              : state === "available"
                ? "border-success"
                : undefined,
          )}
          aria-describedby={`${id}-hint ${id}-status`}
          autoComplete="off"
          spellCheck={false}
        />
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          aria-hidden
        >
          {state === "checking" && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {state === "available" && <Check className="size-4 text-success" />}
          {(state === "taken" || state === "invalid") && (
            <X className="size-4 text-destructive" />
          )}
        </span>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Your public booking page lives at slotly.app/
        <span className="tnum">{value || "your-slug"}</span>
      </p>
      <p id={`${id}-status`} role="status" className="text-xs">
        {state === "taken" && (
          <span className="text-destructive">
            That slug is taken — try another.
          </span>
        )}
        {state === "invalid" && (
          <span className="text-destructive">
            Lowercase letters, numbers, and hyphens only.
          </span>
        )}
        {state === "available" && (
          <span className="text-success">Available.</span>
        )}
      </p>
    </div>
  );
}
