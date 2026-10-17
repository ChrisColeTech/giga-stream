import type { ItemRef } from "@/types/library";
import { api } from "./api";
import { FavoriteSchema } from "./schemas/library-schema";

const part = (value: string): string => encodeURIComponent(value);

export function writeFavorite(ref: ItemRef, favorite: boolean) {
  return api(`/api/favorites/${part(ref.kind)}/${part(ref.id)}`, FavoriteSchema, {
    method: favorite ? "PUT" : "DELETE",
    area: "Catalog",
  });
}
