import { useEffect, useState } from "react";
import { DEFAULT_QUERY, collectionSource } from "@/lib/library-query";
import { memberRows, type MemberRow } from "@/lib/collections-members";
import { readLibrary } from "@/services/library";
import { useAppStore } from "@/store/app-store";

export interface CollectionMembersData {
  readonly rows: readonly MemberRow[];
  readonly loading: boolean;
  readonly refresh: () => void;
}

export function useCollectionMembers(collectionId: string): CollectionMembersData {
  const [rows, setRows] = useState<readonly MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serial, setSerial] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void readLibrary({ ...DEFAULT_QUERY, source: collectionSource(collectionId) }, controller.signal).then((answer) => {
      setRows(memberRows(answer.items.map((item) => item.ref), answer.items));
      setLoading(false);
      useAppStore.getState().rememberLibraryItems(answer.items);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoading(false);
        useAppStore.getState().say(error instanceof Error ? error.message : "Collection videos could not be read.", "warn");
      }
    });
    return () => controller.abort();
  }, [collectionId, serial]);

  return { rows, loading, refresh: () => setSerial((value) => value + 1) };
}
