import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Titlebar, type TitlebarProps } from '../src/shell/Titlebar'

type Surface = 'live' | 'library'

const count = (html: string, needle: string) => html.split(needle).length - 1
const buttonFor = (html: string, label: string): string => html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? ''

const ITEMS = [
  { id: 'live' as const, label: 'Live' },
  { id: 'library' as const, label: 'Library' },
]

const BOTTOM_REASON = 'Live has no bottom pane.'
const SLEEPING_TABS = 'Close the open window to switch surfaces.'

function bar(overrides: Partial<TitlebarProps<Surface>> = {}): string {
  const props: TitlebarProps<Surface> = {
    brand: createElement('span', null, 'BRAND'),
    tabs: { label: 'Surfaces', items: ITEMS, active: 'live', onSelect: () => undefined },
    left: { side: 'left', lit: true, onToggle: () => undefined },
    bottom: { side: 'bottom', lit: false, reason: BOTTOM_REASON, onToggle: () => undefined },
    right: { side: 'right', lit: false, onToggle: () => undefined },
    ...overrides,
  }
  return renderToStaticMarkup(createElement(Titlebar<Surface>, props))
}

test('the bar draws the left toggle, the brand, the nav and the bottom and right toggles, in that order', () => {
  const html = bar()
  assert.ok(html.indexOf('Toggle left pane') < html.indexOf('BRAND'))
  assert.ok(html.indexOf('BRAND') < html.indexOf('aria-label="Surfaces"'))
  assert.ok(html.indexOf('aria-label="Surfaces"') < html.indexOf('Toggle bottom pane'))
  assert.ok(html.indexOf('Toggle bottom pane') < html.indexOf('Toggle right pane'))
})

test('a toggle with no pane is disabled, and its reason hangs on the wrapper and on the button', () => {
  const html = bar()
  assert.ok(html.includes(`<span class="inline-flex" title="${BOTTOM_REASON}">`), 'the wrapper carries the reason')
  const button = buttonFor(html, 'Toggle bottom pane')
  assert.ok(button.includes('disabled=""'), 'the button is disabled')
  assert.ok(button.includes(`title="${BOTTOM_REASON}"`), 'the button says why too')
})

test('a working toggle is enabled, labelled, and shows its pressed state while its pane is shown', () => {
  const left = buttonFor(bar(), 'Toggle left pane')
  assert.ok(!left.includes('disabled=""'))
  assert.ok(left.includes('aria-pressed="true"'))
  assert.ok(left.includes('data-on=""'))
  assert.ok(left.includes('title="Toggle left pane"'))
})

test('every titlebar button is ghost: transparent at rest, the nav tabs are not buttons with an edge', () => {
  const html = bar()
  const toggles = (html.match(/<button[^>]*>/g) ?? []).filter((button) => button.includes('aria-label="Toggle '))
  assert.equal(toggles.length, 3)
  for (const button of toggles) assert.ok(button.includes('border-transparent bg-transparent'), button.slice(0, 80))
})

test('the bar takes its tone, the normal tone by default, and the app verb sits after the nav and before the bottom toggle', () => {
  const html = bar({ tone: 'border-black bg-black', trailing: createElement('button', { 'aria-label': 'Verb' }, 'Verb') })
  assert.ok(html.includes('border-black bg-black'))
  assert.ok(html.indexOf('aria-label="Surfaces"') < html.indexOf('aria-label="Verb"'))
  assert.ok(html.indexOf('aria-label="Verb"') < html.indexOf('Toggle bottom pane'))
  assert.ok(bar().includes('border-border bg-panel'))
})

test('asleep under an open window, the nav tabs are disabled and the reason hangs on the track', () => {
  const html = bar({
    tabs: { label: 'Surfaces', items: ITEMS, active: 'live', disabled: true, disabledReason: SLEEPING_TABS, onSelect: () => undefined },
  })
  assert.ok(html.includes(`title="${SLEEPING_TABS}"`), 'the track carries the reason')
  assert.equal(count(html, '>Live</button>'), 1)
  assert.equal(count(html, '>Library</button>'), 1)
  assert.equal(count(html, 'disabled=""'), 3, 'both tabs, and the bottom toggle that has no pane')
})
