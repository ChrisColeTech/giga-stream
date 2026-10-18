import { Search } from "lucide-react";
import { Input } from "../controls/Input";
import { FIELD_CONTROL } from "../form/form-classes";
import { cn } from "../lib/cn";

export interface QuerySearchProps {
  /** The field's accessible name and its tooltip (`Search channels`). */
  readonly label: string;
  readonly value: string;
  readonly onChange: (text: string) => void;
  /** Enter runs the search; nothing runs as you type. */
  readonly onEnter: () => void;
  /** The tooltip at rest when it says more than the label (what is searched); the label by default. */
  readonly tip?: string;
  /** Why it waits; the field is natively disabled and the reason is its tooltip. */
  readonly reason?: string;
}

/** The search field of a list's first row, LoRA Studio `LibraryToolbar`'s verbatim: it takes the row's width
 *  (`min-w-[220px] flex-1`) with the search icon inside it at the left. It carries `data-search`, so `Ctrl+F` focuses it. */
export function QuerySearch({ label, tip, value, onChange, onEnter, reason }: QuerySearchProps) {
  return (
    <span className="relative min-w-[220px] flex-1">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dim" />
      <Input
        type="search"
        value={value}
        title={reason ?? tip ?? label}
        aria-label={label}
        data-search=""
        autoComplete="off"
        spellCheck={false}
        disabled={reason !== undefined}
        className={cn(FIELD_CONTROL, "pl-7!")}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter();
        }}
      />
    </span>
  );
}
