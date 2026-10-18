import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { QueryBar } from '../src/lists/QueryBar'
import { QuerySearch, type QuerySearchProps } from '../src/lists/QuerySearch'
import { QuerySelect, type QuerySelectProps } from '../src/lists/QuerySelect'
import { SortControl } from '../src/lists/SortControl'
import { TableStrip } from '../src/lists/TableStrip'

const NOTHING = (): void => undefined
const KINDS = [
  { value: 'all', label: 'Any kind' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'Series' },
]
const select = (props: Partial<QuerySelectProps<string>> = {}): string =>
  renderToStaticMarkup(
    createElement(QuerySelect<string>, { label: 'Kind', value: 'all', options: KINDS, onChange: NOTHING, ...props }),
  )
const search = (props: Partial<QuerySearchProps> = {}): string =>
  renderToStaticMarkup(createElement(QuerySearch, { label: 'Search titles', value: '', onChange: NOTHING, onSearch: NOTHING, ...props }))
const face = (html: string): string => html.slice(html.indexOf('</select>'))

test('a filter at its default shows only its name, dim, with no accent', () => {
  const html = select()
  assert.ok(face(html).includes('>Kind</span></span>'), 'the visible face is the name')
  assert.ok(!face(html).includes('Any kind'), 'the default option is worded for the open list only')
  assert.ok(!html.includes('data-active'))
  assert.ok(html.includes('text-dim'))
  assert.ok(!html.includes('border-accent-edge'))
})

test('the default option stays in the open list, worded for it', () => {
  assert.ok(select().includes('<option value="all" selected="">Any kind</option>'))
})

test('a chosen filter shows its value in the accent tone with an accent border and says so in its tooltip', () => {
  const html = select({ value: 'movie' })
  assert.ok(face(html).includes('>Movies</span></span>'))
  assert.ok(html.includes('data-active=""'))
  assert.ok(html.includes('border-accent-edge') && html.includes('text-accent-text'))
  assert.ok(html.includes('title="Kind: Movies"'))
})

test('the face is as wide as the widest of its texts, so choosing never moves its neighbours', () => {
  const html = select()
  assert.equal(html.split('invisible').length - 1, 3, 'the name, Movies and Series are laid out invisibly')
})

test('every select has an accessible name and a tooltip; a reason disables it and replaces the tooltip', () => {
  assert.ok(select().includes('aria-label="Kind"') && select().includes('title="Kind"'))
  const waiting = select({ reason: 'A bulk run is going.' })
  assert.ok(waiting.includes('disabled=""') && waiting.includes('title="A bulk run is going."'))
})

test('a plain (sort) select always shows its chosen option, never the name or the accent', () => {
  const html = select({ plain: true, label: 'Sort', value: 'movie' })
  assert.ok(face(html).includes('>Movies</span></span>'))
  assert.ok(!html.includes('data-active') && !html.includes('border-accent-edge'))
  assert.ok(select({ plain: true }).includes('text-text'))
})

test('the sort control draws a direction toggle with a tooltip saying the order and what a press does', () => {
  const html = renderToStaticMarkup(
    createElement(SortControl<string>, {
      label: 'Sort',
      value: 'all',
      options: KINDS,
      onChange: NOTHING,
      direction: { value: 'asc', onToggle: NOTHING },
    }),
  )
  assert.ok(html.includes('aria-label="Sort direction, ascending"'))
  assert.ok(html.includes('title="Sorted ascending. Press for descending."'))
  const without = renderToStaticMarkup(
    createElement(SortControl<string>, { label: 'Sort', value: 'all', options: KINDS, onChange: NOTHING }),
  )
  assert.ok(!without.includes('<button'), 'a sort with no direction draws no toggle')
})

test('the search field has an icon, a name, a tooltip, no placeholder, and no clear button while empty', () => {
  const html = search()
  assert.ok(html.includes('aria-label="Search titles"') && html.includes('title="Search titles"'))
  assert.ok(html.includes('data-search=""') && html.includes('type="search"'))
  assert.ok(!html.includes('placeholder="'))
  assert.ok(html.includes('<svg'), 'the search icon')
  assert.ok(!html.includes('Clear search'))
  assert.ok(html.includes('min-w-[220px]') && html.includes('flex-1'))
})

test('the search field draws a small clear button once it has text', () => {
  const html = search({ value: 'dune' })
  assert.ok(html.includes('value="dune"'))
  assert.ok(html.includes('aria-label="Clear search"') && html.includes('title="Clear search"'))
})

test('a waiting search is natively disabled, with the reason as its tooltip and no clear button', () => {
  const html = search({ value: 'dune', reason: 'Reading.' })
  assert.ok(html.includes('disabled=""') && html.includes('title="Reading."'))
  assert.ok(!html.includes('Clear search'))
})

test('the query bar: one line from 900px of the row (container query), the search alone on the first line below it', () => {
  const html = renderToStaticMarkup(
    createElement(QueryBar, { search: createElement('i', null, 'S'), children: createElement('b', null, 'F') }),
  )
  assert.ok(html.startsWith('<div class="@container'), 'the row is the container, not the window')
  assert.ok(html.includes('flex-wrap') && html.includes('@[900px]:flex-nowrap'))
  assert.ok(html.includes('basis-full') && html.includes('@[900px]:basis-0'), 'full first line when narrow')
  assert.ok(html.includes('min-w-[220px]'))
  assert.ok(html.indexOf('<i>S</i>') < html.indexOf('<b>F</b>'), 'the search leads')
})

test('a hairline separates the query row from the verb row; both share the strip padding', () => {
  const html = renderToStaticMarkup(
    createElement(TableStrip, { label: 'Titles table', noun: 'titles', refresh: { onPress: NOTHING }, query: createElement('i') }),
  )
  const query = html.slice(html.indexOf('role="search"'), html.indexOf('role="toolbar"'))
  assert.ok(query.includes('border-b') && query.includes('border-hair') && query.includes('px-3'))
  assert.ok(html.slice(html.indexOf('role="toolbar"')).includes('px-3'))
})
