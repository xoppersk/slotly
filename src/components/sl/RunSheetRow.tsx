import type { Booking } from "@/lib/types";
import { StatusPill } from "./StatusPill";
import { Button } from "./Button";

/** The one action a row gets, by status (HANDOVER §2/§10). */
export function actionForStatus(status: Booking["status"]): string | null {
  switch (status) {
    case "In the chair":
      return "Finish";
    case "Arrived":
      return "Start";
    case "Upcoming":
    case "Confirmed":
      return "Check in";
    default:
      return null;
  }
}

export interface RunSheetRowProps {
  booking: Booking;
  /** Link target for the customer name (booking drawer). */
  href?: string;
  onAction?: (booking: Booking) => void;
}

/** RunSheetRow — time, customer (link), service + barber, StatusPill,
    exactly one action. Render inside <table className="sl-run"><tbody>. */
export function RunSheetRow({ booking, href, onAction }: RunSheetRowProps) {
  const action = actionForStatus(booking.status);
  const initial = booking.customer.charAt(0);
  return (
    <tr className={booking.status === "Done" ? "sl-run--past" : undefined}>
      <td className="sl-run__time">{booking.start}</td>
      <td>
        <span className="sl-run__who">
          <span className={`sl-mono${booking.status === "Done" ? " sl-mono--off" : ""}`} aria-hidden="true">{initial}</span>
          {href ? <a href={href}>{booking.customer}</a> : <span style={{ fontWeight: 600 }}>{booking.customer}</span>}
        </span>
      </td>
      <td>
        {booking.service}
        <span className="sl-run__sub">{booking.barber}</span>
      </td>
      <td><StatusPill status={booking.status} /></td>
      <td className="sl-run__action">
        {action ? (
          <Button size="sm" onClick={onAction ? () => onAction(booking) : undefined}>{action}</Button>
        ) : null}
      </td>
    </tr>
  );
}

/** Phone agenda row (64px time column, end time beneath) — StaffAgenda. */
export function AgendaRow({
  start,
  end,
  title,
  sub,
  action,
  muted = false,
}: {
  start: string;
  end: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="sl-agenda-row" style={muted ? { background: "#FBF7F4" } : undefined}>
      <span className="sl-agenda-row__t" style={muted ? { color: "var(--muted)" } : undefined}>
        {start.replace(/\s[AP]M$/, "")}
        <small>to {end.replace(/\s[AP]M$/, "")}</small>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{title}</b>
        {sub ? <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{sub}</span> : null}
      </span>
      {action}
    </div>
  );
}
