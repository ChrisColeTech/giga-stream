import { Skeleton } from "./Skeleton";

/** Rows of skeletons in the shape of a list row: a block for the name and a shorter one beneath. */
export function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2 p-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-2">
          <Skeleton className="size-9 flex-none rounded-ctl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton style={{ width: `${70 - (index % 3) * 12}%` }} />
            <Skeleton className="opacity-60" style={{ width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
