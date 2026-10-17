/** One program's user sentences by dotted code (`01` section 4.1). The program supplies its table;
 *  the library holds none. */
export type SentenceTable = Readonly<Record<string, string>>;

export const FALLBACK_SENTENCE = "The request failed.";

/** The server's own sentence when it sent one, else the program's sentence for the code, else a plain fallback. */
export function errorSentence(table: SentenceTable, code: string, serverSentence?: string): string {
  return serverSentence?.trim() || table[code] || FALLBACK_SENTENCE;
}
