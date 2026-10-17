import { LogOut } from "lucide-react";
import { GATE_NOTICE_TITLE } from "@/constants/sign-in-copy";

/** A titled card stating one fact about the gate: the session that ended (the reference's `GateBlock`, plain tone). It
 *  sits above a form that still works. A refusal is not a card: it goes under the Password row. */
export function GateNotice({ sentence }: { sentence: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-panel p-3" role="status">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
        <LogOut className="size-3.75 flex-none text-faint" aria-hidden />
        <span>{GATE_NOTICE_TITLE}</span>
      </div>
      <p className="m-0 text-xs leading-[1.55] text-faint">{sentence}</p>
    </div>
  );
}
