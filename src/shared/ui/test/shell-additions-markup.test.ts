import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Tv } from 'lucide-react'

import { Brand } from '../src/shell/Brand'
import { PaneToggle } from '../src/shell/PaneToggle'
import { RunningWork } from '../src/shell/RunningWork'
import { TabPill } from '../src/shell/TabPill'

const idle = { running: null, liveCount: 0, onStop: () => undefined }

test('Brand draws an optional mono tag after the wordmark, and nothing without one', () => {
  const tagged = renderToStaticMarkup(createElement(Brand, { word: 'GIGA', subtitle: 'STREAM', icon: Tv, tag: 'ADMIN' }))
  assert.ok(tagged.indexOf('STREAM') < tagged.indexOf('>ADMIN<'))
  assert.ok(tagged.includes('font-mono') && tagged.includes('text-faint'))
  assert.ok(!renderToStaticMarkup(createElement(Brand, { word: 'GIGA', subtitle: 'STREAM', icon: Tv })).includes('ADMIN'))
})

test('a pane toggle can name what it toggles', () => {
  const named = renderToStaticMarkup(createElement(PaneToggle, { side: 'bottom', lit: false, onToggle: () => undefined, name: 'the events band' }))
  assert.ok(named.includes('aria-label="Toggle the events band"') && named.includes('title="Toggle the events band"'))
  const plain = renderToStaticMarkup(createElement(PaneToggle, { side: 'bottom', lit: false, onToggle: () => undefined }))
  assert.ok(plain.includes('aria-label="Toggle bottom pane"'))
})

test('a tab carries its tooltip while the pill works, and the track carries the reason while it sleeps', () => {
  const items = [{ id: 'a', label: 'Channels', title: 'Channels (Ctrl+1)' }, { id: 'b', label: 'Titles' }]
  const props = { label: 'Sections', items, active: 'a', onSelect: () => undefined }
  const live = renderToStaticMarkup(createElement(TabPill<string>, props))
  assert.ok(live.includes('title="Channels (Ctrl+1)"'))
  const asleep = renderToStaticMarkup(createElement(TabPill<string>, { ...props, disabled: true, disabledReason: 'Sign in first' }))
  assert.ok(asleep.includes('title="Sign in first"') && !asleep.includes('Ctrl+1'))
})

test('running work can carry its own words, and Stop can be disabled with a reason while work runs', () => {
  const html = renderToStaticMarkup(
    createElement(RunningWork, {
      ...idle,
      running: { label: 'Channel builds', percent: null },
      liveCount: 3,
      readout: '2 preparing · 1 syncing',
      stopReason: 'A channel build cannot be cancelled.',
    }),
  )
  assert.ok(html.includes('>2 preparing · 1 syncing</span>'))
  assert.ok(html.includes('aria-label="Stop. A channel build cannot be cancelled."'))
  const stop = html.match(/<button[^>]*>/)?.[0] ?? ''
  assert.ok(stop.includes('disabled=""') && !stop.includes('title='))
})

test('without those props running work reads as before', () => {
  const html = renderToStaticMarkup(createElement(RunningWork, { ...idle, running: { label: 'Scan', percent: null }, liveCount: 2 }))
  assert.ok(html.includes('>2 running</span>'))
  assert.ok(!html.includes('role="group"'))
  assert.ok(!(html.match(/<button[^>]*>/)?.[0] ?? '').includes('disabled=""'))
})
