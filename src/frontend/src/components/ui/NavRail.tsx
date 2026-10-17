import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* THE left-pane navigation grammar (family CategoryRail): a way back at the
 * top when the page is a drill-in (doc 06 §1a), the item's name, then
 * headed groups of rows. One row style everywhere. */
export const NAV_ROW =
  'flex h-8 w-full cursor-pointer items-center gap-2 border-0 border-l-2 border-l-transparent bg-transparent pr-2.5 pl-3 text-left ' +
  'font-sans text-[13px] text-muted transition-[background,border-color,color] duration-fade ease-linear hover:bg-hov hover:text-text ' +
  'focus-visible:outline-none data-selected:border-l-accent data-selected:bg-ctl data-selected:text-accent-text disabled:cursor-default disabled:opacity-40'

/** A group heading in the rail: Caption 12, sentence case — the old mono-caps label is banned (doc 03 type ramp). */
export const NAV_HEADING = 'px-3 pt-3 pb-1 text-xs leading-4 text-dim'

export function NavRail({
  back,
  title,
  subtitle,
  children,
  ariaLabel,
}: {
  back?: { label: string; onClick: () => void }
  title?: string
  subtitle?: string
  children: ReactNode
  ariaLabel: string
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5" aria-label={ariaLabel}>
      {back !== undefined && (
        <button type="button" className={cn(NAV_ROW, 'h-7 text-xs text-faint')} onClick={back.onClick}>
          <ArrowLeft className="size-3.5" aria-hidden />
          {back.label}
        </button>
      )}
      {title !== undefined && (
        <div className="px-3 pt-1 pb-2">
          <b className="block truncate text-sm font-semibold text-text" title={title}>
            {title}
          </b>
          {subtitle !== undefined && (
            <span className="block truncate font-mono text-xs text-dim" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>
      )}
      {children}
    </nav>
  )
}

export function NavGroup({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <>
      {heading !== undefined && <div className={NAV_HEADING}>{heading}</div>}
      {children}
    </>
  )
}

export function NavItem({
  selected,
  onClick,
  children,
  count,
  disabled,
  title,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  count?: number | string
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      className={NAV_ROW}
      data-selected={selected ? '' : undefined}
      aria-current={selected ? 'page' : undefined}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="font-mono text-xs tabular-nums text-dim">{count}</span>}
    </button>
  )
}
