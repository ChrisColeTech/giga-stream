import { Database, ImageOff, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { FACT_UNKNOWN, LOGO_MISSING, NEEDS_FILESERVER, TMDB_NOTICE } from "@/constants/settings-sections";

/** About: the version and build, the runtime mode and the licences, all drawn disabled until the fileserver supplies
 *  them, and the TMDB attribution the terms require (`11` section 6). The logo is a placeholder: the file is not in the
 *  repository, and it is not invented. */
export function AboutSection() {
  return (
    <>
      <Group id="settings.about" title="About" icon={Info}>
        <Row label="Version and build" tip="The version of this app and its build." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-xs text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Runtime mode" tip="Whether this runs as the desktop app or in a browser." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-xs text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Licences" tip="The licences of this app and of the data it uses.">
          <Button variant="ghost" size="sm" disabled title={NEEDS_FILESERVER}>
            View licences
          </Button>
        </Row>
      </Group>
      <Group id="settings.about.attribution" title="Attribution" icon={Database} last>
        <Row label="TMDB" tip="The TMDB logo, less prominent than this app's own marks, and the notice their terms require.">
          <span
            role="img"
            aria-label="TMDB logo, not yet available"
            title={LOGO_MISSING}
            className="grid h-8 w-20 flex-none place-items-center rounded-ctl border border-dashed border-ctl-edge text-dim opacity-45"
          >
            <ImageOff className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-xs leading-4 text-muted">{TMDB_NOTICE}</span>
        </Row>
      </Group>
    </>
  );
}
