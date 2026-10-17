export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  /** The tab's tooltip when it works (the admin's `Channels (Ctrl+1)`). */
  readonly title?: string;
}

export interface TabPillProps<T extends string> {
  /** The group's accessible name, e.g. "Surfaces". */
  readonly label: string;
  /** The tabs in order. */
  readonly items: readonly TabItem<T>[];
  readonly active: T;
  /** True while an overlay covers the pages: the tabs go asleep AND de-lit, and the pressed look comes back where it was
   *  when the overlay lifts. */
  readonly disabled?: boolean;
  /** Why the tabs are asleep. Disabled tabs take no pointer events, so the reason hangs on the track. */
  readonly disabledReason?: string;
  readonly onSelect: (id: T) => void;
}

/* THE NAV: a RECESSED TRACK HOLDING RAISED CHIPS, the same control vocabulary as Segmented, Button and IconButton. An
 * equal-width grid, not a flex row: flex sizes each tab to its label, so one tab came out narrower than its neighbour
 * and the nav read as ragged chips. Every tab is the width of the longest. */
const NAV =
  "absolute top-1/2 left-1/2 inline-grid -translate-x-1/2 -translate-y-1/2 auto-cols-fr grid-flow-col gap-0.5 " +
  "rounded-[9px] border border-ctl-edge bg-surface p-0.5 font-sans text-xs [-webkit-app-region:no-drag]";

const TAB =
  /* Sentence case, no transform. */
  "cursor-pointer rounded-[6px] border-0 bg-transparent px-3.25 py-1 text-center text-muted " +
  "transition-[background,color,box-shadow] duration-fade ease-linear " +
  "not-disabled:hover:text-text not-data-active:not-disabled:active:bg-hov " +
  /* Chrome asleep under an overlay should simply be inert: not a forbidding cursor. */
  "disabled:pointer-events-none disabled:cursor-default disabled:opacity-45 " +
  "data-active:bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] " +
  "data-active:font-semibold data-active:text-accent-text " +
  "data-active:shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)]";

export function TabPill<T extends string>({ label, items, active, disabled = false, disabledReason, onSelect }: TabPillProps<T>) {
  return (
    <nav className={NAV} aria-label={label} title={disabled ? disabledReason : undefined}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={TAB}
          title={disabled ? undefined : item.title}
          disabled={disabled}
          data-active={!disabled && item.id === active ? "" : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
