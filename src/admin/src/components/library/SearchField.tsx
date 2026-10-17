import { Search, X } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@/components/ui/Form";
import { IconButton } from "@giga/ui/controls/IconButton";
import { cn } from "@giga/ui/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";

export interface SearchFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** The Library's search: a field with a search glyph, and a clear control that is disabled while the field is empty. */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const empty = value === "";
  return (
    <div className="relative flex min-w-0 items-center">
      <Search className="pointer-events-none absolute left-3 size-3.5 text-faint" aria-hidden />
      <Input
        data-search
        aria-label="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_CONTROL, "pr-9! pl-8!")}
      />
      <IconButton
        aria-label={LIBRARY_COPY.searchClear}
        title={empty ? LIBRARY_COPY.searchEmpty : LIBRARY_COPY.searchClear}
        disabled={empty}
        onClick={() => onChange("")}
        className="absolute right-1"
      >
        <X className="size-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}
