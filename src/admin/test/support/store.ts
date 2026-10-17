import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useAppStore } from "@/store/app-store";

/* Test support for components that read the store. A server render reads zustand's INITIAL state (its server snapshot),
 * never the live one, so a test that changes the store and then renders would see the old state. `renderLive` lays the
 * live state over the initial object for the length of one render and puts it back; `resetStore` returns the store to
 * what it was when the test file loaded. */

const INITIAL = useAppStore.getInitialState();
const PRISTINE = { ...INITIAL };

export function resetStore(): void {
  useAppStore.setState(PRISTINE, true);
}

export function renderLive(element: ReactElement): string {
  Object.assign(INITIAL, useAppStore.getState());
  try {
    return renderToStaticMarkup(element);
  } finally {
    Object.assign(INITIAL, PRISTINE);
  }
}
