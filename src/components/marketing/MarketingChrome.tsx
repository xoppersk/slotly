import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * SlotlyLogo — the rounded-square clock mark (drawn as SVG, never raster —
 * UI-DESIGN.md §6).
 */
export function SlotlyLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </span>
  );
}

/**
 * MarketingHeader — shared Slotly-brand header for /pricing and /features.
 */
export function MarketingHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Slotly home">
          <SlotlyLogo />
          <span className="text-lg font-semibold tracking-tight">Slotly</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Marketing">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/features">Features</Link>
          </Button>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
          <Button variant="primary" asChild>
            <Link href="/auth/sign-up">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

/**
 * MarketingFooter — shared Slotly-brand footer.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlotlyLogo />
            <span className="text-base font-semibold tracking-tight text-foreground">
              Slotly
            </span>
          </div>
          <p className="mt-2 max-w-xs">
            The calm, dependable booking platform for service businesses.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2" aria-label="Footer">
          <Link href="/features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/auth/sign-in" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/auth/sign-up" className="hover:text-foreground">
            Get started
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-muted-foreground">
          © 2026 Slotly. The slot you want, simply.
        </p>
      </div>
    </footer>
  );
}
