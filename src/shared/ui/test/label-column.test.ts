import test from 'node:test'
import assert from 'node:assert/strict'

import { labelColumn } from '../src/lib/label-column'

test('the label column never narrows below 120px, even with no labels', () => {
  assert.equal(labelColumn([]), '120px')
  assert.equal(labelColumn(['Name']), '120px')
})

test('the label column is the longest label at 8px a character plus the info glyph', () => {
  assert.equal(labelColumn(['x'.repeat(20)]), '196px')
  assert.equal(labelColumn(['short', 'x'.repeat(20)]), '196px')
})

test('the label column grows with the longest label', () => {
  const narrow = parseInt(labelColumn(['x'.repeat(20)]), 10)
  const wide = parseInt(labelColumn(['x'.repeat(30)]), 10)
  assert.ok(wide > narrow)
})
