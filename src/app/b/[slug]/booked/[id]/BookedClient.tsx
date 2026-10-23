"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/sl/Button";
import { downloadICSFor } from "../../_flow/BookingFlow";

/** On a revisit without ?t=, recover the manage token the Review step
    stored in sessionStorage and reload with it so the server can render
    the real receipt. When nothing is stored, the server-rendered
    "check your link" state simply stays. */
export function TokenRecovery({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  useEffect(() => {
    try {
      const t = sessionStorage.getItem(`slotly-manage:${bookingId}`);
      if (t) router.replace(`?t=${encodeURIComponent(t)}`);
    } catch {}
  }, [bookingId, router]);
  return null;
}

export function BookedActions({
  slug,
  businessName,
  serviceName,
  staffName,
  startsAt,
  endsAt,
  address,
  bookingId,
  manageToken,
}: {
  slug: string;
  businessName: string;
  serviceName: string;
  staffName: string | null;
  startsAt: string;
  endsAt: string;
  address: string | null;
  bookingId: string;
  manageToken: string;
}) {
  return (
    <div className="sl-b-actions">
      <Button
        variant="primary"
        onClick={() =>
          downloadICSFor({
            businessName,
            serviceName,
            staffName,
            startsAt,
            endsAt,
            address,
            bookingId,
            slug,
          })
        }
      >
        Add to calendar
      </Button>
      <ButtonLink href="#">Get directions</ButtonLink>
      <ButtonLink href={`/b/${slug}/manage/${manageToken}`}>
        Change or cancel
      </ButtonLink>
    </div>
  );
}
