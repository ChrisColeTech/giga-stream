import type { LibraryQuery } from "@/lib/library-query";
import { readLibrary } from "./library";
import type { LibraryPage } from "@/types/library";

export interface LibraryFirstPageSeams {
  readonly read: typeof readLibrary;
}

const SEAMS: LibraryFirstPageSeams = { read: readLibrary };
const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

/** Owns immediate first-page reads independently from the debounced search session. */
export class LibraryFirstPageController {
  private controller: AbortController | null = null;
  private generation = 0;
  private mounted = false;
  private readonly onResult: (answer: LibraryPage) => void;
  private readonly onRefusal: (error: unknown) => void;
  private readonly seams: LibraryFirstPageSeams;

  constructor(
    onResult: (answer: LibraryPage) => void,
    onRefusal: (error: unknown) => void,
    seams: LibraryFirstPageSeams = SEAMS,
  ) {
    this.onResult = onResult;
    this.onRefusal = onRefusal;
    this.seams = seams;
  }

  setup(): void {
    this.mounted = true;
  }

  cleanup(): void {
    this.mounted = false;
    this.cancel();
  }

  cancel(): void {
    this.generation += 1;
    const controller = this.controller;
    this.controller = null;
    controller?.abort();
  }

  read(query: LibraryQuery): void {
    this.cancel();
    if (!this.mounted) return;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    void this.seams.read(query, controller.signal).then((answer) => {
      if (this.isCurrent(generation, controller)) this.onResult(answer);
    }).catch((error: unknown) => {
      if (this.isCurrent(generation, controller) && !aborted(error)) this.onRefusal(error);
    }).finally(() => {
      if (this.controller === controller) this.controller = null;
    });
  }

  private isCurrent(generation: number, controller: AbortController): boolean {
    return this.mounted && this.generation === generation && this.controller === controller;
  }
}
