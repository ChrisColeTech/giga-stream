import { Database, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { FACT_UNKNOWN, NEEDS_FILESERVER, NO_LICENCE_TEXT, TMDB_NOTICE } from "@/constants/settings-sections";

/** About: the version and build, the runtime mode and the licences, all drawn disabled until the fileserver supplies
 *  them, and the TMDB notice the terms require (`11` section 6). */
export function AboutSection() {
  return (
    <>
      <Group id="settings.about" title="About" icon={Info}>
        <Row label="Version and build" tip="The version of this app and its build." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-[11px] text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Runtime mode" tip="Whether this runs as the desktop app or in a browser." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-[11px] text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Licences" tip="The licences of this app and of the data it uses.">
          <Button variant="ghost" size="sm" disabled title={NO_LICENCE_TEXT}>
            View licences
          </Button>
        </Row>
      </Group>
      <Group id="settings.about.attribution" title="Attribution" icon={Database} last>
        <Row label="TMDB" tip="The notice the TMDB terms require, shown beside the app's own marks.">
          <span className="min-w-0 flex-1 text-[13px] leading-5 text-text">{TMDB_NOTICE}</span>
        </Row>
      </Group>
    </>
  );
}
