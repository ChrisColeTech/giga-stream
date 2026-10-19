import type { ReactNode } from "react";
import { Select } from "@giga/ui/controls/Select";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Actions } from "@giga/ui/form/Actions";
import { Tooltip } from "@giga/ui/form/Tooltip";
import type { ToggleVerb } from "@/lib/preview-verbs";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

export interface ProviderPreviewToolbarProps {
  readonly verbs: { readonly enabled: ToggleVerb; readonly toggleEnabled: () => void };
  /** The stored titles the app holds, in the list's own order. */
  readonly rows: readonly AdminTitleRow[];
  /** The id the window shows (the choice resolved); undefined while there is none to show. */
  readonly value: string | undefined;
  /** Why the `Title` select cannot be used now; undefined when it works. */
  readonly reason: string | undefined;
  readonly onChoose: (titleId: string) => void;
}

const FLAT = "flex-none";
const LABEL = "text-xs text-muted";
const SELECT_LABEL = "Title";

/** The family Toggle with its plain label beside it, the label part of the control's hit target (the channels'
 *  `labelled` pattern): a press on the words flips the switch too. A switch that cannot be flipped now is natively
 *  disabled, and its reason rides the wrapper tooltip - the browser drops a disabled control's own `title`. Not
 *  exported. */
function labelled(verb: ToggleVerb, onFlip: () => void): ReactNode {
  const control = (
    <label className={`flex flex-none items-center gap-1.5 ${verb.reason === undefined ? "cursor-pointer" : ""}`}>
      <Toggle
        checked={verb.checked}
        aria-label="Enabled"
        title={verb.reason === undefined ? verb.title : undefined}
        disabled={verb.reason !== undefined}
        onChange={() => onFlip()}
      />
      <span className={LABEL}>Enabled</span>
    </label>
  );
  return verb.reason === undefined ? (
    control
  ) : (
    <Tooltip text={verb.reason} focusable label={`Enabled. ${verb.reason}`} className={FLAT}>
      {control}
    </Tooltip>
  );
}

/** The `Title` select with its label before it (a field's grammar, `36` section 8.1's strip): the window's chosen title,
 *  the stored movies the app holds as its options. Disabled with its reason on the wrapper tooltip. Not exported. */
function titleSelect(props: ProviderPreviewToolbarProps): ReactNode {
  const control = (
    <label className="flex flex-none items-center gap-1.5">
      <span className={LABEL}>{SELECT_LABEL}</span>
      <Select
        aria-label={SELECT_LABEL}
        className="w-44 flex-none"
        value={props.value ?? ""}
        disabled={props.reason !== undefined}
        onChange={(event) => props.onChoose(event.currentTarget.value)}
      >
        {props.rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.title}
          </option>
        ))}
      </Select>
    </label>
  );
  return props.reason === undefined ? (
    control
  ) : (
    <Tooltip text={props.reason} focusable label={`${SELECT_LABEL}. ${props.reason}`} className={FLAT}>
      {control}
    </Tooltip>
  );
}

/** The provider preview's toolbar (`55` decision 7), the shared pinned `Actions` strip directly under the header: LEFT,
 *  the provider's own `Enabled` labelled switch, then the `Title` select - choosing one builds the frame's address from
 *  the provider's movie template filled with that title's TMDB id and reloads the frame. Nothing right (no walk: the
 *  choice is the window's own). The state word and the chosen title's name are the status bar's, never here. */
export function ProviderPreviewToolbar(props: ProviderPreviewToolbarProps) {
  return (
    <Actions
      pinned
      left={
        <>
          {labelled(props.verbs.enabled, props.verbs.toggleEnabled)}
          {titleSelect(props)}
        </>
      }
    >
      {null}
    </Actions>
  );
}