import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { cn } from "@giga/ui/lib/cn";
import { MENU_PANEL, MENU_ROW } from "@giga/ui/menus/ContextMenuRow";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { SEARCH_MIN_GENRES } from "@/lib/library-limits";

export interface GenrePopoverProps {
  readonly genres: readonly string[];
  readonly selected: readonly string[];
  readonly onChange: (genres: readonly string[]) => void;
}

/** The Genre filter: a field-shaped multi-select checklist, searchable from twelve supplied genres. */
export function GenrePopover({ genres, selected, onChange }: GenrePopoverProps) {
  const [text, setText] = useState("");
  const query = text.trim().toLocaleLowerCase();
  const shown = query === "" ? genres : genres.filter((genre) => genre.toLocaleLowerCase().includes(query));
  const label = selected.length === 0 ? LIBRARY_COPY.anyGenre : selected.join(", ");
  const toggle = (genre: string): void => {
    onChange(selected.includes(genre) ? selected.filter((item) => item !== genre) : [...selected, genre]);
  };
  const keepInputKeys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Escape") event.stopPropagation();
  };
  return (
    <Menu.Root onOpenChange={(open) => { if (!open) setText(""); }}>
      <Menu.Trigger aria-label="Genre" className={cn(FIELD_CONTROL, "flex w-full items-center justify-between gap-2 text-left")}>
        <span className="min-w-0 truncate">{label}</span><ChevronDown className="size-3.5 flex-none text-faint" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={4} collisionPadding={8} className={cn(MENU_PANEL, "max-h-72 min-w-[240px]")}>
          {genres.length >= SEARCH_MIN_GENRES && (
            <div className="relative m-1" onKeyDown={keepInputKeys}>
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
              <Input aria-label="Search genres" className={cn(FIELD_CONTROL, "pl-7!")} value={text}
                onChange={(event) => setText(event.target.value)} />
            </div>
          )}
          <div role="group" aria-label="Genres" className="max-h-60 overflow-y-auto">
            {shown.map((genre) => (
              <Menu.CheckboxItem key={genre} checked={selected.includes(genre)} className={MENU_ROW}
                onSelect={(event) => event.preventDefault()} onCheckedChange={() => toggle(genre)}>
                <span className="grid size-3.5 place-items-center">
                  <Menu.ItemIndicator><Check className="text-accent-text" aria-hidden /></Menu.ItemIndicator>
                </span>
                <span>{genre}</span>
              </Menu.CheckboxItem>
            ))}
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
