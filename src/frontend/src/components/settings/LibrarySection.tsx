import { FolderSync, Library } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { Toggle } from "@giga/ui/controls/Toggle";
import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { SETTINGS_LABELS } from "@/constants/settings-sections";
import { LIBRARY_COPY, SORT_OPTIONS } from "@/lib/library-copy";
import { useClearHistory } from "@/hooks/useClearHistory";
import { useAppStore } from "@/store/app-store";
import type { LibraryPrefs } from "@/types/settings";


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
 *  is a fileserver call and an inline two-step. Signed out there is no history or collections to work on (`63`
 *  section 3.4), so those controls say why they cannot be used. */
export function LibrarySection({ onOpenCollections, onOpenHistory }: LibrarySectionProps) {
  const prefs = useAppStore((state) => state.library);
  const signedIn = useAppStore((state) => state.signedIn);
  const setPrefs = useAppStore((state) => state.setLibraryPrefs);
  const { clearing, clear } = useClearHistory();
  const historyReason = signedIn ? undefined : LIBRARY_COPY.historySignedOut;
  const collectionsReason = signedIn ? undefined : LIBRARY_COPY.collectionsSignedOut;
  const clearReason = historyReason ?? (clearing ? "History is being cleared." : undefined);
  const clearButton = (
    <ArmedButton question={LIBRARY_COPY.clearArmed} title={clearReason === undefined ? LIBRARY_COPY.clearTip : undefined}
      disabled={clearReason !== undefined} onConfirm={clear}>
      {LIBRARY_COPY.clearIdle}
    </ArmedButton>
  );
  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group title="Library" icon={Library}>
        <Row label="Default view" tip="Show the library as a grid of posters, a list, or rows of shelves.">
          <Select
            aria-label="Default view"
            className={FIELD_CONTROL}
            value={prefs.libraryView}
            onChange={(event) => {
              const libraryView = VIEWS.find((option) => option.value === event.target.value)?.value ?? "grid";
              setPrefs({ libraryView });
            }}
          >
            {VIEWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
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
            clearReason === undefined ? clearButton : (
              <Tooltip text={clearReason} focusable label={`${LIBRARY_COPY.clearIdle}. ${clearReason}`}>
                {clearButton}
              </Tooltip>
            )
          }
        >
          <Button size="sm" variant="ghost" reason={historyReason} onClick={onOpenHistory}>
            Open History
          </Button>
        </Row>
        <Row label="Collections" tip="Open the collections window.">
          <Button size="sm" variant="ghost" reason={collectionsReason} onClick={onOpenCollections}>
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
