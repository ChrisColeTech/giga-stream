import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Play, Power } from 'lucide-react'

import { Group } from '../src/form/Group'
import { TableStrip, type StripVerb, type TableStripProps } from '../src/lists/TableStrip'

const NOTHING = (): void => undefined
const VERBS: readonly StripVerb[] = [
  { id: 'enable', label: 'Enable', icon: Power, onPress: NOTHING },
  { id: 'run', label: 'Run', icon: Play, onPress: NOTHING, reason: 'Already running.' },
  { id: 'delete', label: 'Delete', icon: Power, onPress: NOTHING, question: 'Delete 2 accounts?' },
]
const BASE: TableStripProps = { label: 'Accounts table', noun: 'accounts', refresh: { onPress: NOTHING } }

const strip = (props: Partial<TableStripProps> = {}): string =>
  renderToStaticMarkup(createElement(TableStrip, { ...BASE, ...props }))
const withRows = (count: number) => ({ selection: { count, verbs: VERBS, onClear: NOTHING } })
const buttons = (html: string): string[] => html.match(/<button[^>]*>.*?<\/button>/g) ?? []

test('forward verbs are icon buttons before Refresh, each with its tooltip and its reason', () => {
  const forward: readonly StripVerb[] = [{ id: 'go', label: 'Go to Titles', icon: Play, onPress: NOTHING, reason: 'Tick a row first' }]
  const html = strip({ forward })
  assert.equal(buttons(html).length, 2)
  assert.ok(html.includes('aria-label="Go to Titles. Tick a row first"'))
  assert.ok(html.indexOf('Go to Titles') < html.indexOf('Refresh accounts'))
})

test('with nothing ticked the strip is the Refresh icon alone, labelled and with a tooltip', () => {
  const html = strip(withRows(0))
  assert.ok(html.includes('role="toolbar"') && html.includes('aria-label="Accounts table"'))
  const all = buttons(html)
  assert.equal(all.length, 1)
  assert.ok(all[0]?.includes('aria-label="Refresh accounts"') && all[0].includes('title="Refresh accounts"'))
  assert.ok(!html.includes('selected'))
})

test('ticked rows add the count in the strip heading style: mono 12 faint, the count dim', () => {
  const html = strip(withRows(3))
  assert.ok(html.includes('font-mono text-xs text-faint'))
  assert.ok(html.includes('<span class="text-dim tabular-nums">3</span> selected'))
})

test('the bulk verbs are icon buttons with an aria-label and a tooltip, and Clear selection is an icon', () => {
  const all = buttons(strip(withRows(2)))
  const labelled = all.filter((button) => button.includes('size-ctl-md'))
  for (const button of labelled) assert.ok(button.includes('aria-label="') && !/>[^<]+<\/button>/.test(button), button)
  assert.ok(all.some((button) => button.includes('aria-label="Enable"') && button.includes('title="Enable"')))
  assert.ok(all.some((button) => button.includes('aria-label="Clear selection"') && button.includes('title="Clear selection"')))
})

test('a verb with a reason is natively disabled in the focusable tooltip, never aria-disabled', () => {
  const html = strip(withRows(2))
  assert.ok(html.includes('aria-label="Run. Already running."'))
  assert.ok(!html.includes('aria-disabled'))
})

test('Delete is the armed two-step: a ghost naming the verb at rest, the question only once armed', () => {
  const html = strip(withRows(2))
  assert.ok(html.includes('>Delete</button>') && !html.includes('Delete 2 accounts?'))
  assert.ok(html.includes('bg-transparent') && !html.includes('text-st-failed'))
  const blocked = strip({ selection: { count: 2, verbs: [{ ...VERBS[2]!, reason: 'Tick an account first' }], onClear: NOTHING } })
  assert.ok(blocked.includes('aria-label="Delete. Tick an account first"') && blocked.includes('disabled=""'))
})

test('a list that pages draws the Newer and Older icon pair, each disabled with its reason at the end', () => {
  const html = strip({ paging: { newer: { onPress: NOTHING, reason: 'This is the first page.' }, older: { onPress: NOTHING } } })
  assert.ok(html.includes('aria-label="Newer. This is the first page."'))
  assert.ok(html.includes('aria-label="Older"') && html.includes('title="Older"'))
  assert.ok(html.indexOf('Newer') < html.indexOf('Older') && html.indexOf('Older') < html.indexOf('Refresh accounts'))
})

test('the strip carries no paragraph and no filled or edged button', () => {
  const html = strip({ ...withRows(2), paging: { newer: { onPress: NOTHING }, older: { onPress: NOTHING } } })
  assert.ok(!html.includes('<p>') && !html.includes('<p ') && !html.includes('text-accent-ink') && !html.includes('border-ctl-edge'))
})

test('a group heading carries the tile, the title and the fold, and no verb', () => {
  const html = renderToStaticMarkup(createElement(Group, { title: 'Accounts', children: createElement('span', null, 'rows') }))
  const heading = html.slice(0, html.indexOf('rows'))
  assert.ok(heading.includes('<h2'))
  const names = buttons(heading).map((button) => button.match(/aria-label="([^"]*)"/)?.[1] ?? '')
  assert.ok(names.every((name) => name === '' || /^(Collapse|Expand) /.test(name)), names.join())
  assert.equal(names.length, 2, 'the title fold and the chevron fold, nothing else')
})
