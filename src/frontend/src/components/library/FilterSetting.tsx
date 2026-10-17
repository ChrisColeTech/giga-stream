import type { ReactNode } from "react";

export interface FilterSettingProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** One setting of the right pane: a bold label stacked over its 36 px control. */
export function FilterSetting({ label, children }: FilterSettingProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-1">
      <span className="font-sans text-xs leading-4 font-semibold text-text">{label}</span>
      {children}
    </div>
  );
}
