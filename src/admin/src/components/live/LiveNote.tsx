import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface LiveNoteProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly sentence: string;
  readonly action: string;
  readonly onAction: () => void;
}

/** The note drawn over the picture when the stage has a problem to report: an icon, a title, one sentence and one action.
 *  The card lets presses through; only its action takes them. */
export function LiveNote({ icon: Icon, title, sentence, action, onAction }: LiveNoteProps) {
  return (
    <div
      role="status"
      className="pointer-events-none flex w-full max-w-[320px] flex-col items-center gap-2 rounded-card border border-border bg-panel p-4 text-center shadow-menu"
    >
      <Icon className="size-5 text-muted" aria-hidden />
      <p className="text-sm leading-5 font-semibold text-text">{title}</p>
      <p className="text-sm leading-5 text-muted">{sentence}</p>
      <Button size="sm" variant="ghost" onClick={onAction} className="pointer-events-auto">
        {action}
      </Button>
    </div>
  );
}
