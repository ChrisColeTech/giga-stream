import { cn } from "@/lib/cn";

/** The family's disclosure mark: a FILLED triangle for every expand and collapse (a group, a tree row), pointing down
 *  when open and right when folded. Unfilled chevrons are for buttons that open a menu. */
export function Disclosure({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className={cn("size-3 flex-none transition-transform duration-fast ease-linear", !open && "-rotate-90", className)}
    >
      <path d="M2 3.5h8L6 9.5z" fill="currentColor" />
    </svg>
  );
}
