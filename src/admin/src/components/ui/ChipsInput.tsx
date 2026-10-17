import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/* The token editor for extension lists (docs/02 §6.2): a recessed track
 * holding raised chips; Enter or comma commits the typed token, Backspace on
 * an empty field removes the last chip, paste splits on whitespace/commas.
 * Tokens normalize — lowercased, leading dots stripped, deduped — and a
 * malformed token is REFUSED with an inline message (aria-described), never
 * silently dropped. Escape clears the typed text and, in edit mode, hands
 * the key to the form's cancel; it never reaches the Settings closer. */
const TRACK = 'flex min-h-ctl-md w-full flex-wrap items-center gap-1 rounded-ctl border border-ctl-edge bg-surface p-1 focus-within:border-accent-edge'
const CHIP =
  'inline-flex items-center gap-0.5 rounded-[3px] border border-ctl-edge bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] px-1.5 py-0 ' +
  'font-mono text-[11px] text-text shadow-[var(--shadow-ctl)]'
const INPUT = 'min-w-16 flex-1 border-0 bg-transparent p-0.5 font-mono text-[11px] text-text outline-none'

const TOKEN_RE = /^[a-z0-9]{1,10}$/

export interface ChipsInputProps {
  value: string[]
  onChange: (tokens: string[]) => void
  placeholder?: string
  ariaLabel: string
  describedBy?: string
  onEscape?: () => void
  /** Accepted token shape (default: a file extension) and the refusal wording. */
  pattern?: RegExp
  invalidText?: string
}

export function ChipsInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  describedBy,
  onEscape,
  pattern = TOKEN_RE,
  invalidText = 'letters and digits only, up to 10',
}: ChipsInputProps) {
  const [typed, setTyped] = useState('')
  const [rejected, setRejected] = useState<string[]>([])
  const rejectId = `${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-rejected`

  const commit = (raw: string): void => {
    const tokens = raw
      .split(/[\s,]+/)
      .map((t) => t.trim().toLowerCase().replace(/^\.+/, ''))
      .filter((t) => t !== '')
    const next = [...value]
    const bad: string[] = []
    for (const t of tokens) {
      if (!pattern.test(t)) bad.push(t)
      else if (!next.includes(t)) next.push(t)
    }
    if (next.length !== value.length) onChange(next)
    setRejected(bad)
    setTyped(bad.length > 0 ? bad.join(' ') : '')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(typed)
    } else if (e.key === 'Backspace' && typed === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (typed !== '' || rejected.length > 0) {
        setTyped('')
        setRejected([])
      } else onEscape?.()
    }
  }

  return (
    <div>
      <div className={TRACK}>
        {value.map((token) => (
          <span key={token} className={CHIP}>
            {token}
            <button
              type="button"
              aria-label={`Remove ${token}`}
              className="cursor-pointer border-0 bg-transparent p-0 text-faint hover:text-text"
              onClick={() => onChange(value.filter((t) => t !== token))}
            >
              <X className="size-2.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          aria-label={ariaLabel}
          aria-invalid={rejected.length > 0}
          aria-describedby={[rejected.length > 0 ? rejectId : null, describedBy ?? null].filter(Boolean).join(' ') || undefined}
          className={cn(INPUT, value.length === 0 && 'w-full')}
          value={typed}
          placeholder={value.length === 0 ? placeholder : ''}
          onChange={(e) => {
            setTyped(e.target.value)
            if (rejected.length > 0) setRejected([])
          }}
          onKeyDown={onKeyDown}
          onBlur={() => typed.trim() !== '' && commit(typed)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            if (/[\s,]/.test(pasted)) {
              e.preventDefault()
              commit(typed + ' ' + pasted)
            }
          }}
        />
      </div>
      {rejected.length > 0 && (
        <p id={rejectId} className="mt-1 mb-0 font-mono text-[10px] text-st-failed">
          not accepted: {rejected.join(', ')} — {invalidText}
        </p>
      )}
    </div>
  )
}
