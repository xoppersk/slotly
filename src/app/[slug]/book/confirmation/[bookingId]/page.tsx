import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationView } from "@/components/confirmation/ConfirmationView";

/**
 * /[slug]/book/confirmation/[bookingId] — confirmation screen.
 *
 * The manage token arrives via the ?t= query param; the client component
 * polls GET /api/bookings/receipt?token= until the booking confirms.
 */
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-2xl px-4 py-10">
            <Skeleton className="mx-auto size-20 rounded-full" />
            <Skeleton className="mx-auto mt-4 h-8 w-64" />
            <Skeleton className="mt-6 h-48 rounded-[0.75rem]" />
          </div>
        }
      >
        <ConfirmationView slug={slug} bookingId={bookingId} />
      </Suspense>
    </div>
  );
}
