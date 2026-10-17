import { Folder } from "lucide-react";

/** A collection's glyph in the rail. */
export function FolderGlyph({ className }: { className?: string }) {
  return <Folder className={className} aria-hidden />;
}
