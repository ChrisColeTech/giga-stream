import { Folder } from "lucide-react";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { StatusDot } from "@/components/ui/StatusDot";

/** A collection's glyph while a folder attached to it is being scanned: the folder with a scan dot on its corner. */
export function ScanFolderGlyph({ className }: { className?: string }) {
  return (
    <span className="relative inline-flex flex-none" title={LIBRARY_COPY.scanning}>
      <Folder className={className} aria-hidden />
      <StatusDot state="loading" className="absolute -top-0.5 -right-0.5 size-1.5" />
    </span>
  );
}
