import { PanePlaceholder } from "@/components/chrome/PanePlaceholder";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { CollectionsFooter } from "@/components/library/CollectionsFooter";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/app-store";

/** A stand-in for a card's Info until the cards exist: a control that opens a popup hangs it off itself. */
function InfoOpener() {
  const openOverlay = useAppStore((state) => state.openOverlay);
  return (
    <Button size="sm" className="m-3 self-start" onClick={(event) => openOverlay("title-info", event.currentTarget)}>
      Title info
    </Button>
  );
}

/** Library: collections on the left, the media body in the centre, filters on the right. */
export function LibraryPage({ active }: { active: boolean }) {
  return (
    <WorkspaceSplit
      surface="library"
      active={active}
      left={
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <PanePlaceholder name="Library / collections" />
          </div>
          <CollectionsFooter />
        </>
      }
      center={
        <>
          <PanePlaceholder name="Library / body" />
          <InfoOpener />
        </>
      }
      right={<PanePlaceholder name="Library / filters" />}
    />
  );
}
