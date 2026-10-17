import { Info } from 'lucide-react'

import { Tooltip } from './Tooltip'

/** The info glyph beside a form label. */
export function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        tabIndex={0}
        aria-label={`About ${label}`}
        className="grid size-5 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-dim hover:text-accent-text focus-visible:text-accent-text focus-visible:outline-none"
      >
        <Info className="size-4" aria-hidden />
      </button>
    </Tooltip>
  )
}
