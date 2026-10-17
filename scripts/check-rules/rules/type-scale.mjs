import { lineAt } from "../load-files.mjs";

/**
 * The type scale belongs to the family components (`docs/23` section 4, wave 6). A surface file - anything in the
 * frontend's components or pages outside `components/ui` - sets no arbitrary pixel text size (`text-[13px]`); it uses
 * the family components, or the scale's own steps (`text-xs`, `text-sm`), which is how LoRA Studio's own surfaces do it.
 * `code` keeps strings, where class names live, and blanks comments, which may quote a class. The admin backend is
 * held to the same scale: any `.tsx` it gains is a surface (it has no family ui layer). It has none today.
 */
const ARBITRARY_SIZE = /\btext-\[\d+(?:\.\d+)?px\]/g;
const SURFACE = /^src\/frontend\/src\/(components|pages)\/|^src\/backend\/.*\.tsx$/;

/** Surface files that copy a LoRA surface's classes verbatim, arbitrary size included. Each names its source. */
const VERBATIM = new Set([
  "src/frontend/src/components/settings/SettingsRail.tsx", // LoRA components/settings/SettingsOverlay.tsx NAV_BUTTON
]);

export const typeScale = {
  id: "type-scale",
  check(files) {
    const findings = [];
    for (const file of files) {
      if (file.isTest || !SURFACE.test(file.rel)) continue;
      if (file.rel.startsWith("src/frontend/src/components/ui/") || VERBATIM.has(file.rel)) continue;
      for (const match of file.code.matchAll(ARBITRARY_SIZE)) {
        findings.push({
          file: file.rel,
          line: lineAt(file.code, match.index),
          message: `${match[0]} is off the type scale; use a family component or text-xs / text-sm (docs/23 wave 6)`,
        });
      }
    }
    return findings;
  },
};
