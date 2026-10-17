import type { ReactNode } from "react";

export interface FilterSettingProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** One setting of the right pane, as LoRA Studio's gallery filters have it (components/gallery/ImageFilters.tsx
 *  `Setting`): the label in Body Strong stacked over its 36 px control. */
export function FilterSetting({ label, children }: FilterSettingProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm leading-5 font-semibold text-text">{label}</span>
      {children}
    </div>
  );
}
