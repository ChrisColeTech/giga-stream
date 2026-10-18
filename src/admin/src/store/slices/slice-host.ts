/** What a tab slice's factory is given: the store's `set` and `get`, narrowed to the slice's own fields. A slice reads and
 *  writes only what it declares, so two tabs' slices can never touch each other's state (`39` section 5). */
export type SliceSet<S> = (partial: Partial<S>) => void;
export type SliceGet<S> = () => S;
