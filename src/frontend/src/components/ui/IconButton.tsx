import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

/* Each state's fill, ink and edge is ONE string, chosen whole and never appended over another: `cn()` is a plain join
 * with no conflict resolution, so two colours in one layer would resolve by stylesheet order. Variants (`data-on:`) are
 * emitted after the base utilities, so they always win. */
const BASE =
  "inline-flex size-ctl-md items-center justify-center border border-transparent p-0 cursor-pointer " +
  "transition-[background,border-color,color,box-shadow] duration-fade ease-linear " +
  "disabled:pointer-events-none disabled:cursor-default disabled:opacity-30 disabled:shadow-none " +
  "data-on:border-accent-edge data-on:bg-accent-tint data-on:text-accent-text " +
  "data-on:shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)] data-on:active:shadow-none";

const PLAIN = "bg-transparent text-muted hover:bg-hov hover:text-text active:bg-hov active:text-faint";

/* `bordered` is the STANDALONE icon action, so it wears the same raised shape as a button: a top-lit gradient from
 * --ctl-hi down to --ctl, a soft drop, and a press that REMOVES the shadow and flattens the fill. */
const BORDERED =
  "border-ctl-edge text-muted bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] " +
  "shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] " +
  "hover:border-dim hover:text-text hover:bg-[linear-gradient(180deg,var(--color-ctl-hov),var(--color-ctl-hi))] " +
  "active:bg-[var(--color-ctl)] active:text-muted active:shadow-none";

/* `primary` is the one accent action of a group, the family's primary Button in icon form. */
const PRIMARY =
  "border-accent text-accent-ink bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent))] " +
  "shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)] " +
  "hover:border-accent-strong hover:bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent-strong))] " +
  "active:bg-[var(--color-accent)] active:text-[color-mix(in_srgb,var(--color-accent-ink)_75%,transparent)] " +
  "active:shadow-none";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggle-on state (a pane toggle whose pane is open, say). */
  on?: boolean;
  /** Give the button the same fill and edge as a button, for standalone actions. */
  bordered?: boolean;
  /** The accent action of a group: a filled, accent-ink icon, as the family's primary Button. */
  primary?: boolean;
  /** A circle rather than the control's rounded square, for the icon actions laid over artwork. */
  round?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  on = false,
  bordered = false,
  primary = false,
  round = false,
  className,
  type = "button",
  ref,
  ...rest
}: IconButtonProps) {
  const fill = primary ? PRIMARY : bordered ? BORDERED : PLAIN;
  return (
    <button
      ref={ref}
      type={type}
      data-on={on ? "" : undefined}
      className={cn(BASE, fill, round ? "rounded-full" : "rounded-ctl", className)}
      {...rest}
    />
  );
}
