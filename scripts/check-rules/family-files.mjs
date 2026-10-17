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

const ROOT = "src/frontend/src/";

export const FAMILY_FILES = new Set([
  `${ROOT}constants/motion.ts`,
  `${ROOT}types/menu.ts`,
  ...UI.map((name) => `${ROOT}components/ui/${name}.tsx`),
]);

/** True when a repo-relative path is a family-verbatim file. */
export function isFamilyFile(rel) {
  return FAMILY_FILES.has(rel);
}
