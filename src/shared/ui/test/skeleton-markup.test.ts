import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { SHIMMER, SHIMMER_TILE } from '../src/lib/shimmer'
import { SkeletonRows } from '../src/lists/SkeletonRows'

const count = (html: string, needle: string) => html.split(needle).length - 1

test('SkeletonRows draws one queue-shaped row per count, hidden from assistive tech', () => {
  const html = renderToStaticMarkup(createElement(SkeletonRows, { count: 3 }))
  assert.equal(count(html, 'grid-cols-[56px_minmax(0,1fr)]'), 3)
  assert.ok(html.includes('aria-hidden="true"'))
})

test('each row draws three bars (thumbnail, title, meta) from the one SHIMMER definition, never the tile fill', () => {
  const html = renderToStaticMarkup(createElement(SkeletonRows, { count: 1 }))
  assert.equal(count(html, SHIMMER), 3)
  assert.equal(count(html, SHIMMER_TILE), 0)
})
