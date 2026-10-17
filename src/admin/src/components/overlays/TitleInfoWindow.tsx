import { FolderPlus, Play, Star } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Workspace } from "@giga/ui/form/Workspace";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { workSpec } from "@/constants/child-window";
import { menuEventBelow, openMembershipMenu } from "@/components/library/card-menu";
import { changeFavourite, playRef } from "@/components/library/library-service";
import { TITLE_INFO_LABELS, TitleInfoBody } from "@/components/library/TitleInfoBody";
import { COLLECTION_ROWS, MEMBERSHIP } from "@/fixtures/collections";
import { LIBRARY_ITEMS, TITLE_DETAILS } from "@/fixtures/titles";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { NO_HISTORY, resolveItem, type ResolvedItem } from "@/lib/library-marks";
import { useAppStore } from "@/store/app-store";
import type { TitleDetail } from "@/types/title";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("title-info", "Title information", { width: 640, body: 480 });

/** Title information (`06` section 4.4): a work window opened by a card's Info, its body on the family page grammar
 *  (LoRA's settings panes): one group for the title, and the verbs pinned at the foot, Favorite and Collections on the
 *  left and Play the one accent on the right. Favorite, Collections and Play act through the fileserver, and a refusal is
 *  said on the notice line. */
export function TitleInfoWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const ref = useAppStore((state) => state.overlayItem);
  const marks = useAppStore((state) => state.marks);
  const base = LIBRARY_ITEMS.find((candidate) => ref !== null && candidate.ref.kind === ref.kind && candidate.ref.id === ref.id);
  const item: ResolvedItem | undefined = base === undefined ? undefined : resolveItem(base, marks, NO_HISTORY, MEMBERSHIP);
  const detail: TitleDetail | undefined = ref?.kind === "title" ? TITLE_DETAILS[ref.id] : undefined;
  const none = item === undefined ? LIBRARY_COPY.noItem : undefined;

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <Workspace labels={TITLE_INFO_LABELS}>
        {item === undefined ? <SkeletonRows count={6} /> : <TitleInfoBody item={item} detail={detail} />}
        <Actions
          pinned
          left={
            <>
              {/* A lit toggle in the body is its glyph alone, never the raised accent edge of a chrome toggle. */}
              <Button
                variant="ghost"
                aria-pressed={item?.favorite === true}
                disabled={item === undefined}
                title={none}
                onClick={() => {
                  if (item !== undefined) changeFavourite(item.ref, !item.favorite);
                }}
              >
                <Star
                  className={item?.favorite === true ? "text-accent-text" : undefined}
                  fill={item?.favorite === true ? "currentColor" : "none"}
                  aria-hidden
                />
                {item?.favorite === true ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
              </Button>
              <Button
                variant="ghost"
                disabled={item === undefined}
                title={none}
                onClick={(event) => {
                  if (item !== undefined) openMembershipMenu(menuEventBelow(event.currentTarget), item, COLLECTION_ROWS);
                }}
              >
                <FolderPlus aria-hidden /> Collections
              </Button>
            </>
          }
        >
          <Button
            variant="primary"
            disabled={item === undefined}
            title={none}
            onClick={() => {
              if (item !== undefined) playRef(item.ref);
            }}
          >
            <Play aria-hidden /> {item?.kind === "tv" ? "Open in Player" : "Play"}
          </Button>
        </Actions>
      </Workspace>
    </ChildWindow>
  );
}
