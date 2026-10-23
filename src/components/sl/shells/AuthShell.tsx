import type { ReactNode } from "react";
import Link from "next/link";
import { SlotlyMark } from "../icons";

export interface AuthShellProps {
  headline: ReactNode;
  sub: string;
  children: ReactNode;
}

/** AuthShell — dark side panel (flex 1 1 520px, radius-xl, shadow-dark)
    next to a centred 440px form column, one-line legal footer
    (SignIn/SignUp.html). The panel stays dark in both themes (§4). */
export function AuthShell({ headline, sub, children }: AuthShellProps) {
  return (
    <div className="sl-auth">
      <aside className="sl-auth__panel">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--card)", textDecoration: "none" }}>
          <SlotlyMark />
          <span style={{ font: "600 24px/1 var(--font-display)", letterSpacing: "-.02em" }}>Slotly</span>
        </Link>
        <div>
          <p className="sl-auth__headline">{headline}</p>
          <p className="sl-auth__sub">{sub}</p>
        </div>
        <span style={{ fontSize: 13, color: "#b3a39c" }}>© 2026 Slotly</span>
      </aside>
      <div className="sl-auth__main">
        <main className="sl-auth__form">
          <div className="sl-auth__form-in">{children}</div>
        </main>
        <footer className="sl-auth__legal">
          <a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Help</a> · © 2026 Slotly
        </footer>
      </div>
    </div>
  );
}
