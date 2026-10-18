import { Search, X } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { IconButton } from "@giga/ui/controls/IconButton";
import { cn } from "@giga/ui/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { LIBRARY_FILTER_MAX } from "@/lib/library-restore";

export interface FilterFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** The Library's Filter (`06` section 4.3): a field with a search glyph that narrows the loaded list by title, and a clear
 *  control that is disabled while the field is empty. Its text is saved with the other filters. */
export function FilterField({ value, onChange }: FilterFieldProps) {
  const empty = value === "";
  return (
    <div className="relative flex min-w-0 items-center">
      <Search className="pointer-events-none absolute left-3 size-3.5 text-faint" aria-hidden />
      <Input
        data-search
        aria-label={LIBRARY_COPY.filter}
        placeholder={LIBRARY_COPY.filterPlaceholder}
        maxLength={LIBRARY_FILTER_MAX}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_CONTROL, "pr-9! pl-8!")}
      />
      <IconButton
        aria-label={LIBRARY_COPY.filterClear}
        title={empty ? LIBRARY_COPY.filterEmpty : LIBRARY_COPY.filterClear}
        disabled={empty}
        onClick={() => onChange("")}
        className="absolute right-1"
      >
        <X className="size-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}
