import { UNANSWERED, type ShelfLoad, type ShelfLoads } from "@/lib/rows-reveal";
import type { LibraryQuery } from "@/lib/library-query";
import type { ShelfSpec } from "@/lib/rows-shelves";
import type { LibraryItem, LibraryPage } from "@/types/library";
import { libraryRowIdentity } from "./library";

export interface RowsReaderSeams {
  /** `readLibrary` (the one request layer); a seam for tests. */
  readonly read: (query: LibraryQuery, signal?: AbortSignal, cursor?: string) => Promise<LibraryPage>;
  /** Keeps the rows a page brought, for the work windows that look titles up. */
  readonly remember: (items: readonly LibraryItem[]) => void;
  /** Says a failure's sentence. */
  readonly say: (sentence: string) => void;
}

const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";
const sentence = (error: unknown): string => error instanceof Error ? error.message : "Library could not be read.";

/** `current` with the rows of `next` it does not hold yet, in order: a shown card never moves. */
export function appendRows(current: readonly LibraryItem[], next: readonly LibraryItem[]): LibraryItem[] {
  const seen = new Set(current.map(libraryRowIdentity));
  const appended = next.filter((item) => {
    const identity = libraryRowIdentity(item);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  return [...current, ...appended];
}

/** The reads of one Rows plan (`docs/33` section 2.2): every shelf's first page at once, then one next page per shelf
 *  at a time, on request. `start` and `cancel` abort the plan's reads, and a late answer of an older plan is ignored.
 *  Every change is handed to `onChange` as a new map. */
export class RowsReader {
  private loads = new Map<string, ShelfLoad>();
  private specs: readonly ShelfSpec[] = [];
  private controller: AbortController | null = null;
  private generation = 0;
  private said = false;
  private readonly onChange: (loads: ShelfLoads) => void;
  private readonly seams: RowsReaderSeams;

  constructor(onChange: (loads: ShelfLoads) => void, seams: RowsReaderSeams) {
    this.onChange = onChange;
    this.seams = seams;
  }

  start(specs: readonly ShelfSpec[]): void {
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.specs = specs;
    this.said = false;
    this.loads = new Map(specs.map((spec) => [spec.id, UNANSWERED]));
    this.emit();
    for (const spec of specs) {
      this.seams.read(spec.query, controller.signal).then(
        (page) => this.land(generation, spec.id, page, false),
        (error: unknown) => this.fail(generation, spec.id, error),
      );
    }
  }

  /** Asks for a shelf's next page; answers whether one really was asked for. */
  more(id: string): boolean {
    const load = this.loads.get(id);
    const spec = this.specs.find((candidate) => candidate.id === id);
    const controller = this.controller;
    if (load === undefined || spec === undefined || controller === null) return false;
    if (!load.answered || load.paging || load.nextCursor === undefined) return false;
    const generation = this.generation;
    this.set(id, { ...load, paging: true });
    this.seams.read(spec.query, controller.signal, load.nextCursor).then(
      (page) => this.land(generation, id, page, true),
      (error: unknown) => this.fail(generation, id, error),
    );
    return true;
  }

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }

  private land(generation: number, id: string, page: LibraryPage, append: boolean): void {
    const load = this.loads.get(id);
    if (generation !== this.generation || load === undefined) return;
    this.seams.remember(page.items);
    const total = page.total ?? load.total;
    this.set(id, {
      items: append ? appendRows(load.items, page.items) : page.items,
      ...(total !== undefined && { total }),
      ...(page.nextCursor !== undefined && { nextCursor: page.nextCursor }),
      answered: true,
      paging: false,
    });
  }

  /* A failed first page answers empty (the shelf is not shown); a failed next page ends the shelf where it is, so the
     same cursor is never asked again in a loop. The plan says one sentence however many shelves fail. */
  private fail(generation: number, id: string, error: unknown): void {
    const load = this.loads.get(id);
    if (generation !== this.generation || load === undefined || aborted(error)) return;
    this.set(id, { items: load.items, ...(load.total !== undefined && { total: load.total }), answered: true, paging: false });
    if (!this.said) {
      this.said = true;
      this.seams.say(sentence(error));
    }
  }

  private set(id: string, load: ShelfLoad): void {
    this.loads.set(id, load);
    this.emit();
  }

  private emit(): void {
    this.onChange(new Map(this.loads));
  }
}
