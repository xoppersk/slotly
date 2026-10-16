import { Button } from "./Button";
import { IconArrowRightLg } from "./icons";
import { formatWholeDollars } from "@/lib/api";

export interface ChairCardProps {
  customer: string;
  service: string;
  windowLabel: string; // "9:45 – 10:35"
  balanceCents: number;
  overrunLabel?: string; // "Ran 5 min over"
  onFinish?: () => void;
}

/** ChairCard — top of the staff agenda (StaffAgenda.html): ink fill,
    radius-xl, who / what / booked window / what's left to pay, overrun
    in words, one button: "Finish and take $X". */
export function ChairCard({ customer, service, windowLabel, balanceCents, overrunLabel, onFinish }: ChairCardProps) {
  const balance = formatWholeDollars(balanceCents);
  return (
    <section className="sl-chair" aria-labelledby="sl-chair-now">
      <div className="sl-chair__head">
        <h2 id="sl-chair-now" className="sl-chair__label">
          <i aria-hidden="true" />
          In your chair
        </h2>
        {overrunLabel ? <span className="sl-chair__over">{overrunLabel}</span> : null}
      </div>
      <p className="sl-chair__name">{customer}</p>
      <p className="sl-chair__meta">
        {service} · {windowLabel} · {balance} left to pay
      </p>
      <div className="sl-chair__cta">
        <Button variant="linen" onClick={onFinish}>
          Finish and take {balance} <IconArrowRightLg />
        </Button>
      </div>
    </section>
  );
}

export interface ChairCardNextProps {
  customer: string;
  time: string; // "10:45"
  onCheckIn?: () => void;
}

/** Empty-chair form (DS ChairCard README): "Next: Leo Park at 10:45" + Check in. */
export function ChairCardNext({ customer, time, onCheckIn }: ChairCardNextProps) {
  return (
    <section className="sl-chair" aria-label="Next in your chair">
      <div className="sl-chair__head">
        <h2 className="sl-chair__label">
          <i aria-hidden="true" />
          Your chair is free
        </h2>
      </div>
      <p className="sl-chair__name" style={{ fontSize: 26 }}>
        Next: {customer} at {time}
      </p>
      <div className="sl-chair__cta" style={{ marginTop: 14 }}>
        <Button variant="linen" onClick={onCheckIn}>Check in</Button>
      </div>
    </section>
  );
}
