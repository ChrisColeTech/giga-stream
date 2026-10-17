import { Database, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Group, Row, Workspace } from "@/components/ui/Form";
import { FACT_UNKNOWN, NEEDS_FILESERVER, NO_LICENCE_TEXT, TMDB_NOTICE } from "@/constants/settings-sections";

const LABELS = ["Version and build", "Runtime mode", "Licences", "TMDB"] as const;

/* A read-only fact, in LoRA's About pane style. */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

/** About: the version and build, the runtime mode and the licences, unknown until the fileserver supplies them, and the
 *  TMDB notice the terms require (`11` section 6). */
export function AboutSection() {
  return (
    <Workspace labels={LABELS}>
      <Group id="settings.about" title="About" icon={Info}>
        <Row label="Version and build" tip="The version of this app and its build.">
          <span className={FACT} title={NEEDS_FILESERVER}>{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Runtime mode" tip="Whether this runs as the desktop app or in a browser.">
          <span className={FACT} title={NEEDS_FILESERVER}>{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Licences" tip="The licences of this app and of the data it uses.">
          <Button variant="ghost" size="sm" disabled title={NO_LICENCE_TEXT}>
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
