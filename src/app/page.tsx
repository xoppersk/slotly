import Link from "next/link";
import "../styles/site.css";
import { SiteChrome } from "./pricing/_chrome";
import { IconArrowRight } from "@/components/sl/icons";
import { MiniPicker, type MiniPickerDemo } from "./_home/MiniPicker";
import { getPublicBusiness, getPublicCatalog } from "@/lib/db/public";

/* F-01 — Marketing. Hero at the screen's drawn 80px Bricolage (screens win
   over the brief's type table — BUILD-LOG), with the LIVE mini time picker:
   the featured business (Harbor & Pine) and its first service are resolved
   from the public PostgreSQL views on the server, and the picker itself
   reads real slots from /api/public/availability. No fixture data. */

const FEATURED_SLUG = "harbor-and-pine";

async function loadDemo(): Promise<MiniPickerDemo | null> {
  try {
    const business = await getPublicBusiness(FEATURED_SLUG);
    if (!business) return null;
    const catalog = await getPublicCatalog(business.id);
    const service = catalog.services[0];
    if (!service) return null;
    return {
      businessId: business.id,
      serviceId: service.id,
      serviceName: service.name,
      businessName: business.name,
      staffName: catalog.staff[0]?.name ?? null,
      bookingHref: `/b/${business.slug}`,
    };
  } catch {
    return null;
  }
}

const PRINCIPLES = [
  {
    n: "01",
    title: "One decision per step",
    body: "Service, then person, then time. Customers never see a time that can’t be booked, and the slot they pick is held while they finish.",
  },
  {
    n: "02",
    title: "Deposits that explain themselves",
    body: "Set one deposit and one cancellation window. Customers see both on every step, so nobody is surprised by what they lose.",
  },
  {
    n: "03",
    title: "A day sheet, not a calendar puzzle",
    body: "Who’s in the chair, who’s next, where the gaps are. Check in, finish and take payment from one list.",
  },
];

const STEPS = [
  { title: "Name your business", sub: "Address, phone, time zone" },
  { title: "Add your services", sub: "Length and price for each" },
  { title: "Set your hours", sub: "Weekly hours, breaks and days off" },
  { title: "Share your link", sub: "Put it in your bio, your texts and your window" },
];

const UP_NEXT = [
  { time: "9:45 AM", initial: "S", name: "Sam Ortiz", sub: "Skin fade · Micah", chip: "In the chair", kind: "chair" },
  { time: "10:30 AM", initial: "M", name: "Morgan Reed", sub: "Cut + beard · Nia", chip: "Arrived", kind: "arr" },
  { time: "10:45 AM", initial: "L", name: "Leo Park", sub: "Signature haircut · Micah", chip: "Upcoming", kind: "up" },
] as const;

export default async function MarketingPage() {
  const demo = await loadDemo();
  return (
    <SiteChrome>
      <section className="sl-wrap sl-mk-hero">
        <div>
          <p className="sl-mk-eyebrow">For barbershops, salons and studios</p>
          <h1 className="sl-mk-h1">
            Fill the chair.
            <br />
            Skip the phone tag.
          </h1>
          <p className="sl-mk-lead">
            A booking page where customers pick a service, a person and a time in about a minute, a deposit that stops
            no-shows, and a day sheet your team can run from their phones.
          </p>
          <div className="sl-mk-hero-ctas">
            <a href="/sign-up" className="sl-mk-cta">
              Start free <IconArrowRight />
            </a>
            <Link href="/b/harbor-and-pine" className="sl-mk-line">
              See a live booking page
            </Link>
          </div>
          <p className="sl-mk-hero-note">Free for one person. No card needed to start.</p>
        </div>
        <MiniPicker demo={demo} />
      </section>

      <section className="sl-wrap sl-mk-principles">
        {PRINCIPLES.map((p) => (
          <div key={p.n} className="sl-card sl-mk-principle">
            <span className="sl-mk-num">{p.n}</span>
            <h2>{p.title}</h2>
            <p>{p.body}</p>
          </div>
        ))}
      </section>

      <section className="sl-mk-band">
        <div className="sl-wrap sl-mk-setup">
          <div className="sl-mk-stage sl-mk-stage--linen" style={{ padding: 44 }}>
            <div className="sl-card sl-upnext">
              <div className="sl-upnext__head">
                <b>Up next</b>
                <span>Thu, Oct 8 · 10:40 AM</span>
              </div>
              {UP_NEXT.map((r) => (
                <div key={r.time} className="sl-upnext__row">
                  <span className="tm">{r.time}</span>
                  <span className="sl-mono" aria-hidden="true">
                    {r.initial}
                  </span>
                  <span className="who">
                    <b>{r.name}</b>
                    <span>{r.sub}</span>
                  </span>
                  <span className={`sl-chip sl-chip--${r.kind}`}>
                    {r.kind === "arr" ? <i aria-hidden="true" /> : null}
                    {r.chip}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2>Set up before your next appointment</h2>
            <ol className="sl-mk-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="sl-mk-num n">{i + 1}</span>
                  <span>
                    <b>{s.title}</b>
                    <small>{s.sub}</small>
                  </span>
                </li>
              ))}
            </ol>
            <a href="/sign-up" className="sl-mk-cta" style={{ marginTop: 32 }}>
              Start free <IconArrowRight />
            </a>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
