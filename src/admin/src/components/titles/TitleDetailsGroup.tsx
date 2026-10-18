import { FileText, Undo2 } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { StateWord } from "@/components/records/StateWord";
import {
  ENABLED_TIP,
  GENRES_TIP,
  KIND_FIXED_TIP,
  RATING_TIP,
  REVERT_TIP,
  RUNTIME_TIP,
  STATE_TIP,
  STREAM_TIP,
  TMDB_ID_FIXED_TIP,
  TMDB_ID_TIP,
  YEAR_TIP,
} from "@/constants/title-copy";
import type { FormErrors } from "@/lib/record-form";
import type { TitleDraft } from "@/lib/title-draft";
import { isManualTitle, titleStateOf } from "@/lib/title-rows";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";
import { TitleTextRow } from "./TitleTextRow";

export interface TitleDetailsGroupProps {
  readonly detail: AdminTitleDetail;
  readonly draft: TitleDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<TitleDraft>) => void;
  /** `Revert to TMDB` in the action slot, disabled with its reason. */
  readonly revert: { readonly reason: string | undefined; readonly onPress: () => void };
}

type TextKey = "year" | "rating" | "genres" | "runtime" | "streamUrl";

/** `Details` (`37` section 4.3): Title, Kind (read-only), Year, the Enabled switch, TMDB id (editable only on a title
 *  made by hand), Rating, Genres (a comma list), Runtime (minutes, a movie only), the Stream address and the State
 *  word, read-only. `Revert to TMDB` sits in the action slot. */
export function TitleDetailsGroup({ detail, draft, errors, onChange, revert }: TitleDetailsGroupProps) {
  const manual = isManualTitle(detail);
  const text = (key: TextKey, label: string, tip: string, inputMode?: "numeric" | "decimal") => (
    <TitleTextRow
      label={label}
      tip={tip}
      value={draft[key]}
      error={errors[key]}
      inputMode={inputMode}
      onChange={(value) => onChange({ [key]: value })}
    />
  );
  const verb = (
    <Button variant="ghost" size="sm" reason={revert.reason} onClick={revert.onPress}>
      <Undo2 aria-hidden /> Revert to TMDB
    </Button>
  );

  return (
    <Group
      id="tw-details"
      icon={FileText}
      title="Details"
      action={revert.reason === undefined ? <Tooltip text={REVERT_TIP}>{verb}</Tooltip> : verb}
    >
      <TitleTextRow
        label="Title"
        value={draft.title}
        error={errors["title"]}
        onChange={(title) => onChange({ title })}
      />
      <TitleTextRow label="Kind" tip={KIND_FIXED_TIP} value={detail.kind === "movie" ? "Movie" : "Series"} readOnly />
      {text("year", "Year", YEAR_TIP, "numeric")}
      <Row label="Enabled" tip={ENABLED_TIP} error={errors["enabled"]}>
        <Toggle checked={draft.enabled} aria-label="Enabled" onChange={(enabled) => onChange({ enabled })} />
      </Row>
      <TitleTextRow
        label="TMDB id"
        tip={manual ? TMDB_ID_TIP : TMDB_ID_FIXED_TIP}
        value={draft.tmdbId}
        error={errors["tmdbId"]}
        inputMode="numeric"
        readOnly={!manual}
        onChange={(tmdbId) => onChange({ tmdbId })}
      />
      {text("rating", "Rating", RATING_TIP, "decimal")}
      {text("genres", "Genres", GENRES_TIP)}
      {detail.kind === "movie" && text("runtime", "Runtime", RUNTIME_TIP, "numeric")}
      {text("streamUrl", "Stream address", STREAM_TIP)}
      <Row label="State" tip={STATE_TIP}>
        <span className="flex h-9 items-center">
          <StateWord state={titleStateOf(detail)} />
        </span>
      </Row>
    </Group>
  );
}
