import type { LibraryQuery } from "@/lib/library-query";
import { LibrarySearchSession } from "./library";

/** Owns one mounted search session. A replay creates a new generation owner before another read can start. */
export class LibrarySearchLifecycle {
  private session: LibrarySearchSession | null = null;
  private readonly createSession: () => LibrarySearchSession;

  constructor(createSession: () => LibrarySearchSession) {
    this.createSession = createSession;
  }

  setup(): void {
    this.session?.cancel();
    this.session = this.createSession();
  }

  cleanup(): void {
    const session = this.session;
    this.session = null;
    session?.cancel();
  }

  search(query: LibraryQuery): void {
    this.session?.search(query);
  }

  readNow(query: LibraryQuery): void {
    this.session?.readNow(query);
  }
}
