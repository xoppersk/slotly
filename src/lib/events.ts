/* Slotly v2 — mock live-availability event stream (HANDOVER §10).
   A tiny typed emitter: surfaces subscribe while a page is open; a slot
   that is taken/held/released elsewhere is announced, never silently
   swapped. Pure client-side mock — no server, no wall-clock canon. */

export type SlotEventType = "slot-taken" | "slot-held" | "slot-released";

export interface SlotEvent {
  type: SlotEventType;
  barberId: string;
  date: string; // YYYY-MM-DD
  time: string; // "9:00 AM"
  message: string;
}

type Listener = (event: SlotEvent) => void;

const listeners = new Set<Listener>();

export function emitSlotEvent(event: SlotEvent): void {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      /* a broken listener must not break availability for everyone */
    }
  });
}

export function subscribeSlotEvents(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Demo helper: pretend another customer just took a slot. */
export function simulateSlotTaken(barberId: string, date: string, time: string): void {
  emitSlotEvent({
    type: "slot-taken",
    barberId,
    date,
    time,
    message: `Someone booked ${time} just ahead of you.`,
  });
}

/** Demo helper: pretend a hold was placed on a slot. */
export function simulateSlotHeld(barberId: string, date: string, time: string): void {
  emitSlotEvent({
    type: "slot-held",
    barberId,
    date,
    time,
    message: `${time} is being held by someone else.`,
  });
}
