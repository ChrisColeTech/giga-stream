import { cn } from "../lib/cn";

export interface SwatchOption<T extends string> {
  readonly id: T;
  /** The swatch's own fill, a token class (`bg-sw-amber`). Each swatch shows its own colour whatever the active one is. */
  readonly fill: string;
}

export interface SwatchesProps<T extends string> {
  readonly value: T;
  readonly onChange: (id: T) => void;
  /** The swatches in display order. */
  readonly options: readonly SwatchOption<T>[];
  /** The group's accessible name, e.g. "Accent". */
  readonly label: string;
  readonly disabled?: boolean;
}

/** A radio group of filled circles, the chosen one ringed. One tab stop (the chosen swatch); the arrows and Home/End
 *  move and Enter or Space chooses, so hunting along the row is not a write for every step. */
export function Swatches<T extends string>({ value, onChange, options, label, disabled = false }: SwatchesProps<T>) {
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-2"
      onKeyDown={(event) => {
        const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='radio']"));
        const at = nodes.indexOf(document.activeElement as HTMLButtonElement);
        if (at < 0) return;
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        const to = event.key === "Home" ? 0 : event.key === "End" ? nodes.length - 1 : step === 0 ? -1 : (at + step + nodes.length) % nodes.length;
        if (to < 0) return;
        event.preventDefault();
        nodes.forEach((node, index) => (node.tabIndex = index === to ? 0 : -1));
        nodes[to]?.focus();
      }}
    >
      {options.map(({ id, fill }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-label={id}
          aria-checked={id === value}
          tabIndex={id === value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn(
            "size-5 cursor-pointer rounded-full border-0 p-0 active:scale-90",
            "transition-[box-shadow,transform] duration-fade ease-linear disabled:cursor-not-allowed",
            fill,
            /* The 2px ring sits outside the 20px fill (a shadow takes no room, so nothing shifts when it moves). */
            id === value ? "shadow-[0_0_0_2px_var(--color-text)]" : "shadow-none",
          )}
        />
      ))}
    </span>
  );
}
