"use client";
/* Owner actions on a staff card: deactivate / reactivate (staff.is_active).
   Deactivated staff disappear from the public page (staff_public filters
   is_active) and from booking. */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import { setStaffActive } from "../actions";

export function StaffCardActions({ staffId, isActive }: { staffId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setStaffActive(staffId, !isActive);
          router.refresh();
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
