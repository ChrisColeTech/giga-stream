import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Button } from '../src/controls/Button'
import { IconButton } from '../src/controls/IconButton'
import { nodeText } from '../src/lib/node-text'

const GROUP = 'role="group"'
const buttonTag = (html: string): string => html.match(/<button[^>]*>/)?.[0] ?? ''

test('a Button with no reason has no wrapper and keeps its own title and disabled state', () => {
  const html = renderToStaticMarkup(createElement(Button, { title: 'Save it' }, 'Save'))
  assert.ok(html.startsWith('<button'), 'the button is the root')
  assert.ok(!html.includes(GROUP))
  assert.ok(!html.includes('aria-describedby'))
  assert.ok(buttonTag(html).includes('title="Save it"'))
  assert.ok(!buttonTag(html).includes('disabled=""'))
  const plain = renderToStaticMarkup(createElement(Button, { disabled: true }, 'Save'))
  assert.ok(plain.startsWith('<button') && plain.includes('disabled=""'), 'a plain disabled button stays unwrapped')
})

test('a Button with a reason is natively disabled inside a focusable tooltip group labelled "Verb. reason"', () => {
  const html = renderToStaticMarkup(createElement(Button, { reason: 'Tick a row first.', variant: 'primary' }, 'Preview →'))
  assert.ok(html.startsWith('<span'), 'the tooltip anchor is the root')
  assert.ok(html.includes(GROUP))
  assert.ok(html.includes('tabindex="0"'), 'the group takes the focus the disabled button cannot')
  assert.ok(html.includes('aria-label="Preview →. Tick a row first."'))
  assert.ok(html.includes('aria-describedby'))
  const tag = buttonTag(html)
  assert.ok(tag.includes('disabled=""'), 'native disabled')
  assert.ok(!tag.includes('aria-disabled'), 'never aria-disabled')
  assert.ok(!tag.includes('title='), 'no native title doubling the bubble')
})

test('a reason disables the button even when the caller did not, and drops the caller title', () => {
  const html = renderToStaticMarkup(createElement(Button, { reason: 'Why not.', disabled: false, title: 'Go' }, 'Go'))
  const tag = buttonTag(html)
  assert.ok(tag.includes('disabled=""'))
  assert.ok(!tag.includes('title='))
})

test('the verb is the aria-label when there is one, else the text of the children and not an icon', () => {
  const icon = createElement('svg', null)
  const named = renderToStaticMarkup(createElement(Button, { reason: 'No.', 'aria-label': 'Restore' }, icon, ' Restore defaults'))
  assert.ok(named.includes('aria-label="Restore. No."'))
  const text = renderToStaticMarkup(createElement(Button, { reason: 'No.' }, icon, ' Restore defaults'))
  assert.ok(text.includes('aria-label="Restore defaults. No."'))
})

test('a full-width Button keeps its wrapper full width too', () => {
  const html = renderToStaticMarkup(createElement(Button, { reason: 'No.', full: true }, 'Back'))
  assert.ok(html.split('>')[0]?.includes('w-full'), 'the anchor spans')
})

test('an IconButton with a reason is the same: native disabled in a focusable group labelled by its aria-label', () => {
  const html = renderToStaticMarkup(createElement(IconButton, { reason: 'Nothing to stop', 'aria-label': 'Stop' }))
  assert.ok(html.startsWith('<span') && html.includes(GROUP))
  assert.ok(html.includes('aria-label="Stop. Nothing to stop"'))
  assert.ok(buttonTag(html).includes('disabled=""'))
  const bare = renderToStaticMarkup(createElement(IconButton, { 'aria-label': 'Stop' }))
  assert.ok(bare.startsWith('<button') && !bare.includes(GROUP))
})

test('nodeText joins strings and numbers and skips elements and empty values', () => {
  assert.equal(nodeText('Save'), 'Save')
  assert.equal(nodeText(['Run ', 3, createElement('svg'), null, false, ' jobs']), 'Run 3 jobs')
  assert.equal(nodeText(createElement('b', null, 'x')), '')
  assert.equal(nodeText(undefined), '')
})
