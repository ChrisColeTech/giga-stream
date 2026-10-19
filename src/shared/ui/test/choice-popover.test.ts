import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Clapperboard } from 'lucide-react'

import { ChoicePopover } from '../src/menus/ChoicePopover'
import { FIELD_BASE } from '../src/controls/field-class'
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

test('field and toolbar triggers share field skin with summary-only text and accessible labels', () => {
  const field = renderToStaticMarkup(createElement(ChoicePopover<Kind>, {
    mode: 'single', label: 'Media', trigger: 'field', value: 'movie', options: OPTIONS, onChange: NOTHING,
  }))
  const toolbar = renderToStaticMarkup(createElement(ChoicePopover<Kind>, {
    mode: 'multi', label: 'Media', trigger: 'toolbar', values: COMPLETE, options: OPTIONS, onChange: NOTHING,
    all: { label: 'All', values: COMPLETE },
  }))
  assert.ok(field.includes(FIELD_BASE) && toolbar.includes(FIELD_BASE))
  assert.ok(field.includes('<span class="min-w-0 truncate">Movies</span>'))
  assert.ok(toolbar.includes('<span class="min-w-0 truncate">All</span>'))
  assert.ok(field.includes('aria-label="Media: Movies"') && toolbar.includes('aria-label="Media: All"'))
  assert.ok(!field.includes('>Media: Movies<') && !toolbar.includes('>Media: All<'))
  assert.ok(field.includes('w-full') && !field.includes('min-w-32'))
  assert.ok(toolbar.includes('w-auto! min-w-32'))
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
  assert.match(source, /w-\[var\(--radix-dropdown-menu-trigger-width\)\]/)
  assert.doesNotMatch(source, /max\(var\(--radix-dropdown-menu-trigger-width\)|min-w-\[190px\]/)
  assert.doesNotMatch(source, /linear-gradient|shadow-ctl|shadow-stroke-hi/)
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
