import type { PillStatus } from "@/lib/types";

const KIND: Record<string, string> = {
  Done: "sl-pill--done",
  "Not booked yet": "sl-pill--done",
  "In the chair": "sl-pill--chair",
  Arrived: "sl-pill--positive",
  Confirmed: "sl-pill--positive",
  Working: "sl-pill--positive",
  Approved: "sl-pill--positive",
  Upcoming: "sl-pill--upcoming",
  "Invite sent": "sl-pill--upcoming",
  Away: "sl-pill--away",
  Taken: "sl-pill--done",
};

/** StatusPill — a status is always a word in a pill (HANDOVER §5 rule 2).
    Fill mapping per the DS StatusPill README; geometry/copy as drawn on
    the Premium v2 screens. `label` overrides the text (e.g. "Away · Oct 6–19"). */
export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  return <span className={`sl-pill ${KIND[status] ?? "sl-pill--upcoming"}`}>{label ?? status}</span>;
}
