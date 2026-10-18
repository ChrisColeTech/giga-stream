import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useAppStore } from "@/store/app-store";

/* Test support for components that read the store. A server render reads zustand's INITIAL state (its server snapshot),
 * never the live one, so a test that changes the store and then renders would see the old state. `renderLive` lays the
 * live state over the initial object for the length of one render and puts it back; `resetStore` returns the store to
 * what it was when the test file loaded. */

const INITIAL = useAppStore.getInitialState();
/* `restoring: false`: a test draws the app after the on-load probe answered, as the gate and the shell show it. */
const PRISTINE = { ...INITIAL, restoring: false };

export function resetStore(): void {
  useAppStore.setState(PRISTINE, true);
}

/** A signed-in session for the tests that draw the signed-in shell: the store starts signed out, as a reload does. */
export function signInForTest(): void {
  useAppStore.setState({
    signedIn: true,
    actor: { id: 7, username: "ada@example.test" },
    serial: 1,
    tokens: { accessToken: "a", accessExpiresAt: 9e12, refreshToken: "r", refreshExpiresAt: 9e12 },
  });
}

export function renderLive(element: ReactElement): string {
  Object.assign(INITIAL, useAppStore.getState());
  try {
    return renderToStaticMarkup(element);
  } finally {
    Object.assign(INITIAL, PRISTINE);
  }
}
