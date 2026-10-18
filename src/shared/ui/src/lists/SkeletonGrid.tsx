import { useContext } from "react";
import { GridShapeContext } from "./record-grid-layout";
import { RecordGridSkeletonRow } from "./RecordGridSkeletonRow";

/** A list's rows while it loads, or while it is empty: 36px rows in the header's OWN column set (a tick-sized tile where
 *  the tick is, then one shimmer per data track), so the rows land where these stood. No sentence sits over it. Inside a
 *  `RecordGrid`, in place of its rows. */
export function SkeletonGrid({ rows = 6 }: { readonly rows?: number }) {
  const shape = useContext(GridShapeContext);
  if (shape === null) throw new Error("SkeletonGrid belongs inside a RecordGrid");
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <RecordGridSkeletonRow key={row} seed={row} />
      ))}
    </>
  );
}
