import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { FolderRow } from "@/components/records/FolderRow";
import { CATEGORIES } from "@/constants/channel-copy";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import type { NewChannelDraft } from "@/lib/channel-body";
import type { FormErrors } from "@/lib/record-form";

const KINDS = [
  { value: "live", label: "Live" },
  { value: "stream", label: "Stream" },
] as const;

export interface NewChannelRowsProps {
  readonly draft: NewChannelDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<NewChannelDraft>) => void;
  readonly onKind: (kind: NewChannelDraft["kind"]) => void;
  /** Enter in a field creates. */
  readonly onEnter: () => void;
  readonly chooseReason: string | undefined;
  readonly onChoose: () => void;
}

/** The New channel rows, in the owner's order (Name first): Name, Kind, Category, then Folder for a live channel or
 *  Stream address for a stream one. The rows a kind does not use are not rendered. An info glyph on every row but Name;
 *  no placeholder. Category is a six-value select for live and free text for stream. */
export function NewChannelRows({ draft, errors, onChange, onKind, onEnter, chooseReason, onChoose }: NewChannelRowsProps) {
  const text = (key: "name" | "category" | "streamUrl", label: string, mono = false) => (
    <Input
      value={draft[key]}
      className={mono ? `${FIELD_CONTROL} font-mono` : FIELD_CONTROL}
      aria-label={label}
      aria-invalid={errors[key] !== undefined}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange({ [key]: event.target.value })}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter();
      }}
    />
  );

  return (
    <>
      <Row label="Name" tip={CHANNEL_TIPS.name} error={errors["name"]}>
        {text("name", "Name")}
      </Row>
      <Row label="Kind" tip={CHANNEL_TIPS.kind}>
        <Segmented options={KINDS} value={draft.kind} onChange={onKind} aria-label="Kind" />
      </Row>
      <Row label="Category" tip={CHANNEL_TIPS.categoryNew} error={errors["category"]}>
        {draft.kind === "live" ? (
          <Select
            value={draft.category}
            className={FIELD_CONTROL}
            aria-label="Category"
            onChange={(event) => onChange({ category: event.target.value })}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        ) : (
          text("category", "Category")
        )}
      </Row>
      {draft.kind === "live" ? (
        <FolderRow
          tip={CHANNEL_TIPS.folderNew}
          value={draft.folder}
          error={errors["folder"]}
          onChange={(folder) => onChange({ folder })}
          chooseReason={chooseReason}
          onChoose={onChoose}
          onEnter={onEnter}
        />
      ) : (
        <Row label="Stream address" tip={CHANNEL_TIPS.streamAddress} error={errors["streamUrl"]}>
          {text("streamUrl", "Stream address", true)}
        </Row>
      )}
    </>
  );
}
