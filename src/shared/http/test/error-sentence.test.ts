import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorSentence } from "../src/error-sentence";

const TABLE = { "title.not_found": "That title could not be found." };

describe("errorSentence", () => {
  it("prefers the server's own sentence, trimmed", () => {
    assert.equal(errorSentence(TABLE, "title.not_found", "  Gone.  "), "Gone.");
  });

  it("falls back to the program's table, then to the plain fallback", () => {
    assert.equal(errorSentence(TABLE, "title.not_found"), "That title could not be found.");
    assert.equal(errorSentence(TABLE, "x.unknown"), "The request failed.");
    assert.equal(errorSentence(TABLE, "title.not_found", "   "), "That title could not be found.");
  });
});
