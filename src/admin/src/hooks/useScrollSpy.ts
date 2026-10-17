import { useCallback, useEffect, useRef, useState } from 'react'

/* Scroll-spy for the one-scrolling-page workspaces: the rail's lit entry
 * FOLLOWS the page as it scrolls (the group whose heading is nearest above
 * the top of the stage), and a rail click scrolls to that group. Driven by
 * the container's scroll event, never a timer. */
export function useScrollSpy(keys: readonly string[], initial: string) {
  const container = useRef<HTMLDivElement | null>(null)
  const groups = useRef<Record<string, HTMLDivElement | null>>({})
  const [active, setActive] = useState(initial)
  const pinned = useRef<string | null>(null)

  const onScroll = useCallback(() => {
    const box = container.current
    if (box === null) return
    if (pinned.current !== null) {
      const el = groups.current[pinned.current]
      if (el !== null && el !== undefined && Math.abs(el.getBoundingClientRect().top - box.getBoundingClientRect().top) < 4) pinned.current = null
      else return
    }
    const top = box.getBoundingClientRect().top + 8
    let best = keys[0] ?? initial
    for (const key of keys) {
      const el = groups.current[key]
      if (el !== null && el !== undefined && el.getBoundingClientRect().top <= top) best = key
    }
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) best = keys[keys.length - 1] ?? best
    setActive(best)
  }, [keys, initial])

  useEffect(() => {
    const box = container.current
    if (box === null) return
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [onScroll])

  /** A rail click: light the entry now and scroll the group into view. */
  const goTo = useCallback((key: string) => {
    setActive(key)
    pinned.current = key
    groups.current[key]?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  const bind = useCallback((key: string) => (el: HTMLDivElement | null) => void (groups.current[key] = el), [])

  return { container, active, goTo, bind }
}
