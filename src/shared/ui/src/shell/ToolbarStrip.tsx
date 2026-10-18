import { ArmedButton } from "../controls/ArmedButton";
import { Button, type ButtonVariant } from "../controls/Button";

/** How a verb is drawn: `ghost` for the quiet one (Discard changes), `edged` for the stock raised button (Save),
 *  `filled` for the one forward verb in the accent. */
export type ToolbarTone = "ghost" | "edged" | "filled";

export interface ToolbarVerb {
  readonly id: string;
  readonly label: string;
  readonly tone: ToolbarTone;
  readonly onPress: () => void;
  /** Why the verb cannot be used now; the verb stays in place, disabled, with this as its tooltip. */
  readonly reason?: string;
  /** Present, the verb is an inline two-step (`ArmedButton`): the first press turns it into this question naming what
   *  dies, the second within the timeout runs `onPress`. Ghost at rest whatever the tone; disabled, the reason is its
   *  tooltip. */
  readonly question?: string;
}

export interface ToolbarStripProps {
  /** The strip's accessible name. */
  readonly label: string;
  /** Right-aligned, in order. An empty list still draws the strip, so the page below does not move between pages. */
  readonly verbs: readonly ToolbarVerb[];
}

const VARIANT: Readonly<Record<ToolbarTone, ButtonVariant>> = { ghost: "ghost", edged: "default", filled: "primary" };

/** THE TOOLBAR STRIP: 40px on the panel under the titlebar, the page's verbs at its right edge (`28` section 4.3). One
 *  filled forward verb at most; every verb is the stock small `Button`, so its disabled look and its reason are the
 *  template's. */
export function ToolbarStrip({ label, verbs }: ToolbarStripProps) {
  return (
    <div role="toolbar" aria-label={label} className="flex h-10 flex-none items-center justify-end gap-2 border-b border-border bg-panel px-3">
      {verbs.map((verb) =>
        verb.question === undefined ? (
          <Button key={verb.id} size="sm" variant={VARIANT[verb.tone]} reason={verb.reason} onClick={verb.onPress}>
            {verb.label}
          </Button>
        ) : (
          <ArmedButton
            key={verb.id}
            question={verb.question}
            onConfirm={verb.onPress}
            disabled={verb.reason !== undefined}
            title={verb.reason}
          >
            {verb.label}
          </ArmedButton>
        ),
      )}
    </div>
  );
}
