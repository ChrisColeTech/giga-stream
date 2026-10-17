import { useEffect, useRef } from "react";
import { isTextField } from "../lib/text-field";

/** One key press, as the key map reads it: the key, its modifiers, and what the press landed on. */
export interface KeyPress {
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly defaultPrevented: boolean;
  /** An IME composition owns every key. */
  readonly composing: boolean;
  /** A text field owns every key it takes, Escape included. */
  readonly inTextField: boolean;
}

/** What is open, read at each press: a work window or popup, and the events drawer. */
export interface ShellKeyContext {
  readonly windowOpen: boolean;
  readonly drawerOpen: boolean;
}

/** A program's shell keys, by action id. `ctrl` keys are lower case and yield to an open window; `ctrlAlways` keys
 *  work under one too; `escape` runs only when no window is open and the events drawer is. */
export interface ShellKeyMap<Id extends string> {
  readonly ctrl: Readonly<Record<string, Id>>;
  readonly ctrlAlways: Readonly<Record<string, Id>>;
  readonly escape?: Id;
}

/** The action a press resolves to, or null. Pure: the same press and context always give the same answer. */
export function resolveShellKey<Id extends string>(
  map: ShellKeyMap<Id>,
  press: KeyPress,
  context: ShellKeyContext,
): Id | null {
  if (press.defaultPrevented || press.composing || press.inTextField) return null;
  if (press.key === "Escape") return !context.windowOpen && context.drawerOpen ? (map.escape ?? null) : null;
  if (!press.ctrl || press.alt || press.shift) return null;
  const key = press.key.toLowerCase();
  const always = map.ctrlAlways[key];
  if (always !== undefined) return always;
  if (context.windowOpen) return null;
  return map.ctrl[key] ?? null;
}

/** The first candidate that passes `shown`, or undefined. A hidden surface has no boxes, so the one on screen
 *  answers. */
export function firstShown<T>(candidates: readonly T[], shown: (node: T) => boolean): T | undefined {
  return candidates.find(shown);
}

/** Whether a field is really on screen: it has a box with size, and no closed (inert) pane holds it. A pane collapsed
 *  to zero still lays its children out, so a box alone is not proof. */
function onScreen(node: HTMLElement): boolean {
  const box = node.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && node.closest("[inert]") === null;
}

/** Focuses the first on-screen element matching `selector`. Reports whether it found one. */
export function focusFirstShown(selector: string): boolean {
  const field = firstShown(Array.from(document.querySelectorAll<HTMLElement>(selector)), onScreen);
  if (field === undefined) return false;
  field.focus();
  return true;
}

export interface ShellKeysOptions<Id extends string> {
  readonly map: ShellKeyMap<Id>;
  /** Read at each press, so the answer is the state of that moment. */
  readonly context: () => ShellKeyContext;
  /** Runs the action; true when it used the press, which is then prevented. */
  readonly run: (id: Id) => boolean;
}

/** Listens for the shell's keys on the window (`02` section 6). The options are read through a ref, so the listener is
 *  attached once and always sees the latest map and handler. */
export function useShellKeys<Id extends string>(options: ShellKeysOptions<Id>): void {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current;
      const target = event.target instanceof Element ? event.target : null;
      const press: KeyPress = {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        defaultPrevented: event.defaultPrevented,
        composing: event.isComposing,
        inTextField: target !== null && isTextField(target),
      };
      const id = resolveShellKey(current.map, press, current.context());
      if (id === null) return;
      if (current.run(id)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
