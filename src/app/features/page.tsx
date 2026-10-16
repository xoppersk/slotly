import type { Metadata } from "next";
import "../../styles/site.css";
import { SiteChrome, Tick } from "../pricing/_chrome";
import { IconClock } from "@/components/sl/icons";
import { formatCents, getKeyBooking, getService } from "@/lib/api";

export const metadata: Metadata = { title: "Features" };

/* F-03 — Features: three alternating sections whose fragments are real UI
   built from the shared fixtures (the Thu Oct 8 slot wall for Micah, the
   F-08 clash card, the deposit summary for the key booking, Sam's chair
   card from the staff agenda). */

const WALL: { time: string; kind: "held" | "open" | "booked" }[] = [
  { time: "9:00", kind: "held" },
  { time: "9:45", kind: "open" },
  { time: "10:30", kind: "open" },
  { time: "11:15", kind: "open" },
  { time: "12:00", kind: "booked" },
  { time: "12:45", kind: "open" },
  { time: "1:30", kind: "open" },
  { time: "2:15", kind: "open" },
  { time: "3:00", kind: "booked" },
  { time: "3:45", kind: "open" },
  { time: "4:30", kind: "open" },
  { time: "5:15", kind: "open" },
];

const SECTIONS = [
  {
    n: "01",
    title: "A slot is held the moment it’s picked",
    lede: "Customers get ten minutes to finish without someone else taking their time. If it does go, they keep everything they typed.",
    ticks: [
      "Times update while the page is open",
      "Held slots show a countdown",
      "A clash sends them to the next opening, not back to the start",
    ],
  },
  {
    n: "02",
    title: "Deposits with the rules in plain sight",
    lede: "One deposit and one cancellation window, shown on every step and in every confirmation.",
    ticks: [
      "Refunds go back to the card automatically",
      "You decide what happens on a no-show",
      "Customers move or cancel from their own link",
    ],
  },
  {
    n: "03",
    title: "Your team runs the day from their phones",
    lede: "Each barber sees who’s in the chair, who’s next and where the gaps are, and can book a walk-in into a gap.",
    ticks: ["Check in, finish and take the balance", "Ask for time off and see who it affects", "Owners keep prices, hours and payouts"],
  },
];

export default function FeaturesPage() {
  const key = getKeyBooking();
  const service = getService(key.serviceId)!;

  return (
    <SiteChrome current="features">
      <div className="sl-wrap">
        <div className="sl-feat-hero">
          <div>
            <h1 className="sl-feat-h1">Built around the time slot</h1>
            <p className="sl-feat-lead">
              Customers, owners and staff all see the same time in the same words: open, held, booked. Everything else
              follows from that.
            </p>
          </div>
          <div className="sl-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="sl-wall" aria-hidden="true">
              {WALL.map((t) => (
                <span key={t.time} className={t.kind}>
                  {t.time}
                </span>
              ))}
            </div>
            <div className="sl-legend">
              <span>
                <i className="open" aria-hidden="true" />
                Open
              </span>
              <span>
                <i className="held" aria-hidden="true" />
                Held
              </span>
              <span>
                <i className="booked" aria-hidden="true" />
                Booked
              </span>
            </div>
          </div>
        </div>

        <section className="sl-feat-sec">
          <div>
            <span className="sl-mk-num">{SECTIONS[0]!.n}</span>
            <h2>{SECTIONS[0]!.title}</h2>
            <p className="lede">{SECTIONS[0]!.lede}</p>
            <ul className="sl-ticks">
              {SECTIONS[0]!.ticks.map((t) => (
                <li key={t}>
                  <Tick />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="sl-mk-stage">
            <div className="sl-card" style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
              <div className="sl-clash">
                <span className="sl-clash__icon">
                  <IconClock width={20} height={20} />
                </span>
                <div>
                  <b>Someone booked 9:00 AM just ahead of you.</b>
                  <p>Your details are saved. Pick another time and we’ll hold it.</p>
                </div>
              </div>
              <div className="sl-pick-slots" style={{ marginTop: 16 }} aria-hidden="true">
                <span className="sl-pick-slot" style={{ background: "var(--oxblood)", color: "var(--on-oxblood)", boxShadow: "var(--shadow-pick)" }}>
                  9:45 AM
                </span>
                <span className="sl-pick-slot">10:30 AM</span>
                <span className="sl-pick-slot">11:15 AM</span>
              </div>
            </div>
          </div>
        </section>

        <section className="sl-feat-sec">
          <div className="sl-mk-stage">
            <div className="sl-visit sl-dep">
              <div className="sl-dep__row">
                <span>{service.name}</span>
                <span>{formatCents(service.priceCents)}</span>
              </div>
              <div className="sl-dep__due">
                <span>Deposit due today</span>
                <span className="amt">{formatCents(service.depositCents)}</span>
              </div>
              <div className="sl-dep__row">
                <span>Pay at the shop</span>
                <span>{formatCents(service.priceCents - service.depositCents)}</span>
              </div>
              <p className="sl-dep__note">
                Free to cancel or move until Wednesday, October 7 at 9:00 AM. After that the deposit is kept.
              </p>
            </div>
          </div>
          <div>
            <span className="sl-mk-num">{SECTIONS[1]!.n}</span>
            <h2>{SECTIONS[1]!.title}</h2>
            <p className="lede">{SECTIONS[1]!.lede}</p>
            <ul className="sl-ticks">
              {SECTIONS[1]!.ticks.map((t) => (
                <li key={t}>
                  <Tick />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sl-feat-sec">
          <div>
            <span className="sl-mk-num">{SECTIONS[2]!.n}</span>
            <h2>{SECTIONS[2]!.title}</h2>
            <p className="lede">{SECTIONS[2]!.lede}</p>
            <ul className="sl-ticks">
              {SECTIONS[2]!.ticks.map((t) => (
                <li key={t}>
                  <Tick />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="sl-mk-stage">
            <div className="sl-feat-phone" aria-hidden="true">
              <div className="sl-feat-phone__notch" />
              <div className="sl-visit sl-feat-chair">
                <span className="cap">In your chair</span>
                <p className="nm">Sam Ortiz</p>
                <p className="mt">Skin fade · $40 left to pay</p>
                <span className="btn">Finish and take $40</span>
              </div>
              <div className="sl-feat-phone__home" />
            </div>
          </div>
        </section>
        <div style={{ height: 32 }} />
      </div>
    </SiteChrome>
  );
}
