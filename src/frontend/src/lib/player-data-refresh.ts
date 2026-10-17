import type { Episode } from "@/types/title";

export function playerDataRequestKey(itemKey: string, selection: string, revision: number): string {
  return `${itemKey}:${selection}:${revision}`;
}

export function episodeDuringRefresh(
  currentKey: string | undefined,
  requestedKey: string | undefined,
  current: Episode | undefined,
): Episode | undefined {
  return currentKey === requestedKey ? current : undefined;
}
