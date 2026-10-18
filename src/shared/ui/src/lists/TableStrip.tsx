import { ChevronLeft, ChevronRight, RefreshCw, X, type LucideIcon } from "lucide-react";
import { ArmedButton } from "../controls/ArmedButton";
import { Button } from "../controls/Button";
import { IconButton } from "../controls/IconButton";

/** One verb of the strip: an icon button with a tooltip naming it. With a `question` it is the inline two-step instead
 *  (`ArmedButton`: ghost naming the verb at rest, the danger question once armed). A `reason` leaves it in place,
 *  natively disabled, with the reason as its focusable tooltip. */
export interface StripVerb {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
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
  /** Rows are ticked: the count, the bulk verbs and the way out. Absent or zero, none of it is drawn. */
  readonly selection?: {
    readonly count: number;
    readonly verbs: readonly StripVerb[];
    readonly onClear: () => void;
  };
}

export const SELECTED_WORD = "selected";
export const CLEAR_SELECTION = "Clear selection";

const STRIP = "flex min-h-9 flex-wrap items-center gap-1 border-b border-hair px-3 py-1";

function Icon({ verb }: { readonly verb: StripVerb }) {
  const Glyph = verb.icon;
  return (
    <IconButton aria-label={verb.label} title={verb.label} reason={verb.reason} onClick={verb.onPress}>
      <Glyph aria-hidden />
    </IconButton>
  );
}

function Verb({ verb }: { readonly verb: StripVerb }) {
  if (verb.question === undefined) return <Icon verb={verb} />;
  if (verb.reason !== undefined) {
    return (
      <Button size="sm" variant="ghost" reason={verb.reason}>
        {verb.label}
      </Button>
    );
  }
  return (
    <ArmedButton question={verb.question} onConfirm={verb.onPress}>
      {verb.label}
    </ArmedButton>
  );
}

/** THE TABLE STRIP: the one strip directly above a table, inside its list group, as the Library's type strip sits over its
 *  grid. At its left, while rows are ticked, the count in the strip heading style (mono 12 faint, the count dim), the bulk
 *  verbs and `Clear selection`; at its right edge the paging pair of a list that pages and `Refresh`. Icons only, each
 *  with an `aria-label` and a tooltip; the one text verb is the armed Delete. The list group's heading carries none of
 *  it, and neither does the page toolbar. */
export function TableStrip({ label, noun, refresh, paging, selection }: TableStripProps) {
  const ticked = selection !== undefined && selection.count > 0;
  const press = (what: StripPress, id: string, text: string, glyph: LucideIcon): StripVerb => ({
    id,
    label: text,
    icon: glyph,
    onPress: what.onPress,
    ...(what.reason !== undefined && { reason: what.reason }),
  });
  return (
    <div role="toolbar" aria-label={label} className={STRIP}>
      {ticked && (
        <>
          <span className="mr-1 font-mono text-xs text-faint">
            <span className="text-dim tabular-nums">{selection.count}</span> {SELECTED_WORD}
          </span>
          {selection.verbs.map((verb) => (
            <Verb key={verb.id} verb={verb} />
          ))}
          <Icon verb={{ id: "clear", label: CLEAR_SELECTION, icon: X, onPress: selection.onClear }} />
        </>
      )}
      <span className="flex-1" />
      {paging !== undefined && (
        <>
          <Icon verb={press(paging.newer, "newer", "Newer", ChevronLeft)} />
          <Icon verb={press(paging.older, "older", "Older", ChevronRight)} />
        </>
      )}
      <Icon verb={press(refresh, "refresh", `Refresh ${noun}`, RefreshCw)} />
    </div>
  );
}
