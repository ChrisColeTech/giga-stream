import { ChevronLeft, ChevronRight, RefreshCw, type LucideIcon } from "lucide-react";
import { AllCheckbox } from "../controls/AllCheckbox";
import { ArmedButton } from "../controls/ArmedButton";
import { Button } from "../controls/Button";
import { IconButton } from "../controls/IconButton";

/** One verb of the strip: a ghost word with its icon first (`01` section 9, Icon vocabulary), or the word alone when the
 *  family has no icon for it. With a `question` it is the inline two-step instead (`ArmedButton`: the word at rest, the
 *  danger question once armed, never an icon). A `reason` leaves it in place, natively disabled, with the reason as its
 *  focusable tooltip. */
export interface StripVerb {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly onPress: () => void;
  readonly reason?: string;
  readonly question?: string;
}

export interface StripPress {
  readonly onPress: () => void;
  readonly reason?: string;
}

/** The page's ONE forward verb: the destination's word (`Titles`), drawn with `→`, and a tooltip saying what it does. */
export interface StripForward extends StripPress {
  readonly word: string;
  readonly tip: string;
}

export interface TableStripProps {
  /** The strip's accessible name (`Accounts table`). */
  readonly label: string;
  /** What the list is called in the Refresh tooltip (`Refresh accounts`). */
  readonly noun: string;
  readonly refresh: StripPress;
  /** The page's ONE forward verb, drawn rightmost as its word and `→` (`Titles →`). */
  readonly forward?: StripForward;
  /** A list that still pages: `Newer` before `Older`, each disabled with its reason at the end it cannot go. */
  readonly paging?: { readonly newer: StripPress; readonly older: StripPress };
  /** A list whose rows are ticked: the verbs on the ticked rows, always drawn (each disabled with its reason while none
   *  is ticked), and the three-state `All` over the listed rows. */
  readonly selection?: {
    readonly verbs: readonly StripVerb[];
    readonly all: {
      /** `Select all channels`: the accessible name; the word shown is `All`. */
      readonly label: string;
      readonly checked: boolean | "mixed";
      readonly onToggle: (checked: boolean) => void;
      /** Nothing is listed yet. */
      readonly disabled?: boolean;
    };
  };
}

export const REFRESH_WORD = "Refresh";
export const FORWARD_ARROW = "→";

const STRIP = "flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2";

/** A hairline between the strip's clusters (LoRA Trainer `components/layout/Toolbar.tsx` `Sep`). */
function Sep() {
  return <span className="mx-1 h-5 w-px flex-none bg-hair" aria-hidden />;
}

function Verb({ verb }: { readonly verb: StripVerb }) {
  if (verb.question !== undefined && verb.reason === undefined) {
    return (
      <ArmedButton question={verb.question} onConfirm={verb.onPress}>
        {verb.label}
      </ArmedButton>
    );
  }
  const Glyph = verb.question === undefined ? verb.icon : undefined;
  return (
    <Button size="sm" variant="ghost" reason={verb.reason} onClick={verb.onPress}>
      {Glyph !== undefined && <Glyph aria-hidden />}
      {verb.label}
    </Button>
  );
}

function Step({ press, label, glyph: Glyph }: { readonly press: StripPress; readonly label: string; readonly glyph: LucideIcon }) {
  return (
    <IconButton aria-label={label} title={label} reason={press.reason} onClick={press.onPress}>
      <Glyph aria-hidden />
    </IconButton>
  );
}

/** THE SELECTION TOOLBAR of a table (`01` section 9; LoRA Trainer `pages/gallery/GalleryToolbar.tsx`): the one strip
 *  directly above the table, inside its list group. Left, `Refresh` then a hairline and the selection verbs, the armed
 *  `Delete` last; right, the `All` checkbox, the `‹ ›` paging of a list that pages, a hairline and the forward verb
 *  rightmost. No text: no count, no status (the count is in the armed question, the outcome on the notice line). */
export function TableStrip({ label, noun, refresh, forward, paging, selection }: TableStripProps) {
  const verbs = selection?.verbs ?? [];
  return (
    <div role="toolbar" aria-label={label} className={STRIP}>
      <Button size="sm" variant="ghost" title={`${REFRESH_WORD} ${noun}`} reason={refresh.reason} onClick={refresh.onPress}>
        <RefreshCw aria-hidden />
        {REFRESH_WORD}
      </Button>
      {verbs.length > 0 && <Sep />}
      {verbs.map((verb) => (
        <Verb key={verb.id} verb={verb} />
      ))}
      <span className="min-w-0 flex-1" aria-hidden />
      {selection !== undefined && (
        <AllCheckbox
          checked={selection.all.checked}
          onChange={selection.all.onToggle}
          aria-label={selection.all.label}
          disabled={selection.all.disabled}
        />
      )}
      {paging !== undefined && (
        <>
          <Step press={paging.newer} label="Newer" glyph={ChevronLeft} />
          <Step press={paging.older} label="Older" glyph={ChevronRight} />
        </>
      )}
      {forward !== undefined && (
        <>
          <Sep />
          <Button
            size="sm"
            variant="ghost"
            aria-label={forward.tip}
            title={forward.tip}
            reason={forward.reason}
            onClick={forward.onPress}
          >
            {forward.word} {FORWARD_ARROW}
          </Button>
        </>
      )}
    </div>
  );
}
