import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Segmented, type SegmentedOption } from '../src/controls/Segmented'

const OPTIONS: SegmentedOption<string>[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true, disabledReason: 'Not on this device' },
]

function render(extra: { dense?: boolean; equal?: boolean; field?: boolean } = {}): string {
  return renderToStaticMarkup(createElement(Segmented, { options: OPTIONS, value: 'a', onChange: () => undefined, ...extra }))
}

const count = (html: string, needle: string) => html.split(needle).length - 1

test('the default is the pill row at the small size, not equal and not spanning', () => {
  const html = render()
  assert.ok(html.includes('inline-flex flex-none flex-wrap'))
  assert.equal(count(html, 'h-7 px-3 text-xs'), 2)
  assert.equal(count(html, 'auto-cols-fr'), 0)
})

test('the field size is 36px chips at the body size, equal segments spanning the row', () => {
  const html = render({ field: true })
  assert.equal(count(html, 'h-9 px-3 text-sm'), 2)
  assert.ok(html.includes('grid w-full min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5'))
  assert.equal(count(html, 'h-7 px-3 text-xs'), 0)
})

test('equal sizes the row to equal columns without the field span', () => {
  const html = render({ equal: true })
  assert.ok(html.includes('inline-grid auto-cols-fr grid-flow-col gap-1.5'))
  assert.ok(!html.includes('w-full'))
})

test('a disabled option is unpressable and carries its reason as its title', () => {
  const html = render({ field: true })
  assert.ok(html.includes('title="Not on this device"'))
  assert.ok(html.includes('disabled=""'))
  assert.ok(html.includes('aria-pressed="true"'))
})
