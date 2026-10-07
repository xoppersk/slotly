"use client";

import { useState, useTransition } from "react";
import { CircleUserRound, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { signOut } from "../_actions/session";

interface UserMenuProps {
  userEmail: string | null;
}

/** Account menu: shows the signed-in email, offers sign-out. */
export function UserMenu({ userEmail }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <CircleUserRound className="size-5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Signed in as
        </p>
        <p className="truncate px-2 pb-2 text-sm font-medium">
          {userEmail ?? "Account"}
        </p>
        <Separator />
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start gap-2 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await signOut();
            })
          }
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
