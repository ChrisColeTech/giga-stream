import type { ReactNode } from "react";

export interface FilterSettingProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** One setting of the right pane: its label, in the control-label role of `21` section 8a (sans 12px, muted), stacked over
 *  its 36 px control. */
export function FilterSetting({ label, children }: FilterSettingProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-1">
      <span className="font-sans text-xs leading-4 text-muted">{label}</span>
      {children}
    </div>
  );
}
