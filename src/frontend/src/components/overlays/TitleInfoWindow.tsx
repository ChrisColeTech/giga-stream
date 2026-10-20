import { useEffect, useMemo, useState } from "react";
import { FolderPlus, Play, Star } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Workspace } from "@giga/ui/form/Workspace";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { menuEventBelow, openMembershipMenu } from "@/components/library/card-menu";
import { changeFavourite, playRef } from "@/components/library/library-service";
import { TITLE_INFO_LABELS, TitleInfoBody } from "@/components/library/TitleInfoBody";
import { workSpec } from "@/constants/child-window";
import { collectionRow } from "@/lib/collections-model";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { NO_HISTORY, resolveItem, type ResolvedItem } from "@/lib/library-marks";
import { titlePlay } from "@/lib/title-play";
import { readTitle } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import type { TitleDetail } from "@/types/title";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";

/** The window's opening size (`50` section 2.7): bigger than the pre-`50` 640x480, still under the 80% cap. */
export const TITLE_INFO_SPEC = workSpec("title-info", "Title information", { width: 880, body: 620 });

export function TitleInfoWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const ref = useAppStore((state) => state.overlayItem);
  const marks = useAppStore((state) => state.marks);
  const libraryItems = useAppStore((state) => state.libraryItems);
  const signedIn = useAppStore((state) => state.signedIn);
  const collections = useAppStore((state) => state.collections).map(collectionRow);
  const [detail, setDetail] = useState<TitleDetail | undefined>();
  const base = libraryItems.find((candidate) => ref !== null && candidate.ref.kind === ref.kind && candidate.ref.id === ref.id);
  const item: ResolvedItem | undefined = useMemo(
    () => base === undefined ? undefined : resolveItem(base, marks, NO_HISTORY, {}),
    [base, marks],
  );

  useEffect(() => {
    if (ref?.kind !== "title") return;
    const controller = new AbortController();
    setDetail(undefined);
    void readTitle(ref.id, controller.signal).then(setDetail).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        useAppStore.getState().say(error instanceof Error ? error.message : "Title information could not be read.", "warn");
      }
    });
    return () => controller.abort();
  }, [ref]);

  const { playable, reason: unavailable } = titlePlay(item?.kind, detail);

  return (
    <ChildWindow spec={TITLE_INFO_SPEC} onClose={closeOverlay}>
      {/* The strip sits directly under the header and above the scroller: only the body scrolls, nothing is at the foot.
          Signed out, the favorite heart stays, visibly disabled with its reason, and the collection action is
          unrendered (`63` section 3.4). */}
      <Actions pinned left={<>
        <Button
          variant="ghost" aria-pressed={item?.favorite === true}
          disabled={item === undefined || !signedIn}
          title={item === undefined ? LIBRARY_COPY.noItem : !signedIn ? LIBRARY_COPY.favoritesSignedOut : undefined}
          onClick={() => { if (item !== undefined && signedIn) void changeFavourite(item.ref, !item.favorite); }}>
          <Star className={item?.favorite === true ? "text-accent-text" : undefined}
            fill={item?.favorite === true ? "currentColor" : "none"} aria-hidden />
          {item?.favorite === true ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
        </Button>
        {signedIn && (
          <Button variant="ghost" disabled={item === undefined} title={item === undefined ? LIBRARY_COPY.noItem : undefined}
            onClick={(event) => {
              if (item !== undefined) openMembershipMenu(menuEventBelow(event.currentTarget), item, collections);
            }}>
            <FolderPlus aria-hidden /> Collections
          </Button>
        )}
      </>}>
        <Button variant="primary" disabled={!playable} title={unavailable}
          onClick={() => { if (item !== undefined && playable) playRef(item.ref); }}>
          <Play aria-hidden /> {item?.kind === "tv" ? "Open in Player" : "Play"}
        </Button>
      </Actions>
      <Workspace labels={TITLE_INFO_LABELS}>
        {item === undefined ? <SkeletonRows count={6} /> : <TitleInfoBody item={item} detail={detail} />}
      </Workspace>
    </ChildWindow>
  );
}
