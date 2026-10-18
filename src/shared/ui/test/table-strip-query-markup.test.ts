import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { TableStrip, type TableStripProps } from '../src/lists/TableStrip'

const NOTHING = (): void => undefined
const BASE: TableStripProps = { label: 'Channels table', noun: 'channels', refresh: { onPress: NOTHING } }
const strip = (props: Partial<TableStripProps> = {}): string =>
  renderToStaticMarkup(createElement(TableStrip, { ...BASE, ...props }))

test('a long list\'s query controls open the same first row, before Refresh', () => {
  const html = strip({ query: createElement('input', { 'aria-label': 'Search channels' }) })
  assert.equal(html.split('role="toolbar"').length - 1, 1, 'one row, not a second toolbar')
  assert.ok(html.indexOf('aria-label="Search channels"') > html.indexOf('role="toolbar"'))
  assert.ok(html.indexOf('aria-label="Search channels"') < html.indexOf('title="Refresh channels"'))
})

test('a short list draws no query controls: the row is as it was', () => {
  assert.equal(strip(), strip({ query: undefined }))
  assert.ok(!strip().includes('<input'))
})
