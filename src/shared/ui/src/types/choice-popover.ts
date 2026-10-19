import type { LucideIcon } from 'lucide-react'

export interface ChoicePopoverOption<T extends string> {
  readonly value: T
  readonly label: string
  readonly icon?: LucideIcon
}

export interface ChoicePopoverAll<T extends string> {
  readonly label: string
  readonly values: readonly T[]
}

interface ChoicePopoverCommon<T extends string> {
  readonly label: string
  readonly options: readonly ChoicePopoverOption<T>[]
  readonly trigger: 'field' | 'toolbar'
  readonly summary?: string
  readonly disabledReason?: string
  readonly searchThreshold?: number
}

export interface ChoicePopoverSingleProps<T extends string> extends ChoicePopoverCommon<T> {
  readonly mode: 'single'
  readonly value: T
  readonly onChange: (value: T) => void
}

export interface ChoicePopoverMultiProps<T extends string> extends ChoicePopoverCommon<T> {
  readonly mode: 'multi'
  readonly values: readonly T[]
  readonly onChange: (values: readonly T[]) => void
  readonly all?: ChoicePopoverAll<T>
}

export type ChoicePopoverProps<T extends string> = ChoicePopoverSingleProps<T> | ChoicePopoverMultiProps<T>
