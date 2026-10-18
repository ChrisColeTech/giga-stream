/* The shape every record service shares (`29` sections 8 and 9): list, create, update, remove. A page calls these and
 * nothing else; whether the body is a real call or a not-connected stub is the service's affair. Inputs are the request
 * bodies of `29` section 9, as loose records until the tab's worker narrows them with the form's own types. */
export type RecordInput = Readonly<Record<string, unknown>>;

export interface ListAnswer<T> {
  readonly items: readonly T[];
}

export interface RecordService<T, Id extends string | number, List extends ListAnswer<T> = ListAnswer<T>> {
  /** The whole list (titles take `{ page, search, kinds, sort }`). */
  list: (query?: RecordInput) => Promise<List>;
  create: (input: RecordInput) => Promise<T>;
  /** Only the changed fields. */
  update: (id: Id, patch: RecordInput) => Promise<T>;
  remove: (id: Id) => Promise<{ readonly id: Id }>;
}
