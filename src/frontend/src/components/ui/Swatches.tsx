import { cn } from "@giga/ui/lib/cn";
import type { Accent } from "@/types/shell";

/** Each swatch always shows its own family, independent of the active accent. */
const FILL: Record<Accent, string> = {
  amber: "bg-sw-amber",
  violet: "bg-sw-violet",
  blue: "bg-sw-blue",
  green: "bg-sw-green",
  rose: "bg-sw-rose",
};

/** The family's display order: amber, blue, green, violet, rose. */
const ORDER: readonly Accent[] = ["amber", "blue", "green", "violet", "rose"];

/** The accent colour-swatch radio group: five filled circles, each its OWN family whatever the active accent, the chosen
 *  one ringed. One tab stop (the chosen swatch); the arrows and Home/End move and Enter or Space chooses, so hunting
 *  from amber to rose is not four writes nobody asked for. */
export function Swatches({ value, onChange, disabled = false }: { value: Accent; onChange: (accent: Accent) => void; disabled?: boolean }) {
  return (
    <span
      role="radiogroup"
      aria-label="Accent"
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
      {ORDER.map((accent) => (
        <button
          key={accent}
          type="button"
          role="radio"
          aria-label={accent}
          aria-checked={accent === value}
          tabIndex={accent === value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(accent)}
          className={cn(
            "size-5 cursor-pointer rounded-full border-0 p-0 active:scale-90",
            "transition-[box-shadow,transform] duration-fade ease-linear disabled:cursor-not-allowed",
            FILL[accent],
            /* The 2px ring sits outside the 20px fill (a shadow takes no room, so nothing shifts when it moves). */
            accent === value ? "shadow-[0_0_0_2px_var(--color-text)]" : "shadow-none",
          )}
        />
      ))}
    </span>
  );
}
