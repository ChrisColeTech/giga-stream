import test from 'node:test'
import assert from 'node:assert/strict'

import { cn } from '../src/lib/cn'

test('cn joins the truthy parts with one space', () => {
  assert.equal(cn('a', 'b'), 'a b')
})

test('cn drops false, null, undefined and the empty string', () => {
  assert.equal(cn('a', false, null, undefined, '', 'b'), 'a b')
})

test('cn with nothing left is the empty string', () => {
  assert.equal(cn(false, null), '')
})
