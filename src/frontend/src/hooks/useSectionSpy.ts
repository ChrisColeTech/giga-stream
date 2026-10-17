import { useEffect } from 'react'
import type { RefObject } from 'react'

/* THE rail's scroll-spy (owner, 2026-09-05: "when i scroll down the pages,
 * the sections arent highlighting in the left nav"). A sectioned workspace
 * (Dataset, Training, Gallery tools) marks each Group with `#<prefix><id>`;
 * the rail's click jumps there, and this keeps the lit row in step while
 * the user scrolls: the section whose top has crossed the reading line
 * (30% down the scroller) is current, and at the very bottom the last one
 * is — a short last group never reaches the line on its own. The scroller
 * is the nearest overflow-y ancestor of the anchor (the Workspace body).
 *
 * NOTHING IN HERE MAY READ LAYOUT ON A SCROLL EVENT (owner, 2026-09-06: "the
 * scrolling feels janky on the pages… its all of the pages not just the grid";
 * scroll-performance plan §3). The first version ran a `querySelector` and a
 * `getBoundingClientRect()` PER SECTION, plus one on the scroller, inside the
 * `scroll` handler itself — a forced style + layout flush up to 120×/second,
 * the prime suspect in the measurements. So the geometry is measured ONCE and
 * cached: the section tops are resolved to scroller-content coordinates, and a
 * `ResizeObserver` re-measures when the viewport or any section actually
 * changes size (a Group folding, the window resizing). What is left on the
 * scroll path is a `scrollTop` read against cached numbers, coalesced into one
 * animation frame so a burst of scroll events cannot pile up. */
export function useSectionSpy<T extends string>(
  anchor: RefObject<HTMLElement | null>,
  ids: readonly T[],
  prefix: string,
  onSection: (id: T) => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return
    const start = anchor.current
    if (start === null) return
    let root: HTMLElement | null = start
    while (root !== null && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement
    if (root === null) return
    const scroller = root

    let last: T | null = null
    let frame = 0
    /** Section tops in the scroller's own content coordinates, plus the two page sizes the reading line needs. */
    let tops: Array<{ id: T; top: number }> = []
    let viewport = 0
    let content = 0

    const measure = (): HTMLElement[] => {
      /* `rect.top - scrollTop` is the content origin, so `rect.top - base` is a top that does not move as the user
         scrolls — which is the whole point: it can be compared against `scrollTop` later with no layout read. */
      const base = scroller.getBoundingClientRect().top - scroller.scrollTop
      viewport = scroller.clientHeight
      content = scroller.scrollHeight
      tops = []
      const found: HTMLElement[] = []
      for (const id of ids) {
        const el = scroller.querySelector<HTMLElement>(`#${prefix}${id}`)
        if (el === null) continue
        tops.push({ id, top: el.getBoundingClientRect().top - base })
        found.push(el)
      }
      return found
    }

    const pick = () => {
      const line = scroller.scrollTop + viewport * 0.3
      let current: T | null = null
      for (const section of tops) if (section.top <= line) current = section.id
      if (scroller.scrollTop + viewport >= content - 2) current = ids[ids.length - 1] ?? current
      if (current !== null && current !== last) {
        last = current
        onSection(current)
      }
    }

    const onScroll = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        pick()
      })
    }

    const sections = measure()
    pick()

    const observer = new ResizeObserver(() => {
      measure()
      pick()
    })
    observer.observe(scroller)
    for (const el of sections) observer.observe(el)

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [anchor, ids, prefix, onSection, active])
}
