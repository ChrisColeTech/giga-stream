import { Folder } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";

/** The rail icon of a collection whose folder is scanning: the folder, with the running dot on its corner. */
export function ScanningFolderIcon({ className }: { readonly className?: string }) {
  return (
    <span className="relative inline-flex flex-none">
      <Folder className={className} />
      <StatusDot state="running" className="absolute -top-0.5 -right-0.5 ring-2 ring-bg" />
    </span>
  );
}
