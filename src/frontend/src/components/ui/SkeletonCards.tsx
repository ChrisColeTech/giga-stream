import { Skeleton } from "./Skeleton";

/** Poster-card skeletons: a 2:3 picture block over two text bands, the shape of a card in the library grid. */
export function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-1.5">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-card">
            <Skeleton className="absolute inset-0 rounded-card" />
          </div>
          <Skeleton style={{ width: "80%" }} />
          <Skeleton className="opacity-60" style={{ width: "40%" }} />
        </div>
      ))}
    </div>
  );
}
