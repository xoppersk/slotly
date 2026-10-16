import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "destructive" | "linen" | "ink";
type Size = "booking" | "phone" | "dashboard" | "dashPrimary" | "sm";

const cls = (variant: Variant, size: Size) =>
  [
    "sl-btn",
    variant === "primary" ? "sl-btn--primary" : "",
    variant === "destructive" ? "sl-btn--destructive" : "",
    variant === "linen" ? "sl-btn--linen" : "",
    variant === "ink" ? "sl-btn--ink" : "",
    size === "phone" ? "sl-btn--phone" : "",
    size === "dashboard" ? "sl-btn--dash" : "",
    size === "dashPrimary" ? "sl-btn--dash-primary sl-btn--primary" : "",
    size === "sm" ? "sl-btn--sm" : "",
  ].filter(Boolean).join(" ");

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

/** Button — DS: primary oxblood (52px booking / 48px phone / 40px dashboard),
    outline (card fill, control ring), quiet destructive (outline, oxblood text). */
export function Button({
  variant = "outline",
  size = "booking",
  children,
  className = "",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${cls(variant, size)} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "outline",
  size = "booking",
  children,
  className = "",
  ...rest
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${cls(variant, size)} ${className}`} {...rest}>
      {children}
    </a>
  );
}
