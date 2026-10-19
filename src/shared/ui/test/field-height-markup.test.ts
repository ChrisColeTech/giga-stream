import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Input } from '../src/controls/Input'
import { Select } from '../src/controls/Select'
import { Textarea } from '../src/controls/Textarea'

test('a textarea carries h-auto, never the one-line h-ctl-md, and honours its rows attribute', () => {
  const html = renderToStaticMarkup(createElement(Textarea, { rows: 4 }))
  assert.ok(html.includes('h-auto'), 'the textarea sets its own height')
  assert.ok(!html.includes('h-ctl-md'), 'the one-line height never reaches a textarea')
  assert.ok(html.includes('rows="4"'), 'rows decides the height')
})

test('a textarea defaults to 3 rows and keeps the resize grip', () => {
  const html = renderToStaticMarkup(createElement(Textarea))
  assert.ok(html.includes('rows="3"') && html.includes('resize-y'))
})

test('the single-line fields keep the one-line height', () => {
  assert.ok(renderToStaticMarkup(createElement(Input)).includes('h-ctl-md'))
  assert.ok(renderToStaticMarkup(createElement(Select)).includes('h-ctl-md'))
})
