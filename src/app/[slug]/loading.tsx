import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /[slug] — shimmering header + skeleton service cards
 * (UI-DESIGN.md §2.1: loading state).
 */
export default function BusinessPageLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="bg-muted">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-10 pt-10">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 rounded-[0.75rem] sm:size-20" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-[0.75rem]" />
          ))}
        </div>
      </div>
    </div>
  );
}
