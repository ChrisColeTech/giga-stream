import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Actions } from '../src/form/Actions'
import { Row } from '../src/form/Row'

const control = createElement('input', { type: 'text' })

test('a row draws its info glyph only when it is given a tip', () => {
  const plain = renderToStaticMarkup(createElement(Row, { label: 'Name', children: control }))
  assert.ok(!plain.includes('About Name'))
  const tipped = renderToStaticMarkup(createElement(Row, { label: 'Name', tip: 'What it is', children: control }))
  assert.ok(tipped.includes('aria-label="About Name"'))
})

test('a row answers an error on its own line, with role alert', () => {
  const html = renderToStaticMarkup(createElement(Row, { label: 'Name', error: 'Required', children: control }))
  assert.ok(html.includes('role="alert"'))
  assert.ok(html.includes('>Required<'))
})

test('a row renders its trailing controls on the readout edge', () => {
  const html = renderToStaticMarkup(createElement(Row, { label: 'Name', trailing: createElement('span', null, 'T'), children: control }))
  assert.ok(html.includes('>T<'))
})

test('pinned actions are a fixed top strip with a hairline; unpinned they are the plain row', () => {
  const pinned = renderToStaticMarkup(createElement(Actions, { pinned: true, children: createElement('button', null, 'Save') }))
  assert.ok(pinned.includes('flex-none border-b border-hair bg-surface px-6 pt-2 pb-2'))
  const plain = renderToStaticMarkup(createElement(Actions, { children: createElement('button', null, 'Save') }))
  assert.ok(!plain.includes('border-b border-hair'))
})
