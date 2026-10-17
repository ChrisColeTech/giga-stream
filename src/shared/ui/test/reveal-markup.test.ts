import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Reveal } from '../src/lists/Reveal'

const SKELETON = createElement('span', null, 'SKELETON')
const CONTENT = createElement('span', null, 'CONTENT')

test('Reveal shows its skeleton, and says it is busy, until the content is ready', () => {
  const html = renderToStaticMarkup(createElement(Reveal, { ready: false, skeleton: SKELETON, children: CONTENT }))
  assert.ok(html.includes('SKELETON'))
  assert.ok(!html.includes('CONTENT'))
  assert.ok(html.includes('aria-busy="true"'))
})

test('Reveal fades its content in over the skeleton footprint once ready, and is no longer busy', () => {
  const html = renderToStaticMarkup(createElement(Reveal, { ready: true, skeleton: SKELETON, children: CONTENT }))
  assert.ok(html.includes('CONTENT'))
  assert.ok(!html.includes('SKELETON'))
  assert.ok(html.includes('animate-fade-in'))
  assert.ok(html.includes('aria-busy="false"'))
})
