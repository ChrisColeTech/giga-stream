import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { TabPill } from '../src/shell/TabPill'

type Surface = 'live' | 'library' | 'player'

const ITEMS = [
  { id: 'live' as const, label: 'Live' },
  { id: 'library' as const, label: 'Library' },
  { id: 'player' as const, label: 'Player' },
]

const count = (html: string, needle: string) => html.split(needle).length - 1

const render = (extra: { active?: Surface; disabled?: boolean; disabledReason?: string } = {}): string =>
  renderToStaticMarkup(
    createElement(TabPill<Surface>, { label: 'Surfaces', items: ITEMS, active: 'library', onSelect: () => undefined, ...extra }),
  )

test('the nav is a labelled equal-width grid of raised-chip tabs, one per item, in order', () => {
  const html = render()
  assert.ok(html.startsWith('<nav'), 'a nav element')
  assert.ok(html.includes('aria-label="Surfaces"'))
  assert.ok(html.includes('auto-cols-fr grid-flow-col'), 'every tab is the width of the longest')
  assert.equal(count(html, '<button'), 3)
  assert.ok(html.indexOf('>Live<') < html.indexOf('>Library<') && html.indexOf('>Library<') < html.indexOf('>Player<'))
})

test('only the active tab carries data-active', () => {
  const html = render({ active: 'player' })
  assert.equal(count(html, 'data-active=""'), 1)
  assert.ok(html.indexOf('data-active=""') > html.indexOf('>Library<'), 'the one marked tab is Player')
})

test('asleep, the tabs are all disabled, none is marked active, and the reason hangs on the track', () => {
  const html = render({ disabled: true, disabledReason: 'Close the open window to switch surfaces.' })
  assert.equal(count(html, 'disabled=""'), 3)
  assert.equal(count(html, 'data-active=""'), 0)
  assert.ok(html.includes('title="Close the open window to switch surfaces."'))
})

test('awake, the track carries no reason and no tab is disabled', () => {
  const html = render({ disabledReason: 'Close the open window to switch surfaces.' })
  assert.equal(count(html, 'disabled=""'), 0)
  assert.equal(count(html, 'title='), 0)
})
