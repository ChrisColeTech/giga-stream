import { limitsOfKey } from "@/constants/surfaces";
import type { PaneKey, Surface } from "@/types/shell";
import { api } from "./api";
import { ShellStateSchema, type ShellStateAnswer } from "./schemas/state-schema";

const PANES = [
  ["live.left", "live.settings"],
  ["live.right", "live.channels"],
  ["library.left", "library.rail"],
  ["library.right", "library.filters"],
  ["player.left", "player.browser"],
  ["player.right", "player.inspector"],
  ["player.bottom", "player.related"],
] as const satisfies ReadonlyArray<readonly [PaneKey, string]>;

export interface ShellLayout {
  readonly surface: Surface;
  readonly open: Partial<Record<PaneKey, boolean>>;
  readonly sizes: Partial<Record<PaneKey, number>>;
}

export function fromWireShell(wire: ShellStateAnswer): ShellLayout {
  const open: Partial<Record<PaneKey, boolean>> = {};
  const sizes: Partial<Record<PaneKey, number>> = {};
  for (const [pane, wireId] of PANES) {
    const visible = wire.paneVisibility[wireId];
    const size = wire.paneSizes[wireId]?.[0];
    if (visible !== undefined) open[pane] = visible;
    if (size !== undefined && size > 0) {
      const limits = limitsOfKey(pane);
      sizes[pane] = Math.min(limits.max, Math.max(limits.min, size));
    }
  }
  return { surface: wire.activeSurface, open, sizes };
}

export function toWireShell(layout: ShellLayout): ShellStateAnswer {
  const paneVisibility: Record<string, boolean> = {};
  const paneSizes: Record<string, number[]> = {};
  for (const [pane, wireId] of PANES) {
    const visible = layout.open[pane];
    const size = layout.sizes[pane];
    if (visible !== undefined) paneVisibility[wireId] = visible;
    if (size !== undefined) paneSizes[wireId] = [size];
  }
  return { activeSurface: layout.surface, paneVisibility, paneSizes };
}

export async function readShellState(signal?: AbortSignal): Promise<ShellLayout> {
  return fromWireShell(await api("/api/shell-state", ShellStateSchema, { signal }));
}

export async function patchShellState(layout: ShellLayout, signal?: AbortSignal): Promise<ShellLayout> {
  const answer = await api("/api/shell-state", ShellStateSchema, {
    method: "PATCH",
    body: toWireShell(layout),
    signal,
  });
  return fromWireShell(answer);
}
