import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowRight, Eye } from 'lucide-react'

import { ToolbarStrip, type ToolbarVerb } from '../src/shell/ToolbarStrip'

const VERBS: readonly ToolbarVerb[] = [
  { id: 'preview', label: 'Preview', icon: Eye, onPress: () => undefined, reason: 'Tick a row first' },
  { id: 'go', label: 'Jobs', icon: ArrowRight, onPress: () => undefined },
]

const strip = (verbs: readonly ToolbarVerb[]): string => renderToStaticMarkup(createElement(ToolbarStrip, { label: 'Toolbar', verbs }))
const buttons = (html: string): string[] => html.match(/<button[^>]*>.*?<\/button>/g) ?? []

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

test('every verb is an icon button with an aria-label and a tooltip, and no button carries text', () => {
  const html = strip(VERBS)
  const all = buttons(html)
  assert.equal(all.length, 2)
  for (const button of all) {
    assert.ok(button.includes('aria-label="'), button)
    assert.ok(button.includes('size-ctl-md') && button.includes('<svg'), button)
    assert.ok(!/>[^<]+<\/button>/.test(button), `no text node: ${button}`)
  }
  assert.ok(html.includes('title="Jobs"'))
  assert.ok(html.indexOf('Preview') < html.indexOf('Jobs'), 'verbs keep their order')
})

test('no toolbar verb is a filled, edged or text button', () => {
  const html = strip(VERBS)
  assert.ok(!html.includes('text-accent-ink') &&!html.includes('border-ctl-edge') && !html.includes('h-ctl-sm'))
})

test('a verb with a reason is natively disabled in the focusable tooltip, never aria-disabled', () => {
  const html = strip(VERBS)
  assert.ok(html.includes('aria-label="Preview. Tick a row first"'))
  assert.equal(html.split('disabled=""').length - 1, 1, 'only the verb with a reason is disabled')
  assert.ok(!html.includes('aria-disabled'))
})
