import { bannedCode } from "./rules/banned-code.mjs";
import { frontendStructure } from "./rules/frontend-structure.mjs";
import { frontendFileserverOnly } from "./rules/frontend-fileserver-only.mjs";
import { importBoundaries } from "./rules/import-boundaries.mjs";
import { noCacheTimers } from "./rules/no-cache-timers.mjs";
import { sharedUiConsumption } from "./rules/shared-ui-consumption.mjs";
import { sizeAndNaming } from "./rules/size-and-naming.mjs";
import { transportAndRoutes } from "./rules/transport-and-routes.mjs";
import { typeScale } from "./rules/type-scale.mjs";

/** The registry, in the order findings are reported. Adding a rule means adding it here. */
export const RULES = [
  sizeAndNaming,
  bannedCode,
  importBoundaries,
  frontendFileserverOnly,
  transportAndRoutes,
  frontendStructure,
  typeScale,
  sharedUiConsumption,
  noCacheTimers,
];
