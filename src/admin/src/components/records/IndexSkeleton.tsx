import { Workspace } from "@giga/ui/form/Workspace";
import type { IndexFrame } from "@/constants/index-frames";
import { ListGroup } from "./ListGroup";
import { ListSkeleton } from "./ListSkeleton";
import { NewRecordGroup } from "./NewRecordGroup";
import { SkeletonFields } from "./SkeletonFields";

/** An index before its data: the `New <record>` frame over shimmer rows in the form's footprint, and the list frame over
 *  shimmer list rows (`28` Wave 2). Nothing here reads a fixture or says a sentence; the pages' forms and grids replace
 *  it in Waves 3 to 5. */
export function IndexSkeleton({ frame }: { readonly frame: IndexFrame }) {
  const prefix = frame.tab;
  return (
    <Workspace>
      <NewRecordGroup id={`${prefix}-create`} icon={frame.newIcon} title={frame.newTitle}>
        <SkeletonFields count={frame.newRows} />
      </NewRecordGroup>
      <ListGroup id={`${prefix}-list`} icon={frame.listIcon} title={frame.listTitle}>
        <ListSkeleton />
      </ListGroup>
    </Workspace>
  );
}
