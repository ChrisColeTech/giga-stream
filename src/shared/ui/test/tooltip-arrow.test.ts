import test from 'node:test'
import assert from 'node:assert/strict'

import { ARROW_INSET, TOOLTIP_EDGE, TOOLTIP_GAP, placeTooltip, type AnchorBox } from '../src/lib/tooltip-place'

const VIEWPORT = 1000
const BUBBLE = { width: 200, height: 40 }
const anchorAt = (left: number, width = 20, top = 300): AnchorBox => ({ left, top, bottom: top + 24, width })

test('an anchor in the middle gets a centred bubble and a centred arrow', () => {
  const place = placeTooltip(anchorAt(490), BUBBLE, VIEWPORT)
  assert.equal(place.left, 500 - 100)
  assert.equal(place.arrow, 100)
  assert.equal(place.below, false)
  assert.equal(place.top, 300 - BUBBLE.height - TOOLTIP_GAP)
})

test('a bubble the viewport pushed right still points at its anchor: the arrow follows the anchor centre', () => {
  const place = placeTooltip(anchorAt(10, 20), BUBBLE, VIEWPORT)
  assert.equal(place.left, TOOLTIP_EDGE, 'the bubble stops at the viewport edge')
  assert.equal(place.arrow, 20 - TOOLTIP_EDGE, 'the anchor centre (20) minus the bubble left (8)')
})

test('a bubble pushed left at the right edge puts its arrow toward the right', () => {
  const place = placeTooltip(anchorAt(960, 20), BUBBLE, VIEWPORT)
  assert.equal(place.left, VIEWPORT - BUBBLE.width - TOOLTIP_EDGE)
  assert.equal(place.arrow, 970 - place.left)
  assert.ok(place.arrow > BUBBLE.width / 2)
})

test('the arrow is clamped to the bubble, clear of its corners', () => {
  const far = placeTooltip(anchorAt(990, 10), { width: 200, height: 40 }, 400)
  assert.equal(far.arrow, 200 - ARROW_INSET)
  const near = placeTooltip(anchorAt(-50, 10), BUBBLE, VIEWPORT)
  assert.equal(near.arrow, ARROW_INSET)
})

test('a bubble narrower than two insets keeps its arrow at its middle', () => {
  const place = placeTooltip(anchorAt(490), { width: 16, height: 24 }, VIEWPORT)
  assert.equal(place.arrow, 8)
})

test('with no room above the bubble flips below the anchor and the arrow rule is the same', () => {
  const place = placeTooltip(anchorAt(490, 20, 10), BUBBLE, VIEWPORT)
  assert.equal(place.below, true)
  assert.equal(place.top, 10 + 24 + TOOLTIP_GAP)
  assert.equal(place.arrow, 100)
})
