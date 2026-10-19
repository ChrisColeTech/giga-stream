import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_SEGMENTED_PAIRS_PER_GROUP,
  MAX_SEGMENTED_PAIRS_PER_PAGE,
  SEGMENTED_OPTION_COUNT,
} from '../src/controls/choice-rules'

test('the repository choice inventory uses the fixed Segmented budgets', () => {
  assert.equal(SEGMENTED_OPTION_COUNT, 2)
  assert.equal(MAX_SEGMENTED_PAIRS_PER_GROUP, 1)
  assert.equal(MAX_SEGMENTED_PAIRS_PER_PAGE, 2)
})
