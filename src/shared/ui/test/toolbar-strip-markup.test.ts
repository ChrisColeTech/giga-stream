import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ToolbarStrip, type ToolbarVerb } from '../src/shell/ToolbarStrip'

const VERBS: readonly ToolbarVerb[] = [
  { id: 'discard', label: 'Discard changes', tone: 'ghost', onPress: () => undefined, reason: 'Nothing has changed.' },
  { id: 'save', label: 'Save', tone: 'edged', onPress: () => undefined, reason: 'Nothing has changed.' },
  { id: 'go', label: 'Titles →', tone: 'filled', onPress: () => undefined },
]

const strip = (verbs: readonly ToolbarVerb[]): string => renderToStaticMarkup(createElement(ToolbarStrip, { label: 'Toolbar', verbs }))
const buttons = (html: string): string[] => html.match(/<button[^>]*>[^<]*/g) ?? []

test('the strip is a 40px toolbar on the panel, verbs at its right edge', () => {
  const html = strip(VERBS)
  assert.ok(html.includes('role="toolbar"') && html.includes('aria-label="Toolbar"'))
  assert.ok(html.includes('h-10') && html.includes('justify-end') && html.includes('bg-panel'))
})

test('an empty strip is still drawn, so the page below keeps its place', () => {
  const html = strip([])
  assert.ok(html.includes('role="toolbar"') && html.includes('h-10'))
  assert.equal(buttons(html).length, 0)
})

test('verbs keep their order, and Discard is ghost, Save the stock edged button and the forward verb filled', () => {
  const [discard, save, go] = buttons(strip(VERBS))
  assert.ok(discard !== undefined && save !== undefined && go !== undefined)
  assert.ok(discard.includes('bg-transparent') && discard.includes('Discard changes'))
  assert.ok(save.includes('border-ctl-edge') && !save.includes('bg-transparent'))
  assert.ok(go.includes('border-accent') && go.includes('text-accent-ink'))
  assert.ok(strip(VERBS).indexOf('Discard changes') < strip(VERBS).indexOf('Save'))
})

test('every verb is the small stock button', () => {
  for (const button of buttons(strip(VERBS))) assert.ok(button.includes('h-ctl-sm'), button.slice(0, 60))
})

test('a verb with a question is an armed two-step: ghost at rest, and disabled with its reason as the tooltip', () => {
  const armed: ToolbarVerb = { id: 'del', label: 'Delete', tone: 'ghost', question: 'Delete 2 accounts?', onPress: () => undefined }
  const rest = strip([armed])
  assert.ok(rest.includes('>Delete</button>') && !rest.includes('Delete 2 accounts?'), 'the question shows only once armed')
  assert.ok(rest.includes('bg-transparent') && !rest.includes('disabled=""'))
  const blocked = strip([{ ...armed, reason: 'Tick an account first' }])
  assert.ok(blocked.includes('disabled=""') && blocked.includes('title="Tick an account first"'))
})

test('a verb with a reason is natively disabled in the focusable tooltip; one without is an ordinary button', () => {
  const html = strip(VERBS)
  assert.equal(html.split('role="group"').length - 1, 2, 'Discard and Save are wrapped')
  assert.ok(html.includes('aria-label="Save. Nothing has changed."'))
  const [, , go] = buttons(html)
  assert.ok(go !== undefined && !go.includes('disabled=""'))
  assert.ok(!html.includes('aria-disabled'))
})
