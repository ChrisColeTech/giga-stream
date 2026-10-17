import type { ComponentType } from "react";

/** One entry of a settings rail: the id a program switches on, its label and its icon. */
export interface SettingsSection<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

/* LoRA Studio's settings rail (components/settings/SettingsOverlay.tsx NAV_BUTTON), on plain buttons: this repo has no
   Headless UI, so `data-selected` is set by hand where LoRA's Tab sets it. */
const NAV_BUTTON =
  "flex h-8.5 w-full cursor-pointer items-center gap-3 border-0 border-l-2 border-l-transparent " +
  "bg-transparent pr-2.5 pl-3 text-left font-sans text-[13px] text-muted " +
  "transition-[background,border-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-text active:bg-hov active:text-faint focus-visible:outline-none " +
  "data-selected:border-l-accent data-selected:bg-ctl data-selected:text-accent-text " +
  "data-selected:[&_svg]:text-accent";

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
            className={NAV_BUTTON}
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
