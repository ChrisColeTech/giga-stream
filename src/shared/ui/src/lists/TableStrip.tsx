import { ChevronLeft, ChevronRight, RefreshCw, type LucideIcon } from "lucide-react";
import { AllCheckbox } from "../controls/AllCheckbox";
import { ArmedButton } from "../controls/ArmedButton";
import { Button } from "../controls/Button";
import { IconButton } from "../controls/IconButton";
import { Sep } from "../layout/Sep";
import { STRIP } from "../layout/strip-class";

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

export interface TableStripProps {
  /** The strip's accessible name (`Accounts table`). */
  readonly label: string;
  /** What the list is called in the Refresh tooltip (`Refresh accounts`). */
  readonly noun: string;
  readonly refresh: StripPress;
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

/** THE SELECTION TOOLBAR of a table (`01` section 9): the list's own first row, inside its list group, holding only what
 *  acts on the list (LoRA Studio `components/library/LibraryToolbar.tsx`), drawn with LoRA Trainer's
 *  `pages/gallery/GalleryToolbar.tsx` grammar. Left, `Refresh` then a hairline and the selection verbs, the armed `Delete`
 *  last; right, the `All` checkbox and the `‹ ›` paging of a list that pages. The page's forward verb is the page
 *  toolbar's (`layout/Toolbar`), never here. No text: no count, no status. */
export function TableStrip({ label, noun, refresh, paging, selection }: TableStripProps) {
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
    </div>
  );
}
