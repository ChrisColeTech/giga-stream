import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { IconButton } from "../controls/IconButton";
import { Input } from "../controls/Input";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";
import { cn } from "../lib/cn";
import { compositionEndStep, inputStep } from "../lib/search-input-step";

export interface QuerySearchProps {
  /** The field's accessible name and its tooltip (`Search channels`). */
  readonly label: string;
  /** The field's text, held by the list's state. */
  readonly value: string;
  /** The committed text after a keystroke (not while an IME composes; `compositionend` commits it). The parent stores it. */
  readonly onChange: (text: string) => void;
  /** Runs the query for the stored text: 200 ms after the last keystroke, at once on Enter and on the clear button. */
  readonly onSearch?: (() => void) | undefined;
  /** The old name of `onSearch`, kept until Channels swaps its row; read only when `onSearch` is absent. */
  readonly onEnter?: (() => void) | undefined;
  /** The tooltip at rest when it says more than the label (what is searched); the label by default. */
  readonly tip?: string;
  /** Why it waits; the field is natively disabled and the reason is its tooltip. */
  readonly reason?: string;
}

/** The search field of a list's query row (`QueryBar`): the dominant control, `flex-1` with a 220px floor, the search icon
 *  inside at the left and, once it holds text, a small clear (x) at the right. Compact (the verbs' height), no
 *  placeholder. It searches as you type: the debounce lives in `useDebouncedSearch`. It carries `data-search`, so `Ctrl+F`
 *  focuses it. */
export function QuerySearch({ label, tip, value, onChange, onSearch, onEnter, reason }: QuerySearchProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const run = onSearch ?? onEnter ?? (() => undefined);
  const debounce = useDebouncedSearch(run);
  const shown = draft ?? value;
  const commit = (text: string): void => {
    onChange(text);
    debounce.schedule();
  };
  return (
    <span ref={box} className="relative min-w-[220px] flex-1">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-dim" />
      <Input
        type="search"
        value={shown}
        title={reason ?? tip ?? label}
        aria-label={label}
        data-search=""
        autoComplete="off"
        spellCheck={false}
        disabled={reason !== undefined}
        className={cn(
          "h-ctl-sm! w-full min-w-0 pr-6! pl-6.5! text-xs!",
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none",
        )}
        onChange={(event) => {
          const step = inputStep(event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing, event.target.value);
          setDraft(step.draft);
          if (step.commit) commit(event.target.value);
        }}
        onCompositionEnd={(event) => {
          setDraft(compositionEndStep().draft);
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) debounce.now();
        }}
      />
      {shown !== "" && reason === undefined && (
        <IconButton
          aria-label="Clear search"
          title="Clear search"
          className="absolute top-1/2 right-0.5 size-5! -translate-y-1/2 [&_svg]:size-3"
          onClick={() => {
            setDraft(null);
            onChange("");
            debounce.now();
            box.current?.querySelector("input")?.focus();
          }}
        >
          <X aria-hidden />
        </IconButton>
      )}
    </span>
  );
}
