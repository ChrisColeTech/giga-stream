import { Button } from "@/components/ui/Button";
import { ROWS_COPY } from "./rows-constants";

export interface ShelfHeadingProps {
  readonly name: string;
  readonly count: number;
  readonly onSeeAll: () => void;
}

/** A shelf's heading (`06` section 4, Rows): the name, its count in mono, and See all at the right end. */
export function ShelfHeading({ name, count, onSeeAll }: ShelfHeadingProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-3">
      <h2 className="m-0 min-w-0 truncate font-sans text-[13px] leading-5 font-bold text-text">{name}</h2>
      <span className="flex-none font-mono text-[11px] leading-5 text-dim">{count}</span>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto flex-none"
        title={ROWS_COPY.showInGrid(name)}
        aria-label={`${ROWS_COPY.seeAll} ${name}`}
        onClick={onSeeAll}
      >
        {ROWS_COPY.seeAll}
      </Button>
    </div>
  );
}
