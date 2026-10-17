import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ArmedButton } from '../src/controls/ArmedButton'
import { ARMED_TITLE, armedFace } from '../src/controls/armed-face'

const render = (extra: { title?: string; disabled?: boolean } = {}): string =>
  renderToStaticMarkup(createElement(ArmedButton, { children: 'Remove', question: 'Remove Films?', onConfirm: () => undefined, ...extra }))

test('at rest the two-step is a ghost button naming its verb, with the caller tooltip', () => {
  const html = render({ title: 'Remove this collection' })
  assert.ok(html.includes('border-transparent bg-transparent'), 'ghost, not danger')
  assert.ok(!html.includes('text-st-failed'), 'no danger look at rest')
  assert.ok(html.includes('>Remove</button>'), 'the verb shows at rest')
  assert.ok(!html.includes('Remove Films?'), 'the question shows only once armed')
  assert.ok(html.includes('title="Remove this collection"'))
})

test('a disabled two-step is natively disabled and keeps its reason as its tooltip', () => {
  const html = render({ title: 'Nothing to remove', disabled: true })
  assert.ok(html.includes('disabled=""'))
  assert.ok(html.includes('title="Nothing to remove"'))
})

test('armed, the face is danger with the press-again tooltip; disarmed, the rest face', () => {
  assert.deepEqual(armedFace(true, 'Remove this collection'), { variant: 'danger', title: ARMED_TITLE })
  assert.deepEqual(armedFace(false, 'Remove this collection'), { variant: 'ghost', title: 'Remove this collection' })
  assert.equal(ARMED_TITLE, 'Press again to confirm')
})
