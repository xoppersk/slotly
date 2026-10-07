import Link from "next/link";

/**
 * Auth layout — centered card shell for sign-in / sign-up / magic-link
 * screens. Auth UI is built in the auth phase.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2"
        aria-label="Slotly home"
      >
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <span className="text-lg font-semibold tracking-tight">Slotly</span>
      </Link>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
