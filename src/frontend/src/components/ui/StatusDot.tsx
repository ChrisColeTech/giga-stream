import { cn } from "@/lib/cn";

/* The state ramp, and the only place it may be used besides status text: a dot of 8px or less. */
export type DotState = "queued" | "loading" | "running" | "done" | "failed";

const FILL: Record<DotState, string> = {
  queued: "bg-st-queued",
  loading: "bg-st-loading",
  running: "bg-st-generating",
  done: "bg-st-done",
  failed: "bg-st-failed",
};

export function StatusDot({ state = "queued", className }: { state?: DotState; className?: string }) {
  return <i className={cn("size-[7px] flex-none rounded-full", FILL[state], className)} />;
}
