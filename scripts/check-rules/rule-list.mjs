import { bannedCode } from "./rules/banned-code.mjs";
import { frontendStructure } from "./rules/frontend-structure.mjs";
import { importBoundaries } from "./rules/import-boundaries.mjs";
import { sizeAndNaming } from "./rules/size-and-naming.mjs";
import { transportAndRoutes } from "./rules/transport-and-routes.mjs";
import { typeScale } from "./rules/type-scale.mjs";

/** The registry, in the order findings are reported. Adding a rule means adding it here. */
export const RULES = [
  sizeAndNaming,
  bannedCode,
  importBoundaries,
  transportAndRoutes,
  frontendStructure,
  typeScale,
];
