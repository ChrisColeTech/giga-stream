import type { ReactNode } from 'react'

import { NAV_HEADING } from './nav-classes'

/** A headed group of rail rows; the heading is optional. */
export function NavGroup({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <>
      {heading !== undefined && <div className={NAV_HEADING}>{heading}</div>}
      {children}
    </>
  )
}
