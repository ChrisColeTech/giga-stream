import { useCallback, useEffect, useReducer, useRef } from "react";
import { animate, motionValue } from "framer-motion";
import type { AnimationPlaybackControls } from "framer-motion";
import { limitsOfKey } from "@/constants/surfaces";
import { COLLAPSE_S, EASE_P2P } from "@giga/ui/lib/motion-timing";
import { reduceMotionNow } from "@giga/ui/hooks/useReduceMotion";
import { useAppStore } from "@/store/app-store";
import type { ExpectedResize, PaneMotion, PaneTweenApi } from "@/types/panes";
import type { PaneKey } from "@/types/shell";

const near = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => Math.abs(value - (right[index] ?? Number.NaN)) <= 1);

/* THE ONE COLLAPSE ENGINE (ported from Giga Cut's usePaneTween). State commits first, only the paint tweens: a
 * framer-motion value per pane travels point-to-point (skipped under reduced motion) and every frame is written
 * into Allotment through `repaint`. A pane's min/max are lifted for the length of a tween so the travelling value
 * is never clamped, in either direction. */
export function usePaneTween(keys: readonly PaneKey[], repaint: () => void): PaneTweenApi {
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const initial = useRef<Partial<Record<PaneKey, PaneMotion>> | undefined>(undefined);
  if (!initial.current) {
    const { sizes, open } = useAppStore.getState();
    initial.current = Object.fromEntries(
      keys.map((key) => {
        const committed = sizes[key] ?? limitsOfKey(key).preferred;
        const value = open[key] ? committed : 0;
        return [key, { committed, painted: motionValue(value), target: value, control: null, frame: null, animating: false }];
      }),
    );
  }
  const panes = initial.current;
  const expected = useRef<ExpectedResize[]>([]);
  const generation = useRef(0);
  const apply = useRef(repaint);
  apply.current = repaint;
  const mounted = useRef(true);
  const [, renderStatus] = useReducer((value: number) => value + 1, 0);

  const notifyStatus = useCallback((): void => {
    if (mounted.current) renderStatus();
  }, []);

  const stop = useCallback(
    (key: PaneKey): PaneMotion => {
      const pane = panes[key]!;
      if (pane.frame !== null) cancelAnimationFrame(pane.frame);
      pane.frame = null;
      const control = pane.control;
      pane.control = null;
      pane.animating = false;
      control?.stop();
      return pane;
    },
    [panes],
  );

  const travel = useCallback(
    (key: PaneKey, to: number): void => {
      const pane = stop(key);
      const from = pane.painted.get();
      pane.target = to;
      if (Math.abs(from - to) < 0.01 || reduceMotionNow()) {
        pane.painted.set(to);
        notifyStatus();
        /* No travel, but the resize just sent reached Allotment while the previous min/max were still installed: a
         * reopened pane is clamped to the old max (a closed one to the old min) and lands at the wrong size. Repaint
         * once React has published the new limits. */
        requestAnimationFrame(() => {
          if (mounted.current && pane.target === to) apply.current();
        });
        return;
      }
      pane.animating = true;
      notifyStatus();
      /* Let React publish min/max first. Otherwise the first resize reaches Allotment while the just-closed
       * maxSize=0 is still installed and it clamps the body before the motion value has a chance to travel. */
      pane.frame = requestAnimationFrame(() => {
        pane.frame = null;
        if (!pane.animating || pane.target !== to) return;
        const control: AnimationPlaybackControls = animate(pane.painted, to, {
          duration: COLLAPSE_S,
          ease: EASE_P2P,
          onComplete: () => {
            if (pane.control !== control) return;
            pane.control = null;
            pane.animating = false;
            notifyStatus();
          },
        });
        pane.control = control;
      });
    },
    [notifyStatus, stop],
  );

  useEffect(() => {
    mounted.current = true;
    const unsubscribeMotion = keysRef.current.map((key) => panes[key]!.painted.on("change", () => apply.current()));
    return () => {
      mounted.current = false;
      for (const key of keysRef.current) stop(key);
      unsubscribeMotion.forEach((unsubscribe) => unsubscribe());
    };
  }, [panes, stop]);

  useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        if (state.hydrationVersion !== previous.hydrationVersion) {
          for (const key of keysRef.current) {
            const pane = stop(key);
            const committed = state.sizes[key] ?? limitsOfKey(key).preferred;
            const value = state.open[key] ? committed : 0;
            pane.committed = committed;
            pane.target = value;
            pane.painted.set(value);
          }
          notifyStatus();
          requestAnimationFrame(() => apply.current());
          return;
        }
        if (state.openVersion === previous.openVersion) return;
        for (const key of keysRef.current) {
          if (state.open[key] === previous.open[key]) continue;
          travel(key, state.open[key] ? (state.sizes[key] ?? limitsOfKey(key).preferred) : 0);
        }
      }),
    [notifyStatus, stop, travel],
  );

  return {
    paintOf: (key) => panes[key]?.painted.get() ?? 0,
    minFor: (key) => {
      const pane = panes[key];
      return useAppStore.getState().open[key] && !pane?.animating && (pane?.painted.get() ?? 0) >= limitsOfKey(key).min
        ? limitsOfKey(key).min
        : 0;
    },
    maxFor: (key) => (useAppStore.getState().open[key] || panes[key]?.animating ? limitsOfKey(key).max : 0),
    expectResize: (sizes) => {
      expected.current.push({ generation: ++generation.current, sizes: [...sizes] });
      if (expected.current.length > 64) expected.current.shift();
    },
    acceptsResize: (sizes) => {
      const index = expected.current.findIndex((item) => near(item.sizes, sizes));
      if (index < 0) return false;
      expected.current.splice(index, 1);
      return true;
    },
    beginDrag: (key, value) => {
      expected.current = [];
      const pane = stop(key);
      pane.target = value;
      pane.painted.set(value);
      notifyStatus();
    },
    noteDrag: (key, value) => {
      const pane = panes[key]!;
      pane.target = value;
      pane.painted.set(value);
    },
    commitDrag: (key, value) => {
      const pane = panes[key]!;
      pane.committed = value;
      pane.target = value;
      pane.painted.set(value);
    },
  };
}
