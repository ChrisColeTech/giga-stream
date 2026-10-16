import { Info } from "lucide-react";
import { useId } from "react";

/** The family's tooltip on an info glyph: the explanation lives here, never as hint text under a control. The glyph is a
 *  keyboard stop; the bubble shows on hover and on focus, and its text is the glyph's accessible description. */
export function Tip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="group/tip relative inline-flex">
      <span
        tabIndex={0}
        role="img"
        aria-label="More information"
        aria-describedby={id}
        className="inline-flex size-4 items-center justify-center rounded-full text-faint outline-none hover:text-muted focus-visible:text-muted"
      >
        <Info className="size-3.75" aria-hidden />
      </span>
      <span
        id={id}
        role="tooltip"
        className={
          "pointer-events-none absolute top-full left-0 z-70 mt-1.5 hidden w-max max-w-[320px] rounded-card border " +
          "border-border bg-panel px-2.5 py-1.5 text-[13px] leading-snug font-normal text-text shadow-menu " +
          "group-focus-within/tip:block group-hover/tip:block"
        }
      >
        {text}
      </span>
    </span>
  );
}
