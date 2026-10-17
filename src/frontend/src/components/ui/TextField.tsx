import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** The field's accessible name; a field is never labelled by its placeholder. */
  readonly "aria-label": string;
  /** A measurement or a code reads in mono. */
  readonly mono?: boolean;
  readonly ref?: Ref<HTMLInputElement>;
}

/** The family's text field: one control height (28px, the same as a select and a segmented track), a hairline border,
 *  the recessed surface fill, 13px text, a dim placeholder that is never the label. It spans the row's control
 *  column. */
export function TextField({ className, mono = false, ref, ...input }: TextFieldProps) {
  return (
    <input
      ref={ref}
      autoComplete="off"
      spellCheck={false}
      className={cn(
        "h-ctl-md min-w-0 flex-1 rounded-ctl border border-ctl-edge bg-surface px-2 text-[13px] text-text " +
          "placeholder:text-dim disabled:cursor-not-allowed disabled:opacity-45",
        mono ? "font-mono" : "font-sans",
        className,
      )}
      {...input}
    />
  );
}
