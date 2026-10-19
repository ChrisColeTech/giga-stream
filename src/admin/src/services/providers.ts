import { request } from "./api";
import {
  ProviderDeletedSchema,
  ProviderListLenientSchema,
  ProviderSchema,
  type AdminProvider,
  type ProviderList,
} from "./schemas/provider-schema";
import type { RecordService } from "./service-types";

/** The Providers routes (`37` section 3.1), REAL: `GET`, `POST`, **`PUT`** and `DELETE /api/admin/providers`. The backend
 *  registers the save as `PUT` with partial semantics (absent keeps, `null` clears an optional field), so `update`
 *  sends the method itself. A `422 provider.invalid` arrives as an `ApiError` naming its field. The list is read row
 *  by row: an unreadable row is dropped and counted (`unreadable`). */
export type ProvidersService = RecordService<AdminProvider, number, ProviderList>;

const path = (id: number): string => `/api/admin/providers/${encodeURIComponent(String(id))}`;

async function list(): Promise<ProviderList> {
  const answer = await request("/api/admin/providers", ProviderListLenientSchema);
  const items: AdminProvider[] = [];
  for (const row of answer.items) {
    const parsed = ProviderSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, unreadable: answer.items.length - items.length };
}

export const providers: ProvidersService = {
  list,
  create: (input) => request("/api/admin/providers", ProviderSchema, { method: "POST", body: input, area: "Provider" }),
  update: (id, patch) => request(path(id), ProviderSchema, { method: "PUT", body: patch, area: "Provider" }),
  remove: (id) => request(path(id), ProviderDeletedSchema, { method: "DELETE", area: "Provider" }),
};
