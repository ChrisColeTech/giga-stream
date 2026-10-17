import type { LibraryItem } from "@/types/library";

/** The presses the Player's panes can make. The page owns what each one does (it alone calls the fileserver's services and
 *  the notice line); the panes only report the press. Local presses (tabs, episodes, folds, fullscreen) never appear here. */
export interface PlayerCommands {
  /** Retry the failed stream: the fileserver's retryStream. */
  readonly retry: () => void;
  /** Resume and Start over: the fileserver's playItem for the open title. */
  readonly resume: () => void;
  readonly startOver: () => void;
  /** Reveal in Library: shows the Library surface. */
  readonly reveal: () => void;
  readonly favorite: (value: boolean) => void;
  readonly toggleMember: (collectionId: string) => void;
  readonly removeHistory: (watchId: string) => void;
  /** A related card: opens or reuses its tab and asks the fileserver to play it. */
  readonly openRelated: (item: LibraryItem) => void;
}
