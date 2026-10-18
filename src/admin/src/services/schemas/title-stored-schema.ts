import { z } from "zod";
import type { AdminTitleRow } from "./title-schema";

/* `GET /api/titles/stored` (`docs/41` section 3.2, `docs/03` section 7.4): one page of the stored titles, the whole store's
 * counts and the change marker. Rows stay `unknown` here so one unreadable row costs that row, not the page. */
export const InventorySchema = z.object({
  movie: z.number(),
  tv: z.number(),
  manual: z.number(),
  edited: z.number(),
  disabled: z.number(),
});

export const StoredPageLenientSchema = z.object({
  items: z.array(z.unknown()),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  inventory: InventorySchema,
  version: z.string(),
});

export type TitleInventory = z.infer<typeof InventorySchema>;

/** One stored page as the service answers it, with how many rows could not be read. */
export interface StoredPage {
  readonly items: AdminTitleRow[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly inventory: TitleInventory;
  readonly version: string;
  readonly unreadable: number;
}
