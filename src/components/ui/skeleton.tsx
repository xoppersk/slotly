import { cn } from "@/lib/utils";

/**
 * Skeleton — shimmer placeholder for loading slot grids and dashboard
 * panels. Pulse is used rather than a gradient shimmer to keep the
 * booking surface calm.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
