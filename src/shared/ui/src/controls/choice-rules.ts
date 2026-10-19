/**
 * Repository compliance limits for fixed peer-mode controls. `Segmented` is only for two short, fixed peers, with no
 * catch-all or dynamic option. Supplied multi-choice uses a checklist. `ChipsInput` tokens and `TabPill` navigation are
 * exempt. These constants support inventory tests; `Segmented` does not enforce them while existing consumers migrate.
 */
export const SEGMENTED_OPTION_COUNT = 2
export const MAX_SEGMENTED_PAIRS_PER_GROUP = 1
export const MAX_SEGMENTED_PAIRS_PER_PAGE = 2
