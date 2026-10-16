/**
 * Blank comments and, optionally, string bodies so rules scan code rather than prose. Newlines are
 * kept, so a finding's line number is the line in the real file. A small scanner rather than a
 * parser: it knows `//`, block comments, the three quote styles and regex literals (a `/` after an
 * operator or opening bracket), which is enough to keep an apostrophe inside a regex from opening
 * a phantom string.
 */
const REGEX_PRECEDERS = new Set("(,=:[!&|?{};+-*%<>~^".split(""));

export function stripNoise(text, { strings }) {
  let out = "";
  let i = 0;
  let lastSignificant = "";
  const blank = (segment) => segment.replace(/[^\n]/g, " ");

  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];

    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) {
        if (text[j] === "\\") j++;
        j++;
      }
      const literal = text.slice(i, j + 1);
      out += strings ? literal : c + blank(literal.slice(1, -1)) + c;
      i = j + 1;
      lastSignificant = c;
      continue;
    }
    if (c === "/" && (lastSignificant === "" || REGEX_PRECEDERS.has(lastSignificant))) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== "\n") {
        if (text[j] === "\\") j++;
        else if (text[j] === "[") inClass = true;
        else if (text[j] === "]") inClass = false;
        else if (text[j] === "/" && !inClass) break;
        j++;
      }
      if (text[j] === "/") {
        const literal = text.slice(i, j + 1);
        out += strings ? literal : "/" + blank(literal.slice(1, -1)) + "/";
        i = j + 1;
        lastSignificant = "/";
        continue;
      }
    }
    out += c;
    if (!/\s/.test(c)) lastSignificant = c;
    i++;
  }
  return out;
}
