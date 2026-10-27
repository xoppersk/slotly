import type { ReactNode } from "react";
import Link from "next/link";
import { SlotlyMark } from "@/components/sl/icons";

/* Screen-exact site chrome for F-01…F-03 (see BUILD-LOG "Staff + Site
   worker": SiteShell's Start-free pill, footer layout and missing
   aria-current underline deviate from the screens, so the site pages use
   this chrome, which replicates the drawn header/footer 1:1). */

export function Tick({ tone = "var(--open)" }: { tone?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

export function SiteChrome({ current, children }: { current?: "features" | "pricing"; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="sl-mk-head">
        <div className="sl-wrap sl-mk-head__in">
          <Link href="/" className="sl-mk-logo">
            <SlotlyMark />
            <span>Slotly</span>
          </Link>
          <nav className="sl-mk-nav" aria-label="Site">
            <a className="sl-mk-nl" href="/features" aria-current={current === "features" ? "page" : undefined}>Features</a>
            <a className="sl-mk-nl" href="/pricing" aria-current={current === "pricing" ? "page" : undefined}>Pricing</a>
            <a className="sl-mk-nl" href="/sign-in">Sign in</a>
            <a href="/sign-up" className="sl-mk-startfree">Start free</a>
          </nav>
        </div>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer className="sl-mk-foot">
        <div className="sl-wrap sl-mk-foot__grid">
          <div>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SlotlyMark />
              <span style={{ font: "600 24px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--card)" }}>Slotly</span>
            </span>
            <p className="sl-mk-foot__tag">Booking pages and day sheets for barbershops, salons and studios.</p>
          </div>
          <nav aria-label="Product">
            <b>Product</b>
            <a href="/features">Features</a>
            <a href="/pricing">Pricing</a>
            <Link href="/b/harbor-and-pine">Example booking page</Link>
          </nav>
          <nav aria-label="Company">
            <b>Company</b>
            <a href="#">About</a>
            <a href="mailto:hello@sevynlabs.io">hello@sevynlabs.io</a>
            <a href="tel:+12762702729">(276) 270-2729</a>
          </nav>
          <nav aria-label="Legal">
            <b>Legal</b>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </nav>
        </div>
        <div className="sl-wrap sl-mk-foot__copy">© 2026 Slotly</div>
      </footer>
    </div>
  );
}
