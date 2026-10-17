import { Square } from "lucide-react";
import { useEffect, useState } from "react";
import { JOBS } from "@/fixtures/jobs";
import { cn } from "@/lib/cn";
import { cancelJob } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import { isLive } from "@/types/job";

/* LoRA Studio's running work (components/layout/Statusbar.tsx): a bar that fills, the count of live jobs with the first
 * one's percent, and the one way to stop it, an inline two-step. An empty track and "idle" while nothing runs: the bar
 * is furniture, not a sentence. A job that cannot say how far it is (a scan walking its folder) fills the bar and
 * pulses. Phase 1 reads the jobs fixture. */
const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.25 rounded-ctl border-0 bg-transparent px-1.5 py-0.5 " +
  "font-sans text-xs text-muted transition-[background-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-text active:bg-hov disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-2.75";

export function RunningWork() {
  const say = useAppStore((state) => state.say);
  const live = JOBS.filter(isLive);
  const running = live[0] ?? null;
  const percent = running?.percent === undefined ? null : Math.max(0, Math.min(100, running.percent));
  /* Armed = the first press happened; it disarms when the job it was armed for is gone. */
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (armed !== null && running?.id !== armed) setArmed(null);
  }, [armed, running]);

  const stop = () => {
    if (running === null) return;
    if (armed !== running.id) {
      setArmed(running.id);
      return;
    }
    setArmed(null);
    const result = cancelJob(running.id);
    if (!result.ok) say(result.message, "warn");
  };

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={running === null ? "Nothing running" : `${running.label}${percent === null ? "" : ` · ${percent}%`}`}
    >
      <span
        className="relative h-1.5 w-28 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label="Running work"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-move ease-in",
            running !== null && percent === null && "animate-pulse-busy",
          )}
          style={{ width: running === null ? "0%" : `${percent ?? 100}%` }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-dim">
        {running === null ? "idle" : `${live.length} running${percent === null ? "" : ` · ${percent}%`}`}
      </span>
      <button
        type="button"
        className={cn(BUTTON, armed !== null && "text-st-failed")}
        disabled={running === null}
        title={running === null ? "Nothing to stop" : armed !== null ? "Press again to stop the running work" : "Stop the running work"}
        onClick={stop}
      >
        <Square aria-hidden /> {armed !== null ? "Confirm stop" : "Stop"}
      </button>
      {armed !== null && (
        <button type="button" className={BUTTON} title="Keep it running" onClick={() => setArmed(null)}>
          Keep running
        </button>
      )}
    </span>
  );
}
