import { LogOut, type LucideIcon } from "lucide-react";
import { GATE_NOTICE_TITLE } from "@/constants/gate-copy";

export interface GateNoticeProps {
  readonly sentence: string;
  /** The card's heading; the session that ended by default. */
  readonly title?: string;
  readonly icon?: LucideIcon;
}

/** A titled card stating one fact about the gate: the session that ended, a password reset, or why a reset cannot be
 *  done. It sits above or between rows of a form that still works. A refusal of a field is not a card: it goes under
 *  its row. */
export function GateNotice({ sentence, title = GATE_NOTICE_TITLE, icon: Icon = LogOut }: GateNoticeProps) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-panel p-3" role="status">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <Icon className="size-3.75 flex-none text-faint" aria-hidden />
        <span>{title}</span>
      </div>
      <p className="m-0 text-xs leading-[1.55] text-faint">{sentence}</p>
    </div>
  );
}
