/** How much work is running, for the statusbar (`28` section 7.1): channels `preparing` or `starting`, syncs running. The
 *  pages that start the work write it (Wave 3 for builds, Wave 5 for syncs); the statusbar only reads it. */
export interface WorkCounts {
  readonly preparing: number;
  readonly syncing: number;
}

export interface WorkSlice {
  work: WorkCounts;
  setWork: (patch: Partial<WorkCounts>) => void;
}

type Set = (partial: Partial<WorkSlice>) => void;
type Get = () => WorkSlice;

export const NO_WORK: WorkCounts = { preparing: 0, syncing: 0 };

export function workSlice(set: Set, get: Get): WorkSlice {
  return {
    work: NO_WORK,
    setWork: (patch) => set({ work: { ...get().work, ...patch } }),
  };
}
