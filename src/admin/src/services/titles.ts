import { notConnected } from "./not-connected";
import type { AdminTitleRow, TitleList } from "./schemas/title-schema";
import type { RecordService } from "./service-types";

/** The Titles routes (`29` section 9.3); a list takes `{ page, search, kinds, sort }`. NOT CONNECTED: refuses until the
 *  Titles worker wires it. */
export type TitlesService = RecordService<AdminTitleRow, string, TitleList>;

export const titles: TitlesService = {
  list: () => notConnected("titles.list"),
  create: () => notConnected("titles.create"),
  update: () => notConnected("titles.update"),
  remove: () => notConnected("titles.remove"),
};
