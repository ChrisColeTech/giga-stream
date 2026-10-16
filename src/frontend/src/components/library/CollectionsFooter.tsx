import { FolderCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/app-store";

/** The rail's footer, as Giga Images has it (`docs/reference/giga-images-real/01-gallery.png`): one full-width
 *  `Manage collections` button with a folder-cog icon, in a strip pinned under a hairline. It opens the collections work
 *  surface at once (navigation needs no backend); creating is that window's first group. There is no separate Add Folder
 *  or New collection action here. */
export function CollectionsFooter() {
  const openOverlay = useAppStore((state) => state.openOverlay);
  return (
    <div className="flex-none border-t border-hair p-2">
      <Button full onClick={() => openOverlay("collections")}>
        <FolderCog className="size-3.5" aria-hidden /> Manage collections
      </Button>
    </div>
  );
}
