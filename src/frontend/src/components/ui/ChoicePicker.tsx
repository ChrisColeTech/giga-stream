import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { MENU_PANEL, MENU_ROW } from "@giga/ui/menus/ContextMenuRow";
import { cn } from "@giga/ui/lib/cn";

export interface ChoicePickerOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface ChoicePickerProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly ChoicePickerOption<T>[];
  readonly onChange: (value: T) => void;
  readonly searchable?: boolean;
}

/** A field-shaped single-choice picker with check rows and optional in-menu search. */
export function ChoicePicker<T extends string>({ label, value, options, onChange, searchable }: ChoicePickerProps<T>) {
  const [text, setText] = useState("");
  const query = text.trim().toLocaleLowerCase();
  const shown = query === "" ? options : options.filter((option) => option.label.toLocaleLowerCase().includes(query));
  const selected = options.find((option) => option.value === value)?.label ?? value;
  const keepInputKeys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Escape") event.stopPropagation();
  };
  return (
    <Menu.Root onOpenChange={(open) => { if (!open) setText(""); }}>
      <Menu.Trigger
        aria-label={label}
        className={cn(FIELD_CONTROL, "flex w-full cursor-pointer items-center justify-between gap-2 text-left")}
      >
        <span className="min-w-0 truncate">{selected}</span>
        <ChevronDown className="size-3.5 flex-none text-faint" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={4} collisionPadding={8} className={cn(MENU_PANEL, "max-h-72 min-w-[220px]")}>
          {searchable === true && (
            <div className="relative m-1" onKeyDown={keepInputKeys}>
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
              <Input
                aria-label={`Search ${label.toLocaleLowerCase()}`}
                className={cn(FIELD_CONTROL, "pl-7!")}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
          )}
          <Menu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)} className="max-h-60 overflow-y-auto">
            {shown.map((option) => (
              <Menu.RadioItem key={option.value} value={option.value} className={MENU_ROW}>
                <span className="grid size-3.5 place-items-center">
                  <Menu.ItemIndicator><Check className="text-accent-text" aria-hidden /></Menu.ItemIndicator>
                </span>
                <span>{option.label}</span>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
