import { StateWord } from "@/components/records/StateWord";
import { browseStateOf } from "@/lib/title-browse";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

/** The state cell of a Browse TMDB row (`docs/47` section 4): `stored` or `deleted`, and nothing for a title TMDB has
 *  that the store lacks. */
export function TitleBrowseStateCell({ title }: { readonly title: AdminTitleRow }) {
  const state = browseStateOf(title);
  return state === null ? null : <StateWord state={state} />;
}
