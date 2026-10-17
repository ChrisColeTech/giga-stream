import { Skeleton } from "@/components/ui/Skeleton";
import { SKELETON_SHELF_CARDS, SKELETON_SHELVES } from "./rows-constants";

/** The Rows view while it has nothing to show: shelves of card skeletons in the shape of their heading and row. No
 *  sentence sits over it. */
export function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-3 pt-3" aria-hidden>
      {Array.from({ length: SKELETON_SHELVES }, (_, shelf) => (
        <div key={shelf} className="flex min-w-0 flex-col gap-2.5">
          <Skeleton style={{ width: "140px" }} />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: SKELETON_SHELF_CARDS }, (_, card) => (
              <div key={card} className="flex w-40 flex-none flex-col gap-1.5">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-card">
                  <Skeleton className="absolute inset-0 rounded-card" />
                </div>
                <Skeleton style={{ width: "80%" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
