import { Database, Info } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { FACT_UNKNOWN, SETTINGS_LABELS, TMDB_NOTICE } from "@/constants/settings-sections";
import { useLicenceAction } from "@/hooks/useLicenceAction";

/* A read-only fact, in LoRA's About pane style. */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

/** About: the version and build, the runtime mode and the licences, unknown until the fileserver supplies them, and the
 *  TMDB notice the terms require (`11` section 6). */
export interface AboutSectionProps {
  readonly version: string | null;
  readonly runtime: "electron" | "browser" | null;
}

export function AboutSection({ version, runtime }: AboutSectionProps) {
  const viewLicences = useLicenceAction();
  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.about" title="About" icon={Info}>
        <Row label="Version and build" tip="The version of this app and its build.">
          <span className={FACT}>{version ?? FACT_UNKNOWN}</span>
        </Row>
        <Row label="Runtime mode" tip="Whether this runs as the desktop app or in a browser.">
          <span className={FACT}>{runtime ?? FACT_UNKNOWN}</span>
        </Row>
        <Row label="Licences" tip="The licences of this app and of the data it uses.">
          <Button variant="ghost" size="sm" onClick={viewLicences}>
            View licences
          </Button>
        </Row>
      </Group>
      <Group id="settings.about.attribution" title="Attribution" icon={Database} last>
        <Row label="TMDB" tip="The notice the TMDB terms require, shown beside the app's own marks." align="start">
          <span className="min-w-0 flex-1 py-2 text-sm leading-5 text-text">{TMDB_NOTICE}</span>
        </Row>
      </Group>
    </Workspace>
  );
}
