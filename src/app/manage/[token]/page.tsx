import { ManageBookingView } from "@/components/manage/ManageBookingView";

/**
 * /manage/[token] — magic-link booking management (public, no login).
 */
export default async function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ManageBookingView token={token} />
    </div>
  );
}
