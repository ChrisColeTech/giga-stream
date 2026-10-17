import { Segmented } from "@/components/ui/Segmented";
import { SCOPE_OPTIONS } from "@/lib/library-copy";
import type { Scope } from "@/lib/library-query";

export interface TypeStripProps {
  readonly scope: Scope;
  readonly onScope: (scope: Scope) => void;
}

/** The type strip above the grid: All, Movies, TV, Local in equal segments, in the flex-none strip with a bottom border. */
export function TypeStrip({ scope, onScope }: TypeStripProps) {
  return (
    <div className="flex flex-none items-center border-b border-hair px-3 py-2">
      <Segmented<Scope>
        aria-label="Type"
        options={SCOPE_OPTIONS}
        value={scope}
        onChange={onScope}
        className="h-9 w-full [&>button]:h-full [&>button]:basis-0"
      />
    </div>
  );
}
