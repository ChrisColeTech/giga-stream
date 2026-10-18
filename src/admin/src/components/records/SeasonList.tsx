import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { NumericInput } from "@giga/ui/form/NumericInput";
import { Row } from "@giga/ui/form/Row";
import { EPISODE_TIP, SEASON_TIP } from "@/constants/title-copy";
import * as edit from "@/lib/season-edit";
import type { SeasonDraft } from "@/lib/season-edit";

export interface SeasonListProps {
  readonly seasons: readonly SeasonDraft[];
  readonly onChange: (next: SeasonDraft[]) => void;
}

const NUMBER_FIELD = "h-9! w-20 flex-none px-3! text-sm!";
const ALREADY_FIRST = "Already first";
const ALREADY_LAST = "Already last";

/** The editable seasons of a series made by hand (`37` section 4.3): an ordered list; each season its number with up,
 *  down and remove, then its episodes (a number and a title, each with remove) and `Add episode`; `Add season` ends the
 *  list. Every change is a pure edit of `lib/season-edit.ts`; the parent's form holds the list. */
export function SeasonList({ seasons, onChange }: SeasonListProps) {
  return (
    <div className="flex flex-col gap-3">
      {seasons.map((season, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Row
            label="Season"
            tip={SEASON_TIP}
            trailing={
              <>
                <IconButton
                  aria-label={`Move season ${season.season} up`}
                  reason={index === 0 ? ALREADY_FIRST : undefined}
                  onClick={() => onChange(edit.moveSeason(seasons, index, -1))}
                >
                  <ArrowUp aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  aria-label={`Move season ${season.season} down`}
                  reason={index === seasons.length - 1 ? ALREADY_LAST : undefined}
                  onClick={() => onChange(edit.moveSeason(seasons, index, 1))}
                >
                  <ArrowDown aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  aria-label={`Remove season ${season.season}`}
                  title="Remove"
                  onClick={() => onChange(edit.removeSeason(seasons, index))}
                >
                  <X aria-hidden className="size-4" />
                </IconButton>
              </>
            }
          >
            <NumericInput
              value={season.season}
              min={0}
              max={edit.SEASON_NUMBER_MAX}
              className={NUMBER_FIELD}
              aria-label={`Season ${index + 1} number`}
              onChange={(value) => onChange(edit.setSeasonNumber(seasons, index, Math.round(value)))}
            />
          </Row>
          {season.episodes.map((episode, at) => (
            <Row
              key={at}
              label="Episode"
              tip={EPISODE_TIP}
              trailing={
                <IconButton
                  aria-label={`Remove episode ${episode.episode} of season ${season.season}`}
                  title="Remove"
                  onClick={() => onChange(edit.removeEpisode(seasons, index, at))}
                >
                  <X aria-hidden className="size-4" />
                </IconButton>
              }
            >
              <NumericInput
                value={episode.episode}
                min={0}
                className={NUMBER_FIELD}
                aria-label={`Season ${season.season} episode ${at + 1} number`}
                onChange={(value) => onChange(edit.setEpisode(seasons, index, at, { episode: Math.round(value) }))}
              />
              <Input
                value={episode.title}
                className={FIELD_CONTROL}
                aria-label={`Season ${season.season} episode ${episode.episode} title`}
                autoComplete="off"
                onChange={(event) => onChange(edit.setEpisode(seasons, index, at, { title: event.target.value }))}
              />
            </Row>
          ))}
          <Actions>
            <Button
              variant="ghost"
              size="sm"
              title="Add an episode to this season"
              onClick={() => onChange(edit.addEpisode(seasons, index))}
            >
              <Plus aria-hidden /> Add episode
            </Button>
          </Actions>
        </div>
      ))}
      <Actions>
        <Button variant="ghost" title="Add a season to this title" onClick={() => onChange(edit.addSeason(seasons))}>
          <Plus aria-hidden /> Add season
        </Button>
      </Actions>
    </div>
  );
}
