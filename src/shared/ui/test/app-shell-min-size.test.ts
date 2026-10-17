import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { AppShell, type AppShellProps } from '../src/shell/AppShell'

const render = (extra: Partial<AppShellProps> = {}): string =>
  renderToStaticMarkup(
    createElement(AppShell, {
      titlebar: createElement('header', null, 'TITLE'),
      statusbar: createElement('footer', null, 'STATUS'),
      children: createElement('main', null, 'PAGE'),
      ...extra,
    }),
  )

test('without a minSize the shell is the plain full-height column with no scroller and no inline size', () => {
  const html = render()
  assert.ok(html.startsWith('<div class="flex h-full flex-col">'), html.slice(0, 80))
  assert.ok(!html.includes('overflow-auto'))
  assert.ok(!html.includes('min-width'))
})

test('with a minSize the column keeps that size and a scroller around it takes a smaller window', () => {
  const html = render({ minSize: { width: 900, height: 640 } })
  assert.ok(html.startsWith('<div class="h-full w-full overflow-auto"><div class="flex h-full flex-col"'))
  assert.ok(html.includes('min-width:900px'))
  assert.ok(html.includes('min-height:640px'))
})

test('the titlebar, the page, the drawer and the statusbar stay in order inside the frame, the overlay outside it', () => {
  const html = render({
    minSize: { width: 900, height: 640 },
    drawer: createElement('aside', null, 'DRAWER'),
    overlay: createElement('div', null, 'OVERLAY'),
  })
  const order = ['TITLE', 'PAGE', 'DRAWER', 'STATUS', 'OVERLAY'].map((word) => html.indexOf(word))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.ok(order.every((at) => at >= 0))
  assert.ok(html.indexOf('</div></div>') < html.indexOf('OVERLAY'), 'the overlay is a sibling of the scroller, not inside it')
})
