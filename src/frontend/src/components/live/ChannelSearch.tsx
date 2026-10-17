import { Search, X } from "lucide-react";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
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

/** The search field and the category select at the head of the channels pane. The field carries `data-search`, so
 *  Ctrl+F lands on it (`06` section 8). */
export function ChannelSearch({
  query,
  onQueryChange,
  category,
  categories,
  total,
  onCategoryChange,
}: ChannelSearchProps) {
  return (
    <div className="flex flex-none flex-col gap-1.5 px-3 pb-2">
      <div className="relative flex min-w-0 items-center">
        <Search className="pointer-events-none absolute left-2 size-3.25 text-muted" aria-hidden />
        <TextField
          aria-label={SEARCH_LABEL}
          value={query}
          data-search=""
          onChange={(event) => onQueryChange(event.target.value)}
          className="pr-7 pl-7"
        />
        {query !== "" && (
          <button
            type="button"
            aria-label={CLEAR_SEARCH_LABEL}
            onClick={() => onQueryChange("")}
            className={cn(
              "absolute top-0.5 right-0.5 bottom-0.5 inline-flex w-5 cursor-pointer items-center justify-center",
              "rounded-ctl border-0 bg-transparent text-muted transition-[background,color] duration-fade ease-linear",
              "hover:bg-hov hover:text-text",
            )}
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>
      <SelectField
        label={CATEGORY_LABEL}
        value={category}
        options={categoryOptions(categories, category, total)}
        onChange={onCategoryChange}
      />
    </div>
  );
}
