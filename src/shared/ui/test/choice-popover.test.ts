import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Clapperboard } from 'lucide-react'

import { ChoicePopover } from '../src/menus/ChoicePopover'
import {
  CHOICE_SEARCH_THRESHOLD,
  choicePopoverSearches,
  filterChoiceOptions,
  isCompleteChoiceSet,
  nextChoiceValues,
} from '../src/lib/choice-popover-state'

type Kind = 'movie' | 'tv' | 'local'
const NOTHING = (): void => undefined
const OPTIONS = [
  { value: 'movie' as const, label: 'Movies' },
  { value: 'tv' as const, label: 'TV' },
  { value: 'local' as const, label: 'Local', icon: Clapperboard },
]
const COMPLETE: readonly Kind[] = ['movie', 'tv', 'local']
const source = readFileSync('src/menus/ChoicePopover.tsx', 'utf8')

test('single and multi props render current summaries on visibly skinned field and toolbar triggers', () => {
  const field = renderToStaticMarkup(createElement(ChoicePopover<Kind>, {
    mode: 'single', label: 'Media', trigger: 'field', value: 'movie', options: OPTIONS, onChange: NOTHING,
  }))
  const toolbar = renderToStaticMarkup(createElement(ChoicePopover<Kind>, {
    mode: 'multi', label: 'Media', trigger: 'toolbar', values: COMPLETE, options: OPTIONS, onChange: NOTHING,
    all: { label: 'All', values: COMPLETE },
  }))
  assert.ok(field.includes('w-full') && field.includes('bg-surface') && field.includes('Media: Movies'))
  assert.ok(
    toolbar.includes('border-ctl-edge') && toolbar.includes('var(--color-ctl-hi)') && toolbar.includes('Media: All'),
  )
  assert.ok(field.includes('aria-haspopup="menu"') && field.includes('aria-expanded="false"'))
  assert.ok(field.includes('lucide-chevron-down') && toolbar.includes('lucide-chevron-down'))
})

test('all is the canonical complete set and specific toggles never store an all sentinel', () => {
  assert.equal(isCompleteChoiceSet(COMPLETE, COMPLETE), true)
  assert.deepEqual(nextChoiceValues(COMPLETE, 'movie', COMPLETE, COMPLETE), ['movie'])
  assert.deepEqual(nextChoiceValues(['movie'], 'tv', COMPLETE, COMPLETE), ['movie', 'tv'])
  assert.deepEqual(nextChoiceValues(['movie', 'tv'], 'local', COMPLETE, COMPLETE), COMPLETE)
  assert.deepEqual(nextChoiceValues(['movie'], 'movie', COMPLETE, COMPLETE), COMPLETE)
})

test('search starts exactly at the default threshold and filters labels case-insensitively', () => {
  assert.equal(CHOICE_SEARCH_THRESHOLD, 12)
  assert.equal(choicePopoverSearches(11), false)
  assert.equal(choicePopoverSearches(12), true)
  assert.deepEqual(filterChoiceOptions(OPTIONS, ' MOV'), [OPTIONS[0]])
})

test('rows use Radix radio/check markup, shared row skin, icons, and close/stay-open contracts', () => {
  assert.match(source, /Menu\.RadioItem/)
  assert.match(source, /Menu\.CheckboxItem/)
  assert.match(source, /Menu\.ItemIndicator/)
  assert.match(source, /className=\{MENU_ROW\}/)
  assert.match(source, /rowIcon\(option\)/)
  assert.match(source, /onSelect=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.match(source, /RadioItem[^>]+onSelect=\{\(\) => props\.onChange/s)
})

test('popup width, collision, search focus, row focus, Escape, Tab and no-trap contracts are centralized', () => {
  assert.match(source, /--radix-dropdown-menu-trigger-width/)
  assert.match(source, /max\(var\(--radix-dropdown-menu-trigger-width\),190px\)/)
  assert.match(source, /sideOffset=\{4\}/)
  assert.match(source, /collisionPadding=\{8\}/)
  assert.match(source, /modal=\{false\}/)
  assert.match(source, /useLayoutEffect/)
  assert.match(source, /searchRef\.current\?\.focus/)
  assert.match(source, /selectedRef/)
  assert.match(source, /'ArrowDown'.*'Home'.*'ArrowUp'.*'End'/s)
  assert.match(source, /event\.key !== 'Escape' && event\.key !== 'Tab'/)
  assert.match(source, /tabTarget\.current = adjacentTabStop\(event\.shiftKey\)/)
  assert.match(source, /onCloseAutoFocus/)
  assert.match(source, /if \(!next\) setText\(''\)/)
})

test('a disabled choice keeps its reason in the focusable shared Tooltip pattern', () => {
  const html = renderToStaticMarkup(createElement(ChoicePopover<Kind>, {
    mode: 'single', label: 'Media', trigger: 'field', value: 'movie', options: OPTIONS, onChange: NOTHING,
    disabledReason: 'Library is loading.',
  }))
  assert.ok(html.includes('role="group"') && html.includes('tabindex="0"'))
  assert.ok(html.includes('aria-label="Media. Library is loading."') && html.includes('disabled=""'))
})
