import { ChevronDown } from "lucide-react";
import { useState, type KeyboardEvent, type FocusEvent, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/Form";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { SEARCH_MIN_GENRES } from "@/lib/library-limits";

export interface GenrePopoverProps {
  readonly genres: readonly string[];
  readonly selected: readonly string[];
  readonly onChange: (genres: readonly string[]) => void;
}

/** The Genre filter: a field that opens a popover of chips, one per genre. A search box is offered from twelve genres.
 *  The popover closes on Escape and when focus leaves it, so it needs no global listener. */
export function GenrePopover({ genres, selected, onChange }: GenrePopoverProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const query = text.trim().toLocaleLowerCase();
  const shown = query === "" ? genres : genres.filter((genre) => genre.toLocaleLowerCase().includes(query));
  const label = selected.length === 0 ? LIBRARY_COPY.anyGenre : selected.join(", ");

  const toggle = (genre: string): void => {
    onChange(selected.includes(genre) ? selected.filter((item) => item !== genre) : [...selected, genre]);
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (!(next instanceof Node && wrap.current?.contains(next))) setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Escape" || !open) return;
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div ref={wrap} className="relative" onBlur={onBlur} onKeyDown={onKeyDown}>
      <Button
        ref={trigger}
        full
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="h-9! justify-between! px-3!"
      >
        <span className="min-w-0 truncate text-sm font-normal">{label}</span>
        <ChevronDown className="size-3.5 flex-none text-muted" aria-hidden />
      </Button>
      {open && (
        <div
          role="group"
          aria-label="Genres"
          className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-72 flex-col gap-2 overflow-y-auto rounded-card border border-border bg-panel p-2 shadow-menu"
        >
          {genres.length >= SEARCH_MIN_GENRES && (
            <Input
              aria-label="Search genres"
              className={FIELD_CONTROL}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            {shown.map((genre) => {
              const on = selected.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(genre)}
                  className={cn(
                    "h-6 cursor-pointer rounded-full border px-2.5 font-sans text-xs transition-[background,border-color,color] duration-fade ease-linear",
                    on
                      ? "border-accent-edge bg-accent-tint text-accent-text"
                      : "border-ctl-edge bg-transparent text-muted hover:bg-hov hover:text-text",
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
