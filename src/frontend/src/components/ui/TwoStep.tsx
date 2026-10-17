import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TWO_STEP_MS } from '@/constants/surfaces'
import { Button, type ButtonSize, type ButtonVariant } from './Button'

/* DESTRUCTIVE = INLINE TWO-STEP (03 §4.3). The button becomes the question
 * (`Delete tesst?`) and re-arms after ~4s. No modal confirms: a confirm on
 * every action trains people to click through the one that mattered. */
export function TwoStep({
  children,
  question,
  onConfirm,
  disabled = false,
  title,
  variant = 'ghost',
  size = 'md',
  full = false,
  onArm,
}: {
  children: ReactNode
  /** The question the button turns into — names what dies. */
  question: string
  onConfirm: () => void
  disabled?: boolean
  title?: string
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  /** Told when the button arms, so a status label can say what a second press does. */
  onArm?: (armed: boolean) => void
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  const disarm = (): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setArmed(false)
    onArm?.(false)
  }

  const press = (): void => {
    if (armed) {
      disarm()
      onConfirm()
      return
    }
    setArmed(true)
    onArm?.(true)
    timer.current = setTimeout(disarm, TWO_STEP_MS)
  }

  return (
    <Button
      variant={armed ? 'danger' : variant}
      size={size}
      full={full}
      disabled={disabled}
      title={armed ? 'Press again to confirm' : title}
      className={armed ? 'border-st-failed' : undefined}
      onClick={press}
    >
      {armed ? question : children}
    </Button>
  )
}
