import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { MENU_PANEL, MENU_ROW } from "@giga/ui/menus/ContextMenuRow";

export interface ChoiceMenuOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
}

export interface ChoiceMenuProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly ChoiceMenuOption<T>[];
  readonly onChange: (value: T) => void;
}

/** A compact operation menu whose rows are one radio choice with a stable check column. */
export function ChoiceMenu<T extends string>({ label, value, options, onChange }: ChoiceMenuProps<T>) {
  const selected = options.find((option) => option.value === value)?.label ?? value;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" aria-label={`${label}: ${selected}`} aria-haspopup="menu">
          {label}: {selected} <ChevronDown aria-hidden />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={4} collisionPadding={8} className={MENU_PANEL}>
          <Menu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <Menu.RadioItem key={option.value} value={option.value} className={MENU_ROW}>
                  <span className="grid size-3.5 place-items-center">
                    <Menu.ItemIndicator><Check className="text-accent-text" aria-hidden /></Menu.ItemIndicator>
                  </span>
                  {Icon !== undefined && <Icon aria-hidden />}
                  <span>{option.label}</span>
                </Menu.RadioItem>
              );
            })}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
