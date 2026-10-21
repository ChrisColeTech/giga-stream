import type { ComponentType } from "react";
import { NAV_ROW } from "../lists/nav-classes";

/** One entry of a settings rail: the id a program switches on, its label and its icon. */
export interface SettingsSection<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

export interface SettingsRailProps<Id extends string> {
  readonly sections: readonly SettingsSection<Id>[];
  readonly selected: Id;
  readonly onSelect: (id: Id) => void;
}

/** A settings window's rail: its sections down the left edge, 150 wide and 210 on a wide window. */
export function SettingsRail<Id extends string>({ sections, selected, onSelect }: SettingsRailProps<Id>) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Settings sections"
      className="flex w-[150px] flex-none flex-col overflow-y-auto border-r border-hair bg-panel py-1.5 lg:w-[210px]"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const on = section.id === selected;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-selected={on ? "" : undefined}
            className={NAV_ROW}
            onClick={() => onSelect(section.id)}
          >
            <Icon className="size-3.75 flex-none" />
            {section.label}
          </button>
        );
      })}
    </div>
  );
}
