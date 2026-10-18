/** A running job's bar (`28` Appendix A row 36): 48px, full and pulsing, because a sync's progress is unknown. It sits
 *  beside the state word `running`; it is decoration, the word says it. */
export function RunningBar() {
  return (
    <span className="relative inline-block h-1.5 w-12 flex-none overflow-hidden rounded-full bg-surface" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-accent animate-pulse-busy" />
    </span>
  );
}
