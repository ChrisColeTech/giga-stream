import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ACCENT_SWATCHES } from '../src/controls/accent-swatches'
import { Swatches } from '../src/controls/Swatches'

const count = (html: string, needle: string) => html.split(needle).length - 1

const render = (value: string, disabled = false): string =>
  renderToStaticMarkup(createElement(Swatches, { value, onChange: () => undefined, options: ACCENT_SWATCHES, label: 'Accent', disabled }))

test('the group is a labelled radiogroup of five radios, one checked, one tab stop', () => {
  const html = render('blue')
  assert.ok(html.includes('role="radiogroup"'))
  assert.ok(html.includes('aria-label="Accent"'))
  assert.equal(count(html, 'role="radio"'), 5)
  assert.equal(count(html, 'aria-checked="true"'), 1)
  assert.equal(count(html, 'tabindex="0"'), 1)
  assert.equal(count(html, 'tabindex="-1"'), 4)
})

test('the chosen swatch is ringed and the others are not, and each keeps its own family fill', () => {
  const html = render('blue')
  assert.equal(count(html, 'shadow-[0_0_0_2px_var(--color-text)]'), 1)
  assert.equal(count(html, 'shadow-none'), 4)
  assert.equal(count(html, 'bg-sw-blue'), 1)
  assert.equal(count(html, 'bg-sw-amber'), 1)
})

test('the swatches are in the display order: amber, blue, green, violet, rose', () => {
  const html = render('amber')
  const order = ['amber', 'blue', 'green', 'violet', 'rose'].map((id) => html.indexOf(`aria-label="${id}"`))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.ok(order.every((at) => at >= 0))
})

test('a disabled group disables every swatch', () => {
  assert.equal(count(render('amber', true), 'disabled=""'), 5)
})
