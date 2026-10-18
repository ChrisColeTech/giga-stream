import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Check, Play } from 'lucide-react'

import { Group } from '../src/form/Group'
import { TableStrip, type StripVerb, type TableStripProps } from '../src/lists/TableStrip'

const NOTHING = (): void => undefined
const VERBS: readonly StripVerb[] = [
  { id: 'enable', label: 'Enable', icon: Check, onPress: NOTHING },
  { id: 'rebuild', label: 'Rebuild', onPress: NOTHING },
  { id: 'run', label: 'Run job', icon: Play, onPress: NOTHING, reason: 'Already running.' },
  { id: 'delete', label: 'Delete', icon: Check, onPress: NOTHING, question: 'Delete 2 accounts?' },
]
const BASE: TableStripProps = { label: 'Accounts table', noun: 'accounts', refresh: { onPress: NOTHING } }

const strip = (props: Partial<TableStripProps> = {}): string =>
  renderToStaticMarkup(createElement(TableStrip, { ...BASE, ...props }))
const withVerbs = (verbs: readonly StripVerb[] = VERBS) => ({ selection: { verbs } })
const buttons = (html: string): string[] => html.match(/<button[^>]*>.*?<\/button>/g) ?? []
const text = (button: string): string => button.replace(/<[^>]+>/g, '')

test('Refresh is the first control: a ghost word with its icon, the tooltip naming the list', () => {
  const [first] = buttons(strip(withVerbs()))
  assert.ok(first?.includes('title="Refresh accounts"') && first.includes('lucide-refresh-cw'))
  assert.equal(text(first ?? ''), 'Refresh')
})

test('the selection verbs are ghost words, the icon first where the family has one and none where it has not', () => {
  const all = buttons(strip(withVerbs()))
  const enable = all.find((button) => text(button) === 'Enable') ?? ''
  assert.ok(enable.includes('lucide-check') && enable.includes('bg-transparent'))
  const rebuild = all.find((button) => text(button) === 'Rebuild') ?? ''
  assert.ok(rebuild !== '' && !rebuild.includes('<svg'))
})

test('a verb with a reason stays in place, natively disabled in the focusable tooltip', () => {
  const html = strip(withVerbs())
  assert.ok(html.includes('aria-label="Run job. Already running."') && !html.includes('aria-disabled'))
})

test('Delete is the armed two-step: the word alone at rest, no icon, the question only once armed', () => {
  const html = strip(withVerbs())
  const del = buttons(html).find((button) => text(button) === 'Delete') ?? ''
  assert.ok(del !== '' && !del.includes('<svg') && !html.includes('Delete 2 accounts?') && !del.includes('text-st-failed'))
  const blocked = strip(withVerbs([{ ...VERBS[3]!, reason: 'Tick an account first' }]))
  assert.ok(blocked.includes('aria-label="Delete. Tick an account first"') && blocked.includes('disabled=""'))
})

test('the strip holds no All checkbox: it is the grid header tick, and no Clear selection or count text stands here', () => {
  const html = strip(withVerbs())
  assert.ok(!html.includes('role="checkbox"') && !html.includes('Select all'))
  assert.ok(!html.includes('Clear selection') && !html.includes('selected'))
})

test('a long list offers Select all M matching as its own step, a ghost word just right of the verbs, only when given', () => {
  const matching = { label: 'Select all 5,003 matching', onPress: NOTHING }
  const html = strip({ selection: { verbs: VERBS, matching } })
  const offer = buttons(html).find((button) => text(button) === matching.label) ?? ''
  assert.ok(offer.includes('bg-transparent') && !offer.includes('<svg'))
  assert.ok(html.indexOf(matching.label) > html.indexOf('>Delete<'))
  assert.ok(!strip(withVerbs()).includes('matching'))
})

test('paging is the icon pair, the last controls: no forward verb in a list row', () => {
  const html = strip({ ...withVerbs(), paging: { newer: { onPress: NOTHING, reason: 'This is the first page.' }, older: { onPress: NOTHING } } })
  assert.ok(html.includes('aria-label="Newer. This is the first page."') && html.includes('aria-label="Older"'))
  assert.ok((buttons(html).at(-1) ?? '').includes('aria-label="Older"') && !html.includes('→'))
})

test('the strip is one row: no paragraph, no filled or edged button', () => {
  const html = strip(withVerbs())
  assert.ok(!/<p[\s>]/.test(html) && !html.includes('hover:border-accent-strong') && !html.includes('--color-ctl-hi'))
  assert.ok(html.includes('role="toolbar"') && html.includes('aria-label="Accounts table"'))
})

test('a group heading carries the tile, the title and the fold, and no verb', () => {
  const html = renderToStaticMarkup(createElement(Group, { title: 'Accounts', children: createElement('span', null, 'rows') }))
  const heading = html.slice(0, html.indexOf('rows'))
  assert.ok(heading.includes('<h2'))
  const names = buttons(heading).map((button) => button.match(/aria-label="([^"]*)"/)?.[1] ?? '')
  assert.ok(names.every((name) => name === '' || /^(Collapse|Expand) /.test(name)), names.join())
  assert.equal(names.length, 2, 'the title fold and the chevron fold, nothing else')
})

test('list verbs sit right after Refresh, before the hairline and the selection verbs, each with its reason', () => {
  const sync: StripVerb = { id: 'sync-now', label: 'Sync now', onPress: NOTHING, reason: 'A sync is already running.' }
  const names = buttons(strip({ ...withVerbs(), listVerbs: [sync] })).map(text)
  assert.deepEqual(names.slice(0, 3), ['Refresh', 'Sync now', 'Enable'])
  assert.ok(strip({ listVerbs: [sync] }).includes('A sync is already running.'))
  assert.deepEqual(buttons(strip(withVerbs())).map(text).slice(0, 2), ['Refresh', 'Enable'], 'absent: unchanged')
})
