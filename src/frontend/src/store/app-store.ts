import { create } from "zustand";
import { navigationSlice, type NavigationSlice } from "./navigation-slice";
import { librarySlice, type LibrarySlice } from "./slices/library-slice";
import { liveSlice, type LiveSlice } from "./slices/live-slice";
import { playbackSlice, type PlaybackSlice } from "./slices/playback-slice";
import { sessionSlice, type SessionSlice } from "./slices/session-slice";
import { shellSlice, type ShellSlice } from "./slices/shell-slice";
import { watchSlice, type WatchSlice } from "./slices/watch-slice";

/** The one application store. Slices divide ownership without creating another Zustand store. */
export interface AppState
  extends NavigationSlice, SessionSlice, ShellSlice, LiveSlice, PlaybackSlice, LibrarySlice, WatchSlice {}

export const useAppStore = create<AppState>()((set, get) => ({
  ...shellSlice(set, get),
  ...liveSlice(set),
  ...playbackSlice(set, get),
  ...librarySlice(set, get),
  ...watchSlice(set, get),
  ...navigationSlice(set, get),
  ...sessionSlice(set, get),
}));
