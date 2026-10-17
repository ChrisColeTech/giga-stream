import { Library } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { Segmented } from "@/components/ui/Segmented";
import type { Settings } from "@/types/settings";

type LibraryView = Settings["libraryView"];

const VIEWS = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
] as const satisfies ReadonlyArray<{ value: LibraryView; label: string }>;

export interface LibrarySectionProps {
  readonly libraryView: LibraryView;
  readonly onLibraryView: (view: LibraryView) => void;
  /** Opens the Collections window (`06` section 6.3). */
  readonly onOpenCollections: () => void;
  /** Closes Settings and shows History in the library (`06` section 6.2). */
  readonly onOpenHistory: () => void;
}

/** Library: the default view, and the two ways out of Settings into the library's own windows and views. */
export function LibrarySection({ libraryView, onLibraryView, onOpenCollections, onOpenHistory }: LibrarySectionProps) {
  return (
    <Group id="settings.library" title="Library" icon={Library} last>
      <Row label="Default view" tip="Show the library as a grid of posters or a list.">
        <Segmented aria-label="Default view" options={VIEWS} value={libraryView} onChange={onLibraryView} />
      </Row>
      <Row label="Collections" tip="Open the collections window.">
        <Button size="sm" onClick={onOpenCollections}>Manage collections</Button>
      </Row>
      <Row label="History" tip="Close Settings and show the library's history.">
        <Button size="sm" onClick={onOpenHistory}>Open History</Button>
      </Row>
    </Group>
  );
}
