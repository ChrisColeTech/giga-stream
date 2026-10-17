import { cn } from '@giga/ui/lib/cn'

/* The brand mark as inline SVG — the same drawing as resources/icon.svg
 * (tile + down-arrow-to-line), but painted from theme tokens: the tile is
 * the accent, the glyph the accent ink, so it follows every accent family
 * and the light theme like the rest of the chrome. */
export interface AppIconProps {
  className?: string
  title?: string
}

export function AppIcon({ className, title }: AppIconProps) {
  return (
    <svg viewBox="0 0 512 512" className={cn('block', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title && <title>{title}</title>}
      <rect x="24" y="24" width="464" height="464" rx="108" className="fill-accent" />
      <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#app-icon-gloss)" />
      <defs>
        <linearGradient id="app-icon-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="0.45" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" className="stroke-accent-ink" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
        <path d="M256 118v206" />
        <path d="M166 236l90 90 90-90" />
        <path d="M152 394h208" />
      </g>
    </svg>
  )
}
