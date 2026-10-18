import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

import { createDebouncer, SEARCH_DEBOUNCE_MS } from '../src/lib/debouncer'
import { compositionEndStep, inputStep } from '../src/lib/search-input-step'

/* The search field's debounce (`docs/41` section 6): one one-shot timer, restarted by each keystroke, cleared on unmount. */

test('the pause is 200 ms', () => {
  assert.equal(SEARCH_DEBOUNCE_MS, 200)
})

test('one query after 200 ms of quiet, none before', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let runs = 0
    const search = createDebouncer(() => (runs += 1))
    search.schedule()
    mock.timers.tick(199)
    assert.equal(runs, 0, 'nothing before the pause is over')
    mock.timers.tick(1)
    assert.equal(runs, 1)
    mock.timers.tick(1000)
    assert.equal(runs, 1, 'a one-shot: it does not repeat')
    assert.equal(search.pending(), false)
  } finally {
    mock.timers.reset()
  }
})

test('every keystroke restarts the timer: a burst is one query, 200 ms after the last key', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let runs = 0
    const search = createDebouncer(() => (runs += 1))
    for (let key = 0; key < 4; key += 1) {
      search.schedule()
      mock.timers.tick(150)
    }
    assert.equal(runs, 0, 'each key came before the pause ended')
    mock.timers.tick(50)
    assert.equal(runs, 1)
  } finally {
    mock.timers.reset()
  }
})

test('Enter and the clear run at once and leave no timer behind', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let runs = 0
    const search = createDebouncer(() => (runs += 1))
    search.schedule()
    search.now()
    assert.equal(runs, 1)
    assert.equal(search.pending(), false)
    mock.timers.tick(500)
    assert.equal(runs, 1, 'the due run was cancelled, not run twice')
    search.now()
    assert.equal(runs, 2, 'it runs even when nothing was due')
  } finally {
    mock.timers.reset()
  }
})

test('unmounting clears the timer: no query fires afterwards', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let runs = 0
    const search = createDebouncer(() => (runs += 1))
    search.schedule()
    assert.equal(search.pending(), true)
    search.cancel()
    assert.equal(search.pending(), false)
    mock.timers.tick(1000)
    assert.equal(runs, 0)
  } finally {
    mock.timers.reset()
  }
})

test('IME composition tells nobody until compositionend', () => {
  assert.deepEqual(inputStep(true, 'に'), { draft: 'に', commit: false })
  assert.deepEqual(inputStep(true, 'にほ'), { draft: 'にほ', commit: false })
  assert.deepEqual(compositionEndStep(), { draft: null, commit: true })
  assert.deepEqual(inputStep(false, 'dune'), { draft: null, commit: true })
})
