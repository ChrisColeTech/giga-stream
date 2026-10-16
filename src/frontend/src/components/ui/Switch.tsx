import { cn } from "@/lib/cn";

export interface SwitchProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly reason?: string;
}

/** An on and off switch on the control vocabulary: a recessed track with a raised knob, accent when on. */
export function Switch({ label, checked, onChange, disabled = false, reason }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      title={reason}
      data-on={checked ? "" : undefined}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-4 w-7 flex-none cursor-pointer items-center rounded-full border border-ctl-edge bg-surface p-0",
        "transition-[background,border-color] duration-fade ease-linear",
        "data-on:border-accent-edge data-on:bg-accent-tint",
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block size-2.5 rounded-full bg-muted transition-transform duration-fade ease-linear",
          checked ? "translate-x-3.25 bg-accent-text" : "translate-x-0.75",
        )}
      />
    </button>
  );
}
