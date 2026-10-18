import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Sep } from '../src/layout/Sep'
import { STRIP, Toolbar } from '../src/layout/Toolbar'

/* LoRA Trainer components/layout/Toolbar.tsx, ported: STRIP on bg-panel, role toolbar, left, a spacer, right. */

test('the strip is HandoffStrip.tsx 8 to the letter', () => {
  assert.equal(STRIP, 'flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2')
})

test('the toolbar draws left, then the flex spacer, then right, on the panel', () => {
  const html = renderToStaticMarkup(createElement(Toolbar, { left: createElement('i', null, 'L'), right: createElement('b', null, 'R') }))
  assert.equal(html, `<div class="${STRIP} bg-panel" role="toolbar"><i>L</i><span class="min-w-0 flex-1" aria-hidden="true"></span><b>R</b></div>`)
})

test('an empty toolbar is still drawn: the strip and its spacer', () => {
  const html = renderToStaticMarkup(createElement(Toolbar, {}))
  assert.ok(html.startsWith('<div class="flex flex-none') && html.includes('role="toolbar"') && html.includes('min-w-0 flex-1'))
})

test('Sep is the hairline between clusters', () => {
  assert.equal(renderToStaticMarkup(createElement(Sep)), '<span class="mx-1 h-5 w-px flex-none bg-hair" aria-hidden="true"></span>')
})
