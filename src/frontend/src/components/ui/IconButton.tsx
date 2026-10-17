import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* The size is a variant, never an appended class: `cn()` is a plain join, so an appended `size-*` would sit in the same
 * layer as the base size and lose on stylesheet order. `md` is the toolbar size; `sm` is a window's row control (24px). */
const SIZES = { md: "size-ctl-md", sm: "size-ctl-sm" } as const;

const BASE =
  "inline-flex items-center justify-center rounded-ctl border border-transparent " +
  "bg-transparent p-0 text-muted cursor-pointer " +
  "transition-[background,border-color,color,box-shadow] duration-fade ease-linear " +
  "hover:bg-hov hover:text-text active:bg-hov active:text-faint " +
  "disabled:pointer-events-none disabled:cursor-default disabled:opacity-30 disabled:shadow-none " +
  /* The pressed state is a `data-on:` VARIANT, not an appended class list. `cn()` is a plain join with no conflict
     resolution, so `bg-accent-tint` would sit in the same layer as the base `bg-transparent` and lose to it on
     stylesheet order. Variants are emitted after the base utilities, so they always win. */
  "data-on:border-accent-edge data-on:bg-accent-tint data-on:text-accent-text " +
  "data-on:shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)] data-on:active:shadow-none";

/* `bordered` is the STANDALONE icon action, so it wears the same raised shape as a button: a top-lit gradient from
 * --ctl-hi down to --ctl, a soft drop, and a press that REMOVES the shadow and flattens the fill. */
const BORDERED =
  "border-ctl-edge text-text bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] " +
  "shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] " +
  "hover:border-dim hover:bg-[linear-gradient(180deg,var(--color-ctl-hov),var(--color-ctl-hi))] " +
  "active:bg-[var(--color-ctl)] active:text-muted active:shadow-none";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggle-on state (a pane toggle whose pane is open, say). */
  on?: boolean;
  /** Give the button the same fill and edge as a button, for standalone actions. */
  bordered?: boolean;
  /** `md` (28px) for toolbars; `sm` (24px) for a control in a window's row. */
  size?: keyof typeof SIZES;
}

export function IconButton({ on = false, bordered = false, size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      data-on={on ? "" : undefined}
      className={cn(BASE, SIZES[size], bordered && BORDERED, className)}
      {...rest}
    />
  );
}
