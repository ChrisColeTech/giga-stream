/**
 * The files copied verbatim from Giga LoRA Studio (`docs/23` section 3.1). They are the family's, so they keep the
 * family's shape: the size ceiling and the one-component-per-file rule skip them. Every other rule still applies.
 * A file joins this list only when `docs/23` section 3.1 lists it.
 */
const UI = [
  "ActionList",
  "AppIcon",
  "Button",
  "ChipGroup",
  "ChipsInput",
  "ContextMenu",
  "ContextMenuRow",
  "ContextMenuSubmenu",
  "Field",
  "Form",
  "IconButton",
  "InlineLink",
  "NavRail",
  "NumberField",
  "NumericInput",
  "Reveal",
  "Section",
  "Segmented",
  "SkeletonCards",
  "SkeletonRows",
  "SliderField",
  "SplitList",
  "Toggle",
  "Tooltip",
];

/*
 * The admin's copies of the same files (the template's clone, docs/27 section 6.3) are family files too until the
 * step that deletes each one. The list shrinks as steps move files into src/shared/ui; step 3 retires it.
 */
const ROOTS = ["src/frontend/src/", "src/admin/src/"];

export const FAMILY_FILES = new Set([
  ...ROOTS.flatMap((root) => [`${root}constants/motion.ts`, `${root}types/menu.ts`]),
  ...ROOTS.flatMap((root) => UI.map((name) => `${root}components/ui/${name}.tsx`)),
]);

/** True when a repo-relative path is a family-verbatim file. */
export function isFamilyFile(rel) {
  return FAMILY_FILES.has(rel);
}
