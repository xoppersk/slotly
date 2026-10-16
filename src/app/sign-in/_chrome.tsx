import type { ReactNode } from "react";
import { SlotlyMark } from "@/components/sl/icons";

/* Screen-exact auth chrome for F-04…F-06 (see BUILD-LOG "Staff + Site
   worker": AuthShell cannot render the drawn slot-wall decoration or the
   light invite panel, so the auth pages use this chrome, which replicates
   the drawn AuthShell geometry 1:1 — panel flex 1 1 520px, 440px form,
   one-line legal footer, panel stacks below 1080px). */

function WallTiles() {
  const tiles = ["held", "open", "open", "open", "booked", "open", "open", "open", "booked", "open", "open", "open"];
  return (
    <div className="sl-walltiles" aria-hidden="true">
      {tiles.map((t, i) => (
        <i key={i} className={t} />
      ))}
    </div>
  );
}

export function SignPanel() {
  return (
    <>
      <a href="/" className="sl-auth2__logo">
        <SlotlyMark />
        <span>Slotly</span>
      </a>
      <div>
        <p className="sl-auth2__headline">
          Thursday&rsquo;s chair,
          <br />
          sorted on Tuesday.
        </p>
        <p className="sl-auth2__sub">Bookings, deposits and the day sheet in one place.</p>
        <WallTiles />
      </div>
      <span className="sl-auth2__copy">© 2026 Slotly</span>
    </>
  );
}

export function AuthChrome({ panel, light = false, children }: { panel: ReactNode; light?: boolean; children: ReactNode }) {
  return (
    <div className="sl-auth2">
      <aside className={`sl-auth2__panel${light ? " sl-auth2__panel--light" : ""}`}>{panel}</aside>
      <div className="sl-auth2__main">
        <main className="sl-auth2__form">
          <div className="sl-auth2__form-in">{children}</div>
        </main>
        <footer className="sl-auth2__legal">
          <a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Help</a> · © 2026 Slotly
        </footer>
      </div>
    </div>
  );
}
