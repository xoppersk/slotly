import type { ReactNode } from "react";
import { SlotlyMark } from "../icons";

/** SiteShell — white header (Features, Pricing, Sign in, Start free) and
    the dark ink footer, as drawn on Marketing.html. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="sl-site-head">
        <div className="sl-wrap sl-site-head__in">
          <a href="/" className="sl-site-logo">
            <SlotlyMark />
            <span>Slotly</span>
          </a>
          <nav className="sl-site-nav" aria-label="Site">
            <a className="sl-nl" href="/features">Features</a>
            <a className="sl-nl" href="/pricing">Pricing</a>
            <a className="sl-nl" href="/sign-in">Sign in</a>
            <a href="/sign-up" className="sl-btn sl-btn--dash-primary" style={{ borderRadius: "var(--radius-pill)" }}>
              Start free
            </a>
          </nav>
        </div>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer className="sl-site-foot">
        <div className="sl-wrap" style={{ paddingTop: 56, paddingBottom: 40 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <SlotlyMark />
            <span style={{ font: "600 24px/1 var(--font-display)", letterSpacing: "-.02em" }}>Slotly</span>
          </div>
          <p style={{ margin: "16px 0 0", maxWidth: 420, fontSize: 15, lineHeight: 1.55, color: "#cdb8ae" }}>
            Booking pages and day sheets for barbershops, salons and studios.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "32px 64px", marginTop: 36, fontSize: 14 }}>
            <nav aria-label="Product" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <b style={{ color: "var(--card)" }}>Product</b>
              <a href="/features">Features</a>
              <a href="/pricing">Pricing</a>
              <a href="/b/harbor-and-pine">Example booking page</a>
            </nav>
            <nav aria-label="Company" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <b style={{ color: "var(--card)" }}>Company</b>
              <a href="#">About</a>
              <a href="mailto:hello@sevynlabs.io">hello@sevynlabs.io</a>
            </nav>
            <nav aria-label="Legal" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <b style={{ color: "var(--card)" }}>Legal</b>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </nav>
          </div>
          <p style={{ margin: "36px 0 0", fontSize: 13, color: "#b3a39c" }}>© 2026 Slotly</p>
        </div>
      </footer>
    </div>
  );
}
