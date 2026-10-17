import test from 'node:test'
import assert from 'node:assert/strict'

import { reduceMotionNow, resolveReduceMotion } from '../src/hooks/useReduceMotion'

test('an explicit motion preference resolves without asking the OS', () => {
  assert.equal(resolveReduceMotion('on'), true)
  assert.equal(resolveReduceMotion('off'), false)
})

test('with no document (a server render), the stamp reads as not reduced', () => {
  assert.equal(reduceMotionNow(), false)
})
