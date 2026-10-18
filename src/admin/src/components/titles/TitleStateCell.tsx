import { Tooltip } from "@giga/ui/form/Tooltip";
import { StateWord } from "@/components/records/StateWord";
import { titleRow } from "@/lib/title-rows";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

/** The state cell of a title row: the word (`edited`, `disabled`, `manual`...), with the `edited` tip naming the edited
 *  fields when there are any. */
export function TitleStateCell({ title }: { readonly title: AdminTitleRow }) {
  const row = titleRow(title);
  const word = <StateWord state={row.state} />;
  return row.stateTip === undefined ? word : <Tooltip text={row.stateTip}>{word}</Tooltip>;
}
