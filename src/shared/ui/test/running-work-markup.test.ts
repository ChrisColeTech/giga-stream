import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { RunningWork, type RunningWorkProps, type WorkView } from '../src/shell/RunningWork'

const props = (view: Partial<WorkView> = {}): RunningWorkProps => ({
  view: { active: false, percent: null, stoppable: false, stopTitle: 'Nothing to stop', ...view },
  onStop: () => undefined,
})

const render = (view: Partial<WorkView> = {}): string => renderToStaticMarkup(createElement(RunningWork, props(view)))

const stopButton = (html: string): string => html.match(/<button[^>]*>/)?.[0] ?? ''
const track = (html: string): string => html.match(/<span[^>]*role="progressbar"[^>]*>/)?.[0] ?? ''

test('idle: an empty track, the word idle, Stop disabled and saying there is nothing to stop', () => {
  const html = render()
  assert.ok(html.includes('>idle</span>'))
  assert.ok(html.includes('width:0%'))
  assert.ok(!html.includes('aria-valuenow'), 'no percent to report')
  assert.ok(!html.includes('animate-pulse-busy'), 'nothing pulses at rest')
  assert.ok(stopButton(html).includes('disabled=""'))
  assert.ok(stopButton(html).includes('title="Nothing to stop"'))
})

test('determinate work shows its percent on the track, the readout verbatim and the bar tooltip', () => {
  const html = render({ active: true, percent: 40, readout: '2 running · 40%', tooltip: 'Encoding · 40%', stoppable: true, stopTitle: 'Stop encoding' })
  assert.ok(html.includes('aria-valuenow="40"'))
  assert.ok(html.includes('width:40%'))
  assert.ok(!html.includes('animate-pulse-busy'))
  assert.ok(html.includes('>2 running · 40%</span>'))
  assert.ok(html.includes('title="Encoding · 40%"'))
  const stop = stopButton(html)
  assert.ok(!stop.includes('disabled=""'))
  assert.ok(stop.includes('title="Stop encoding"'))
})

test('indeterminate work fills the track and pulses, with no percent to report', () => {
  const html = render({ active: true, percent: null, readout: 'Scanning Films' })
  assert.ok(html.includes('width:100%'))
  assert.ok(html.includes('animate-pulse-busy'))
  assert.ok(!html.includes('aria-valuenow'))
  assert.ok(html.includes('>Scanning Films</span>'))
})

test('the track wears the nav pill edge so it reads on Theatre black', () => {
  assert.ok(track(render()).includes('border-ctl-edge'))
  assert.ok(track(render()).includes('rounded-full'))
})

test('a reason disables Stop inside its labelled tooltip even while the bar runs', () => {
  const html = render({ active: true, percent: 30, readout: '1 preparing', stoppable: false, stopTitle: 'A channel build cannot be stopped.', stopReason: 'A channel build cannot be stopped.' })
  assert.ok(html.includes('aria-label="Stop. A channel build cannot be stopped."'))
  const stop = stopButton(html)
  assert.ok(stop.includes('disabled=""'))
  assert.ok(!stop.includes('title='), 'the reason is the tooltip, not the browser title')
})

test('the track is a labelled progress bar, and rendering never presses Stop', () => {
  let stops = 0
  const html = renderToStaticMarkup(
    createElement(RunningWork, { view: { active: true, percent: 10, stoppable: true, stopTitle: 'Stop encoding' }, onStop: () => (stops += 1) }),
  )
  assert.ok(html.includes('role="progressbar"'))
  assert.ok(html.includes('aria-label="Running work"'))
  assert.equal(stops, 0)
})
