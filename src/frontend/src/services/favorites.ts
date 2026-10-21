import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ItemRef } from "@/types/library";
import { sessionInputs } from "@/store/selectors";
import { api } from "./api";
import { routeFor } from "./persistence";
import { FavoriteSchema } from "./schemas/library-schema";

const part = (value: string): string => encodeURIComponent(value);

/** One favourite, put or taken (`03` section 3.12; `62` section 3.6). Signed in, the account's set owns it and the
 *  answer is the same shape both backends give. Signed out, the desktop keeps the fileserver's shared route; a
 *  browser has no home for favourites of its own, so the refusal is the sentence the press speaks (docs/06: a
 *  control works, or says why not) - behind the gate a browser user is signed in anyway, so only a session ended
 *  under the app can meet it. */
export async function writeFavorite(ref: ItemRef, favorite: boolean) {
  const route = routeFor("favorites", sessionInputs());
  if (route === "unavailable") throw new Error(LIBRARY_COPY.favoritesSignedOut);
  const base = route === "account" ? "/api/account/favorites" : "/api/favorites";
  return api(`${base}/${part(ref.kind)}/${part(ref.id)}`, FavoriteSchema, {
    method: favorite ? "PUT" : "DELETE",
    area: "Catalog",
  });
}
