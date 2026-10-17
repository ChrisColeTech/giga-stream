import { cn } from '@/lib/cn'

/* The job-state ramp, and the only place it may be used besides status text
 * (doc 07 §2): a ≤8px dot. */
export type DotState = 'queued' | 'loading' | 'generating' | 'running' | 'done' | 'failed' | 'error' | 'cancelled'

const FILL: Record<DotState, string> = {
  queued: 'bg-st-queued',
  loading: 'bg-st-loading',
  generating: 'bg-st-generating',
  running: 'bg-st-generating',
  done: 'bg-st-done',
  failed: 'bg-st-failed',
  error: 'bg-st-failed',
  cancelled: 'bg-st-failed',
}

export function StatusDot({ state = 'queued', className }: { state?: DotState; className?: string }) {
  return <i className={cn('size-[7px] flex-none rounded-full', FILL[state], className)} />
}
