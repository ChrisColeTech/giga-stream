import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@giga/ui/lib/cn'
import { SHIMMER } from './SkeletonRows'

/* THE SPLIT LIST (doc 03 §Frontend Rules, doc 06 §1c): a parent → child →
 * grandchild browser on the OPEN stage — no frame, no panel, one hairline
 * between columns (owner, 2026-09-05: "no cards, no boxes") — architectures → models, or
 * models → runs → checkpoints. Every column is a scrolling list with its own
 * header and count; picking a row in one column fills the next. A column
 * can be single-select (a highlighted row), multi-select (a tick per row),
 * or free content (the checkpoint verbs). A column that is loading OR empty
 * wears skeleton rows of the same height, so nothing jumps when data lands
 * and nothing ever reads "nothing here" (doc 03 §Loading and Empty). */
export interface SplitItem {
  id: string
  title: ReactNode
  /** A faint second line or a mono tag after the title. */
  meta?: ReactNode
  count?: number | string
  /** A readiness pip before the title. */
  dot?: 'ready' | 'partial' | 'missing'
  disabled?: boolean
  title_attr?: string
}

export interface SplitColumn {
  key: string
  title: string
  items?: SplitItem[]
  /** Replaces the rows: the column shows this instead (verbs, detail). */
  content?: ReactNode
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Multi-select: the ticked ids, and the toggle. */
  checked?: ReadonlySet<string>
  onCheck?: (id: string) => void
  /** Ticks or clears every enabled row — shown in the header when given. */
  onCheckAll?: (on: boolean) => void
  loading?: boolean
  /** The grid track, e.g. `220px` or `minmax(0,1.4fr)`. */
  width?: string
  /** How many skeleton rows to draw while loading or empty. */
  skeleton?: number
  /** A control that belongs to this column, on its header's readout edge — a rescan, an add. */
  action?: ReactNode
}

const DOT: Record<NonNullable<SplitItem['dot']>, string> = { ready: 'bg-st-done', partial: 'bg-sw-amber', missing: 'bg-dim/50' }

const ROW =
  'relative flex h-9 w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 text-left text-sm text-muted ' +
  'transition-colors duration-fade hover:bg-hov hover:text-text disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent ' +
  'data-selected:bg-ctl data-selected:text-text'

const LINE_BOX = "before:content-['\\200b']"

export function SplitSkeleton({ count, tick = true }: { count: number; tick?: boolean }) {
  return (
    <div className="pointer-events-none" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-2.5 px-3">
          {tick && <span className="size-3.5 flex-none rounded-[3px] border border-hair" />}
          <span className={cn('min-w-0 flex-1 text-sm', LINE_BOX)}>
            <span className={cn(SHIMMER, 'h-[9px] rounded-ctl')} style={{ width: `${45 + ((i * 37) % 40)}%` }} />
          </span>
          <span className={cn(SHIMMER, 'h-[9px] w-6 rounded-ctl')} />
        </div>
      ))}
    </div>
  )
}

/** Without `height` the list fills its parent (a `Wide fill` in a `Group fill`); with it, a fixed box inside a scrolling page. */
export function SplitList({ columns, height, className }: { columns: SplitColumn[]; height?: number; className?: string }) {
  return (
    <div
      className={cn('grid overflow-hidden', height === undefined && 'min-h-0 flex-1', className)}
      style={{ gridTemplateColumns: columns.map((c) => c.width ?? 'minmax(0,1fr)').join(' '), height }}
    >
      {columns.map((col, i) => {
        const items = col.items ?? []
        const total = items.length
        const enabled = items.filter((it) => !it.disabled)
        const ticked = col.checked === undefined ? 0 : enabled.filter((it) => col.checked?.has(it.id)).length
        const allOn = enabled.length > 0 && ticked === enabled.length
        return (
          <section key={col.key} className={cn('flex min-h-0 min-w-0 flex-col', i > 0 && 'border-l border-hair')} aria-label={col.title}>
            <header className="flex h-10 flex-none items-center gap-2 px-3">
              {col.onCheckAll !== undefined && col.checked !== undefined && (
                <button
                  type="button"
                  className={cn(
                    'grid size-3.5 flex-none cursor-pointer place-items-center rounded-[3px] border bg-transparent p-0',
                    allOn
                      ? 'border-accent bg-accent-tint text-accent-text'
                      : ticked > 0
                        ? 'border-accent text-accent-text'
                        : 'border-ctl-edge text-transparent',
                  )}
                  title={allOn ? 'Untick all' : 'Tick all'}
                  aria-label={allOn ? 'Untick all' : 'Tick all'}
                  aria-pressed={allOn}
                  disabled={enabled.length === 0}
                  onClick={() => col.onCheckAll?.(!allOn)}
                >
                  {ticked > 0 && <Check className="size-3" />}
                </button>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{col.title}</span>
              {col.checked !== undefined && ticked > 0 && <span className="font-mono text-xs tabular-nums text-dim">{ticked} picked</span>}
              {col.action}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {col.content !== undefined ? (
                col.content
              ) : col.loading === true || total === 0 ? (
                <SplitSkeleton count={col.skeleton ?? 8} tick={col.checked !== undefined} />
              ) : (
                items.map((it) => {
                  const selected = col.selectedId !== undefined && col.selectedId === it.id
                  const on = col.checked?.has(it.id) === true
                  return (
                    <button
                      key={it.id}
                      type="button"
                      role={col.checked !== undefined ? 'checkbox' : col.onSelect !== undefined ? 'option' : undefined}
                      aria-checked={col.checked !== undefined ? on : undefined}
                      aria-selected={col.onSelect !== undefined && col.checked === undefined ? selected : undefined}
                      data-selected={selected ? '' : undefined}
                      disabled={it.disabled}
                      title={it.title_attr}
                      className={cn(ROW, on && 'text-text')}
                      onClick={() => {
                        col.onCheck?.(it.id)
                        col.onSelect?.(it.id)
                      }}
                    >
                      {col.checked !== undefined && (
                        <span
                          className={cn(
                            'grid size-3.5 flex-none place-items-center rounded-[3px] border',
                            on ? 'border-accent bg-accent-tint text-accent-text' : 'border-ctl-edge text-transparent',
                          )}
                          aria-hidden
                        >
                          <Check className="size-3" />
                        </span>
                      )}
                      {/* Readiness as the row's left-edge accent strip (§20.5) — never a dot (owner, 2026-09-06). */}
                      {it.dot !== undefined && <span className={cn('absolute top-1.5 bottom-1.5 left-0 w-0.75 rounded-full', DOT[it.dot])} aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{it.title}</span>
                      {it.meta !== undefined && <span className="flex-none truncate font-mono text-xs text-faint">{it.meta}</span>}
                      {it.count !== undefined && <span className="flex-none font-mono text-xs tabular-nums text-dim">{it.count}</span>}
                    </button>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
