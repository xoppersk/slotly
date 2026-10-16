export interface DayTileProps {
  /** Display label: weekday short name, or "Today" for today (DS rule). */
  weekday: string;
  dayNumber: number;
  /** Open slots for the chosen service + barber. Ignored for past days. */
  openCount?: number;
  /** Total slots the availability bar is drawn against (canon week: 12). */
  totalSlots?: number;
  state?: "open" | "full" | "past" | "closed";
  selected?: boolean;
  onSelect?: () => void;
}

/** DayTile — Premium v2 day card: weekday, 30px date, availability bar,
    open count. A <button> with aria-pressed; full days stay clickable
    (they lead to Fully booked); past/closed are disabled. */
export function DayTile({
  weekday,
  dayNumber,
  openCount = 0,
  totalSlots = 12,
  state = "open",
  selected = false,
  onSelect,
}: DayTileProps) {
  const disabled = state === "past" || state === "closed";
  const label =
    state === "past" ? "Past" : state === "closed" ? "Closed" : state === "full" ? "Full" : `${openCount} open`;
  return (
    <button
      type="button"
      className={`sl-day${state === "full" ? " sl-day--full" : ""}${state === "past" ? " sl-day--past" : ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      aria-label={`${weekday} ${dayNumber}: ${label}`}
    >
      <span className="sl-day__wd">{weekday}</span>
      <span className="sl-day__num">{dayNumber}</span>
      {!disabled ? (
        <span className="sl-day__bar" aria-hidden="true">
          {Array.from({ length: totalSlots }, (_, i) => (
            <i key={i} className={i < openCount ? "o" : undefined} />
          ))}
        </span>
      ) : null}
      <span className="sl-day__av">{label}</span>
    </button>
  );
}
