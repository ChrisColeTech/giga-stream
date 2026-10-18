import { SHIMMER } from "@giga/ui/lib/shimmer";
import { GateBrand } from "@/components/session/GateBrand";

/** The wall while the on-load probe runs (`34` section 4): the gate's own layout with shimmer bars where the form will be
 *  and no text, so the gate neither flashes nor jumps when the answer lands. Busy to assistive tech. */
export function RestoreWall() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Sign in to Giga Stream Admin"
      className="fixed inset-0 z-75 flex flex-col bg-bg"
    >
      <div className="absolute inset-x-0 top-0 z-1 h-10 [-webkit-app-region:drag]" />
      <div className="relative flex min-h-0 flex-1">
        <GateBrand />
        <div className="flex min-w-0 flex-1 overflow-y-auto bg-surface">
          <div className="m-auto flex w-full max-w-104 flex-col gap-4 px-6 py-12" data-restoring>
            <span className={`${SHIMMER} h-9 w-full`} />
            <span className={`${SHIMMER} h-9 w-full`} />
            <span className={`${SHIMMER} h-9 w-32`} />
          </div>
        </div>
      </div>
    </div>
  );
}
