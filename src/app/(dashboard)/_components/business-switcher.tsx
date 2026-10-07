"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BusinessMembership } from "@/lib/business";
import { setActiveBusiness } from "../_actions/session";

interface BusinessSwitcherProps {
  businessId: string;
  businessName: string;
  memberships: BusinessMembership[];
}

/**
 * Switch between businesses the user belongs to. Hidden when there is only
 * one membership. Persists the choice in the `slotly_business` cookie.
 */
export function BusinessSwitcher({
  businessId,
  businessName,
  memberships,
}: BusinessSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (memberships.length < 2) return null;

  const select = (id: string) => {
    if (id === businessId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setActiveBusiness(id);
      setOpen(false);
      router.push(`/dashboard?b=${encodeURIComponent(id)}`);
      router.refresh();
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-2 py-2"
          aria-haspopup="listbox"
        >
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {businessName}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start" role="listbox">
        {memberships.map((m) => (
          <button
            key={m.businessId}
            type="button"
            role="option"
            aria-selected={m.businessId === businessId}
            disabled={pending}
            onClick={() => select(m.businessId)}
            className={cn(
              "flex w-full items-center gap-2 rounded-[0.5rem] px-3 py-2 text-left text-sm",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              m.businessId === businessId && "font-medium text-primary"
            )}
          >
            <span className="min-w-0 flex-1 truncate">{m.businessName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {m.role === "owner" ? "Owner" : "Staff"}
            </span>
            {m.businessId === businessId && (
              <Check className="size-4 shrink-0" aria-hidden />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
