import { Search, X } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { IconButton } from "@giga/ui/controls/IconButton";
import { FIELD_CONTROL } from "@giga/ui/form/NumberField";
import { cn } from "@giga/ui/lib/cn";
import { categoryOptions } from "@/lib/live-channels";
import { CATEGORY_LABEL, CLEAR_SEARCH_LABEL, SEARCH_LABEL } from "@/lib/live-constants";
import type { ChannelCategory } from "@/types/channel";

export interface ChannelSearchProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly category: string;
  readonly categories: readonly ChannelCategory[];
  readonly total: number;
  readonly onCategoryChange: (category: string) => void;
}

/** The search field and the category select at the head of the channels pane, at the rail control height the playback
 *  pane's selects use. The field carries `data-search`, so Ctrl+F lands on it (`06` section 8). */
export function ChannelSearch({
  query,
  onQueryChange,
  category,
  categories,
  total,
  onCategoryChange,
}: ChannelSearchProps) {
  return (
    <div className="flex flex-none flex-col gap-1.5 px-2.5 pb-2">
      <div className="relative flex min-w-0 items-center">
        <Search className="pointer-events-none absolute left-2 size-3.5 text-faint" aria-hidden />
        <Input
          aria-label={SEARCH_LABEL}
          value={query}
          data-search=""
          onChange={(event) => onQueryChange(event.target.value)}
          className={cn(FIELD_CONTROL, "pr-7! pl-7!")}
        />
        {query !== "" && (
          <IconButton
            aria-label={CLEAR_SEARCH_LABEL}
            title={CLEAR_SEARCH_LABEL}
            onClick={() => onQueryChange("")}
            className="absolute right-0 size-ctl-sm!"
          >
            <X className="size-3.5" aria-hidden />
          </IconButton>
        )}
      </div>
      <Select aria-label={CATEGORY_LABEL} className={FIELD_CONTROL} value={category} onChange={(event) => onCategoryChange(event.target.value)}>
        {categoryOptions(categories, category, total).map((option) => (
          <option key={option.value} value={option.value}>
            {`${option.label} · ${option.count}`}
          </option>
        ))}
      </Select>
    </div>
  );
}
