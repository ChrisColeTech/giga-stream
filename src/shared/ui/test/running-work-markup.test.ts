import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { RunningWork, type RunningWorkProps } from '../src/shell/RunningWork'

const render = (props: Partial<RunningWorkProps> = {}): string =>
  renderToStaticMarkup(createElement(RunningWork, { running: null, liveCount: 0, onStop: () => undefined, ...props }))

const stopButton = (html: string): string => html.match(/<button[^>]*>/)?.[0] ?? ''

test('idle: an empty track, the word idle, Stop disabled and saying there is nothing to stop', () => {
  const html = render()
  assert.ok(html.includes('>idle</span>'))
  assert.ok(html.includes('title="Nothing running"'))
  assert.ok(html.includes('width:0%'))
  assert.ok(!html.includes('aria-valuenow'), 'no percent to report')
  assert.ok(!html.includes('animate-pulse-busy'), 'nothing pulses at rest')
  const stop = stopButton(html)
  assert.ok(stop.includes('disabled=""'))
  assert.ok(stop.includes('title="Nothing to stop"'))
})

test('indeterminate work fills the track and pulses, and Stop names what it stops', () => {
  const html = render({ running: { label: 'Scanning Films', percent: null }, liveCount: 1 })
  assert.ok(html.includes('width:100%'))
  assert.ok(html.includes('animate-pulse-busy'))
  assert.ok(html.includes('>1 running</span>'))
  assert.ok(!html.includes('aria-valuenow'))
  const stop = stopButton(html)
  assert.ok(!stop.includes('disabled=""'))
  assert.ok(stop.includes('title="Stop scanning films"'))
})

test('determinate work shows its percent on the track, the readout and the tooltip', () => {
  const html = render({ running: { label: 'Encoding', percent: 40 }, liveCount: 2 })
  assert.ok(html.includes('aria-valuenow="40"'))
  assert.ok(html.includes('width:40%'))
  assert.ok(!html.includes('animate-pulse-busy'))
  assert.ok(html.includes('>2 running · 40%</span>'))
  assert.ok(html.includes('title="Encoding · 40%"'))
})

test('the track is a labelled progress bar, and rendering never presses Stop', () => {
  let stops = 0
  const html = renderToStaticMarkup(createElement(RunningWork, { running: { label: 'Encoding', percent: 10 }, liveCount: 1, onStop: () => (stops += 1) }))
  assert.ok(html.includes('role="progressbar"'))
  assert.ok(html.includes('aria-label="Running work"'))
  assert.equal(stops, 0)
})
