import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'

import { FIELD_BASE } from '../controls/field-class'
import { Tooltip } from '../form/Tooltip'
import {
  choicePopoverSearches,
  CHOICE_TAB_STOPS,
  filterChoiceOptions,
  isCompleteChoiceSet,
  nextChoiceValues,
} from '../lib/choice-popover-state'
import { cn } from '../lib/cn'
import type { ChoicePopoverOption, ChoicePopoverProps } from '../types/choice-popover'
import { MENU_PANEL, MENU_ROW } from './ContextMenuRow'

const TOOLBAR_TRIGGER =
  'h-ctl-md rounded-ctl border border-ctl-edge px-2.5 text-[13px] font-[550] text-text ' +
  'bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)]'
const TRIGGER_CORE =
  'flex cursor-pointer items-center justify-between gap-2 whitespace-nowrap text-left outline-none ' +
  'data-[state=open]:border-accent data-[state=open]:shadow-[0_0_0_2px_var(--color-accent-tint)]'
const PANEL_WIDTH = 'w-[max(var(--radix-dropdown-menu-trigger-width),190px)]'

function currentSummary<T extends string>(props: ChoicePopoverProps<T>): string {
  if (props.summary !== undefined) return props.summary
  if (props.mode === 'single') return props.options.find((option) => option.value === props.value)?.label ?? props.value
  if (props.all !== undefined && isCompleteChoiceSet(props.values, props.all.values)) return props.all.label
  const selected = props.options.filter((option) => props.values.includes(option.value)).map((option) => option.label)
  return selected.join(', ')
}

function rowIcon<T extends string>(option: ChoicePopoverOption<T>) {
  const Icon = option.icon
  return Icon === undefined ? null : <Icon aria-hidden />
}

export function ChoicePopover<T extends string>(props: ChoicePopoverProps<T>) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const search = choicePopoverSearches(props.options.length, props.searchThreshold)
  const shown = filterChoiceOptions(props.options, text)
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)
  const tabTarget = useRef<HTMLElement>(null)
  const summary = currentSummary(props)
  const focusRows = (end = false): void => {
    if (end) lastRef.current?.focus()
    else (selectedRef.current ?? firstRef.current)?.focus()
  }
  useLayoutEffect(() => {
    if (!open) return
    if (search) searchRef.current?.focus()
    else focusRows()
  }, [open, search])
  const adjacentTabStop = (backward: boolean): HTMLElement | null => {
    const stops = [...document.querySelectorAll<HTMLElement>(CHOICE_TAB_STOPS)]
    const at = triggerRef.current === null ? -1 : stops.indexOf(triggerRef.current)
    return stops[at + (backward ? -1 : 1)] ?? null
  }
  const searchKeys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'Home') {
      event.preventDefault()
      focusRows()
    } else if (event.key === 'ArrowUp' || event.key === 'End') {
      event.preventDefault()
      focusRows(true)
    } else if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation()
  }
  const itemRef = (option: ChoicePopoverOption<T>, index: number): Ref<HTMLDivElement> => (node) => {
    if (index === 0 && (props.mode === 'single' || props.all === undefined)) firstRef.current = node
    if (index === shown.length - 1) lastRef.current = node
    const allSelected = props.mode === 'multi' && props.all !== undefined
      && isCompleteChoiceSet(props.values, props.all.values)
    const selected = props.mode === 'single'
      ? props.value === option.value
      : !allSelected && props.values.includes(option.value)
    if (selected) selectedRef.current = node
  }
  const trigger = (
    <Menu.Trigger
      ref={triggerRef}
      disabled={props.disabledReason !== undefined}
      aria-label={`${props.label}: ${summary}`}
      className={cn(
        TRIGGER_CORE,
        props.trigger === 'field' ? FIELD_BASE : TOOLBAR_TRIGGER,
        props.trigger === 'field' && 'h-ctl-md w-full',
      )}
    >
      <span className="min-w-0 truncate">{props.label}: {summary}</span>
      <ChevronDown className="size-3.5 flex-none text-faint" aria-hidden />
    </Menu.Trigger>
  )
  return (
    <Menu.Root open={open} modal={false} onOpenChange={(next) => { setOpen(next); if (!next) setText('') }}>
      {props.disabledReason === undefined ? trigger : (
        <Tooltip
          text={props.disabledReason}
          focusable
          label={`${props.label}. ${props.disabledReason}`}
          className={props.trigger === 'field' ? 'w-full' : undefined}
        >
          {trigger}
        </Tooltip>
      )}
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className={cn(MENU_PANEL, PANEL_WIDTH, 'max-h-72 overflow-hidden')}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return
            event.preventDefault()
            tabTarget.current = adjacentTabStop(event.shiftKey)
            setOpen(false)
          }}
          onCloseAutoFocus={(event) => {
            if (tabTarget.current === null) return
            event.preventDefault()
            tabTarget.current.focus()
            tabTarget.current = null
          }}
        >
          {search && (
            <div className="relative m-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                aria-label={`Search ${props.label.toLocaleLowerCase()}`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={searchKeys}
                className={cn(FIELD_BASE, 'h-ctl-md pl-7')}
              />
            </div>
          )}
          <Menu.Group aria-label={props.label} className="max-h-60 overflow-y-auto">
            {props.mode === 'single' ? (
              <Menu.RadioGroup value={props.value} onValueChange={() => undefined}>
                {shown.map((option, index) => (
                  <Menu.RadioItem key={option.value} ref={itemRef(option, index)} value={option.value}
                    className={MENU_ROW} onSelect={() => props.onChange(option.value)}>
                    <span className="grid size-3.5 place-items-center">
                      <Menu.ItemIndicator><Check aria-hidden /></Menu.ItemIndicator>
                    </span>
                    {rowIcon(option)}<span>{option.label}</span>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            ) : (<>
              {props.all !== undefined && (
                <Menu.CheckboxItem
                  ref={(node) => {
                    firstRef.current = node
                    if (isCompleteChoiceSet(props.values, props.all?.values ?? [])) selectedRef.current = node
                  }}
                  checked={isCompleteChoiceSet(props.values, props.all.values)}
                  className={MENU_ROW}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => props.onChange(props.all?.values ?? [])}
                >
                  <span className="grid size-3.5 place-items-center">
                    <Menu.ItemIndicator><Check aria-hidden /></Menu.ItemIndicator>
                  </span>
                  <span>{props.all.label}</span>
                </Menu.CheckboxItem>
              )}
              {shown.map((option, index) => (
                <Menu.CheckboxItem
                  key={option.value}
                  ref={itemRef(option, index)}
                  checked={props.values.includes(option.value)}
                  className={MENU_ROW} onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => props.onChange(nextChoiceValues(props.values, option.value,
                    props.options.map((item) => item.value), props.all?.values))}
                >
                  <span className="grid size-3.5 place-items-center">
                    <Menu.ItemIndicator><Check aria-hidden /></Menu.ItemIndicator>
                  </span>
                  {rowIcon(option)}<span>{option.label}</span>
                </Menu.CheckboxItem>
              ))}
            </>)}
          </Menu.Group>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
