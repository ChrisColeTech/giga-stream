import { cn } from '../lib/cn'

/** A tick that says a field's edit has been written — the settings panes' answer instead of a dirty banner (doc 06 §1a). Caption 12. */
export function SavedTick({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  return (
    <span
      className={cn('font-mono text-xs', state === 'saved' ? 'text-st-done' : state === 'error' ? 'text-st-failed' : 'animate-pulse-busy text-faint')}
      role="status"
      aria-live="polite"
    >
      {state === 'saved' ? '✓ saved' : state === 'error' ? 'could not save' : 'saving…'}
    </span>
  )
}
