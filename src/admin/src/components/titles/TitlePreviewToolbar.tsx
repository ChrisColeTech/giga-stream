import type { ReactNode } from "react";
import { Select } from "@giga/ui/controls/Select";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Actions } from "@giga/ui/form/Actions";
import { Tooltip } from "@giga/ui/form/Tooltip";
import type { ToggleVerb } from "@/lib/preview-verbs";
import type { TitleSourceView } from "@/lib/title-preview-state";

export interface TitlePreviewToolbarProps {
  readonly verbs: { readonly enabled: ToggleVerb; readonly toggleEnabled: () => void };
  /** The title's available sources, the backend's order. */
  readonly rows: readonly TitleSourceView[];
  /** The source the window shows (the choice resolved); undefined while there is none to show. */
  readonly value: string | undefined;
  /** Why the `Provider` select cannot be used now; undefined when it works. */
  readonly reason: string | undefined;
  readonly onChoose: (sourceId: string) => void;
}

const FLAT = "flex-none";
const LABEL = "text-xs text-muted";
const SELECT_LABEL = "Provider";

/** The family Toggle with its plain label beside it, the label part of the control's hit target (the channels'
 *  `labelled` pattern). A switch that cannot be flipped now is natively disabled, and its reason rides the wrapper
 *  tooltip - the browser drops a disabled control's own `title`. Not exported. */
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

/** The `Provider` select with its label before it (a field's grammar, `36` section 8.1's strip): the window's chosen
 *  source - the "change the provider source" the owner asked for. Disabled with its reason on the wrapper tooltip. Not
 *  exported. */
function providerSelect(props: TitlePreviewToolbarProps): ReactNode {
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
            {row.name}
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

/** The title preview's toolbar (`55` decision 8), the shared pinned `Actions` strip directly under the header: LEFT, the
 *  title's own `Enabled` labelled switch, then the `Provider` select of its available sources - choosing one loads that
 *  source's address and follows its origins in the window's policy. Nothing right. The state word and the chosen
 *  source's name are the status bar's, never here. */
export function TitlePreviewToolbar(props: TitlePreviewToolbarProps) {
  return (
    <Actions
      pinned
      left={
        <>
          {labelled(props.verbs.enabled, props.verbs.toggleEnabled)}
          {providerSelect(props)}
        </>
      }
    >
      {null}
    </Actions>
  );
}