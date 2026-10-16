import "../../../styles/components.css";
import "../../../styles/dev.css";
import { Button, ButtonLink } from "@/components/sl/Button";
import { DayTile } from "@/components/sl/DayTile";
import { TimeSlot, TimeSlotGroup } from "@/components/sl/TimeSlot";
import { HoldTimer } from "@/components/sl/HoldTimer";
import { VisitSummary, VisitSummaryBar } from "@/components/sl/VisitSummary";
import { StatusPill } from "@/components/sl/StatusPill";
import { AgendaRow, RunSheetRow } from "@/components/sl/RunSheetRow";
import { ChairCard, ChairCardNext } from "@/components/sl/ChairCard";
import { BookingShell, StepHeading } from "@/components/sl/shells/BookingShell";
import { AppShell } from "@/components/sl/shells/AppShell";
import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { SiteShell } from "@/components/sl/shells/SiteShell";
import { AuthShell } from "@/components/sl/shells/AuthShell";
import { IconArrowRight, IconCalendar } from "@/components/sl/icons";
import { bookings, getDayAvailability, getWeekAvailability, getSlotEndLabel } from "@/lib/api";

export const metadata = { title: "Components" };

const micahWeek = getWeekAvailability("micah");
const thu = getDayAvailability("micah", "2026-10-08");
const morning = (thu?.slots ?? []).slice(0, 4);
const afternoon = (thu?.slots ?? []).slice(4);
const sam = bookings.find((b) => b.customer === "Sam Ortiz")!;
const runRows = bookings.filter((b) =>
  ["Sam Ortiz", "Morgan Reed", "Leo Park", "Avery Lewis"].includes(b.customer),
);

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <p className="dev-note">{note}</p>
      {children}
    </section>
  );
}

export default function DevComponentsPage() {
  return (
    <div className="dev-wrap">
      <h1>Slotly design system</h1>
      <p className="dev-sub">
        Premium v2 components and shells, in their drawn states. Mirrors design-system/index.html.
      </p>

      <Section title="Button" note="Primary, outline, quiet destructive — 52px booking · 48px phone · 40px dashboard.">
        <div className="dev-card dev-row">
          <Button variant="primary">Continue to your details</Button>
          <Button>Get directions</Button>
          <Button variant="destructive">Cancel booking</Button>
          <Button variant="primary" size="dashPrimary">New booking</Button>
          <Button size="dashboard">Check in</Button>
          <Button size="sm">Finish</Button>
          <Button variant="ink">Book Thursday at 9:00 AM <IconArrowRight /></Button>
        </div>
      </Section>

      <Section title="DayTile" note="Micah's week, Oct 4–10 2026: past, today (2 open), full, selected (Thu, 10 open), open.">
        <div className="sl-days" role="group" aria-label="Choose a day">
          {micahWeek.map((d) => (
            <DayTile
              key={d.date}
              weekday={d.weekday}
              dayNumber={d.dayNumber}
              openCount={d.openCount}
              state={d.state === "away" ? "closed" : d.state}
              selected={d.date === "2026-10-08"}
            />
          ))}
        </div>
      </Section>

      <Section title="TimeSlot" note="Thursday, October 8 with Micah — Morning 4 times, Afternoon 6 times. 9:00 AM selected and held.">
        <div style={{ display: "grid", gap: 22 }}>
          <TimeSlotGroup partLabel="Morning" countLabel="4 times" groupLabel="Morning times on Thursday, October 8">
            {morning.map((t, i) => (
              <TimeSlot key={t} time={t} subLabel={i === 0 ? "Held for you" : getSlotEndLabel(t, 45)} selected={i === 0} />
            ))}
          </TimeSlotGroup>
          <TimeSlotGroup partLabel="Afternoon" countLabel="6 times" groupLabel="Afternoon times on Thursday, October 8">
            {afternoon.map((t, i) => (
              <TimeSlot key={t} time={t} subLabel={i === afternoon.length - 1 ? "last chair" : getSlotEndLabel(t, 45)} />
            ))}
          </TimeSlotGroup>
        </div>
      </Section>

      <Section title="HoldTimer" note="Counts down from 10:00; polite announcements at 5:00, 1:00 and expiry only.">
        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <HoldTimer time="9:00 AM" initialSeconds={598} />
          <div className="sl-visit">
            <HoldTimer time="9:00 AM" initialSeconds={598} onDark />
          </div>
        </div>
      </Section>

      <Section title="VisitSummary" note="Premium dark ink card (default) and the DS-preview light variant. Money is always three lines.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
          <div style={{ width: 392, maxWidth: "100%" }}>
            <VisitSummary
              hold={<HoldTimer time="9:00 AM" initialSeconds={598} onDark />}
              rows={[
                { label: "Service", value: "Signature haircut", sub: "45 minutes", changeHref: "#" },
                { label: "Barber", value: "Micah", changeHref: "#" },
                { label: "When", value: "Thursday, October 8", sub: "9:00 – 9:45 AM" },
              ]}
              serviceName="Signature haircut"
              priceCents={4800}
              cta={<ButtonLink variant="linen" href="#">Continue to your details</ButtonLink>}
              policyLine="Free to cancel or move until Wednesday, October 7 at 9:00 AM. After that the deposit is kept. No account needed."
            />
          </div>
          <div style={{ width: 392, maxWidth: "100%" }}>
            <VisitSummary
              variant="light"
              rows={[
                { label: "Service", value: "Signature haircut", sub: "45 minutes", changeHref: "#" },
                { label: "Barber", placeholder: "Next step" },
                { label: "When", placeholder: "Not chosen yet" },
              ]}
              serviceName="Signature haircut"
              priceCents={4800}
              cta={<ButtonLink variant="primary" href="#" style={{ width: "100%" }}>Continue to barber</ButtonLink>}
              policyLine="Free to cancel or move until Wednesday, October 7 at 9:00 AM."
            />
          </div>
        </div>
        <p className="dev-note" style={{ marginTop: 16 }}>Phone bottom-bar form:</p>
        <div style={{ width: 390, maxWidth: "100%" }} className="dev-shell">
          <VisitSummaryBar summaryLine="Thu, Oct 8 · 9:00 AM · $20 deposit · $48 total" holdLine="Held for you for 9:58">
            <Button variant="primary" size="phone" style={{ width: "100%" }}>Continue</Button>
          </VisitSummaryBar>
          <p style={{ margin: 0, padding: "10px 16px", fontSize: 13, color: "var(--muted)", background: "var(--card)" }}>
            Free to cancel until Wed 9:00 AM
          </p>
        </div>
      </Section>

      <Section title="StatusPill" note="A status is always a word in a pill — never a dot-only or icon-only state.">
        <div className="dev-card dev-row">
          <StatusPill status="Done" />
          <StatusPill status="In the chair" />
          <StatusPill status="Arrived" />
          <StatusPill status="Upcoming" />
          <StatusPill status="Confirmed" />
          <StatusPill status="Working" />
          <StatusPill status="Away" label="Away · Oct 6–19" />
          <StatusPill status="Invite sent" />
          <StatusPill status="Not booked yet" />
        </div>
      </Section>

      <Section title="RunSheetRow" note="Time, customer (link), service + barber, StatusPill, exactly one action. Done rows have none.">
        <div className="dev-scroll"><table className="sl-run">
          <tbody>
            {runRows.map((b) => (
              <RunSheetRow key={b.id} booking={b} href={`/app/bookings?booking=${b.id}`} />
            ))}
          </tbody>
        </table></div>
      </Section>

      <Section title="ChairCard" note="Staff agenda: Sam Ortiz in Micah's chair, then the empty-chair form.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div style={{ width: 374, maxWidth: "100%" }}>
            <ChairCard customer={sam.customer} service={sam.service} windowLabel="9:45 – 10:35" balanceCents={sam.balanceCents} overrunLabel={sam.overrunLabel} />
          </div>
          <div style={{ width: 374, maxWidth: "100%" }}>
            <ChairCardNext customer="Leo Park" time="10:45" />
          </div>
        </div>
      </Section>

      <Section title="BookingShell" note="White top bar, slim progress-bar steps (Step 3 of 6), Harbor & Pine footer.">
        <div className="dev-shell">
          <BookingShell step={3} stepHrefs={["#", "#"]}>
            <div className="sl-wrap" style={{ paddingTop: 32, paddingBottom: 32 }}>
              <StepHeading step={3} title="Choose a time" />
            </div>
          </BookingShell>
        </div>
      </Section>

      <Section title="AppShell" note="Sidebar: 8 items + View booking page, owner at the bottom.">
        <div className="dev-shell">
          <AppShell current="today">
            <p className="sl-eyebrow">Thursday, October 8</p>
            <h3 style={{ font: "600 32px/1.1 var(--font-display)", margin: 0 }}>Today</h3>
            <p style={{ marginTop: 10, color: "var(--ink-2)" }}>14 bookings · next opening 2:15 PM with Micah.</p>
          </AppShell>
        </div>
      </Section>

      <Section title="PhoneShell" note="390 frame, white top bar, Agenda / Time off / Profile tab bar with safe area.">
        <PhoneShell
          current="agenda"
          header={
            <>
              <b style={{ display: "block", font: "600 24px/1.1 var(--font-display)" }}>Thursday, Oct 8</b>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Micah · 8 bookings · 9 AM – 6 PM</span>
            </>
          }
          headerAction={
            <Button size="dashboard" aria-label="Pick a day" style={{ width: 44, padding: 0 }}>
              <IconCalendar />
            </Button>
          }
        >
          <ChairCard customer={sam.customer} service={sam.service} windowLabel="9:45 – 10:35" balanceCents={sam.balanceCents} overrunLabel={sam.overrunLabel} />
          <p style={{ margin: "18px 4px 8px", fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Next</p>
          <div className="sl-card" style={{ overflow: "hidden" }}>
            <AgendaRow start="10:45 AM" end="11:30 AM" title="Leo Park" sub="Signature haircut" action={<Button size="sm">Check in</Button>} />
            <AgendaRow start="1:45 PM" end="2:15 PM" title="Break" muted />
          </div>
        </PhoneShell>
      </Section>

      <Section title="SiteShell" note="White header (Features, Pricing, Sign in, Start free), dark ink footer.">
        <div className="dev-shell">
          <SiteShell>
            <div className="sl-wrap" style={{ paddingTop: 40, paddingBottom: 40 }}>
              <p style={{ fontSize: 17, color: "var(--ink-2)" }}>Fill the chair. Skip the phone tag.</p>
            </div>
          </SiteShell>
        </div>
      </Section>

      <Section title="AuthShell" note="Dark side panel + centred form + one-line legal footer.">
        <div className="dev-shell">
          <AuthShell headline={<>Thursday&rsquo;s chair,<br />sorted on Tuesday.</>} sub="Bookings, deposits and the day sheet in one place.">
            <h3 style={{ font: "600 32px/1.1 var(--font-display)", margin: "0 0 12px" }}>Sign in</h3>
            <p style={{ color: "var(--ink-2)" }}>New here? <a href="/sign-up" style={{ fontWeight: 600 }}>Start free</a></p>
          </AuthShell>
        </div>
      </Section>
    </div>
  );
}
