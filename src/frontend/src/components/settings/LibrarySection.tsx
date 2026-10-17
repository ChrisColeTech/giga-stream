import { FolderSync, Library } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL, Group, Row, Workspace } from "@/components/ui/Form";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import { ArmedButton } from "@/components/ui/ArmedButton";
import { SETTINGS_LABELS } from "@/constants/settings-sections";
import { LIBRARY_COPY, SORT_OPTIONS } from "@/lib/library-copy";
import { useAppStore } from "@/store/app-store";
import type { LibraryPrefs } from "@/types/settings";
import { clearWatch } from "@/services/watch";
import { useState } from "react";


const VIEWS = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
  { value: "rows", label: "Rows" },
] as const satisfies ReadonlyArray<{ value: LibraryPrefs["libraryView"]; label: string }>;

export interface LibrarySectionProps {
  /** Opens the Collections window (`06` section 6.3). */
  readonly onOpenCollections: () => void;
  /** Closes Settings and shows History in the library (`06` section 6.2). */
  readonly onOpenHistory: () => void;
}

/** Library: how it opens (view, sort, the Continue watching strip), whether watching is recorded, the way into History
 *  and Collections, and the folders' scan at startup. The preferences are the store's, applied at once; Clear history
 *  is a fileserver call and an inline two-step. */
export function LibrarySection({ onOpenCollections, onOpenHistory }: LibrarySectionProps) {
  const prefs = useAppStore((state) => state.library);
  const setPrefs = useAppStore((state) => state.setLibraryPrefs);
  const say = useAppStore((state) => state.say);
  const [clearing, setClearing] = useState(false);
  const clear = () => {
    if (clearing) return;
    setClearing(true);
    void clearWatch().then(() => {
      useAppStore.getState().requestLibraryRefresh();
      say("History cleared.");
    }).catch((error: unknown) => {
      say(error instanceof Error ? error.message : "Could not reach the fileserver.", "warn");
    }).finally(() => setClearing(false));
  };
  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group title="Library" icon={Library}>
        <Row label="Default view" tip="Show the library as a grid of posters, a list, or rows of shelves.">
          <Segmented
            aria-label="Default view"
            options={VIEWS}
            value={prefs.libraryView}
            onChange={(libraryView) => setPrefs({ libraryView })}
          />
        </Row>
        <Row label="Default sort" tip="The order the library opens in.">
          <Select
            aria-label="Default sort"
            className={FIELD_CONTROL}
            value={prefs.librarySort}
            onChange={(event) =>
              setPrefs({ librarySort: SORT_OPTIONS.find((option) => option.value === event.target.value)?.value ?? "newest" })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Continue watching" tip="Show the Continue watching strip at the top of the library.">
          <Toggle
            checked={prefs.showContinue}
            aria-label="Continue watching"
            onChange={(on) => setPrefs({ showContinue: on })}
          />
        </Row>
        <Row label="Pause history" tip="While on, nothing you play is written to History.">
          <Toggle checked={prefs.pauseHistory} aria-label="Pause history" onChange={(on) => setPrefs({ pauseHistory: on })} />
        </Row>
        <Row
          label="History"
          tip="Show the library's history, or clear it. Clearing never touches your files or collections."
          trailing={
            <ArmedButton question={LIBRARY_COPY.clearArmed} title={LIBRARY_COPY.clearTip}
              disabled={clearing} onConfirm={clear}>
              {LIBRARY_COPY.clearIdle}
            </ArmedButton>
          }
        >
          <Button size="sm" variant="ghost" onClick={onOpenHistory}>
            Open History
          </Button>
        </Row>
        <Row label="Collections" tip="Open the collections window.">
          <Button size="sm" variant="ghost" onClick={onOpenCollections}>
            Manage collections
          </Button>
        </Row>
      </Group>
      <Group title="Folders" icon={FolderSync} last>
        <Row label="Rescan on startup" tip="Rescan every folder attached to a collection when the app starts.">
          <Toggle
            checked={prefs.rescanOnStartup}
            aria-label="Rescan on startup"
            onChange={(on) => setPrefs({ rescanOnStartup: on })}
          />
        </Row>
      </Group>
    </Workspace>
  );
}
