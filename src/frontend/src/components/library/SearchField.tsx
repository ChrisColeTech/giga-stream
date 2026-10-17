import { Search, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { TextField } from "@/components/ui/TextField";
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
      <Search className="pointer-events-none absolute left-2 size-3.5 text-muted" aria-hidden />
      <TextField
        data-search
        aria-label="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9! pr-7 pl-7"
      />
      <IconButton
        aria-label={LIBRARY_COPY.searchClear}
        title={empty ? LIBRARY_COPY.searchEmpty : LIBRARY_COPY.searchClear}
        disabled={empty}
        onClick={() => onChange("")}
        className="absolute right-1 size-6"
      >
        <X className="size-3" aria-hidden />
      </IconButton>
    </div>
  );
}
