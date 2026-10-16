export interface TimeSlotProps {
  /** Start label as drawn: "9:00 AM". */
  time: string;
  /** Sub-line as drawn: "to 10:30", "Held for you", or "last chair". */
  subLabel?: string;
  selected?: boolean;
  phone?: boolean;
  onSelect?: () => void;
}

/** TimeSlot — 60px Premium tile (48px on phone), radius-l, slot type.
    A <button> with aria-pressed; selecting starts a hold. Only bookable
    times are ever rendered (HANDOVER §5 rule 5). */
export function TimeSlot({ time, subLabel, selected = false, phone = false, onSelect }: TimeSlotProps) {
  return (
    <button
      type="button"
      className={`sl-slot${phone ? " sl-slot--phone" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {time}
      {subLabel && !phone ? <small>{subLabel}</small> : null}
    </button>
  );
}

export interface TimeSlotGroupProps {
  /** "Morning" / "Afternoon" */
  partLabel: string;
  countLabel: string;
  /** Full a11y group label, day-specific: "Morning times on Thursday, October 8". */
  groupLabel: string;
  phone?: boolean;
  children: React.ReactNode;
}

/** Group wrapper: role="group" with a day-specific label (HANDOVER §11). */
export function TimeSlotGroup({ partLabel, countLabel, groupLabel, phone = false, children }: TimeSlotGroupProps) {
  return (
    <div>
      <div className="sl-slot-group-head">
        <h3>{partLabel}</h3>
        <span>{countLabel}</span>
      </div>
      <div className={phone ? "sl-slots sl-slots--phone" : "sl-slots"} role="group" aria-label={groupLabel}>
        {children}
      </div>
    </div>
  );
}
