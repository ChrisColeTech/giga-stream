import { Info } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { FACT_UNKNOWN, SETTINGS_LABELS } from "@/constants/settings-sections";
import { ABOUT_FACTS } from "@/fixtures/session";
import { hostAvailable } from "@/services/admin-host";

/* A read-only fact: mono, muted, one control high (the template's About). */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

const address = (): string => (typeof window === "undefined" ? FACT_UNKNOWN : window.location.origin);

/** About: the version, the backend's version and revision, the address in use, the runtime and whether TMDB is
 *  configured. The fixture build supplies the backend's facts; `29` reads them from `/healthz`. */
export function AboutSection() {
  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.about" title="About" icon={Info} last>
        <Row label="Version" tip="The version of this admin app.">
          <span className={FACT}>{ABOUT_FACTS.version}</span>
        </Row>
        <Row label="Backend version" tip="The version of the admin backend this app talks to.">
          <span className={FACT}>{ABOUT_FACTS.backendVersion}</span>
        </Row>
        <Row label="Backend revision" tip="The revision of the backend's source it was built from.">
          <span className={FACT}>{ABOUT_FACTS.backendRevision}</span>
        </Row>
        <Row label="Address" tip="The address this page was loaded from.">
          <span className={FACT}>{address()}</span>
        </Row>
        <Row label="Runtime" tip="Electron in the backend's own window, or a browser tab.">
          <span className={FACT}>{hostAvailable() ? "Electron" : "Browser"}</span>
        </Row>
        <Row label="TMDB" tip="Whether the backend has a TMDB key to sync the catalog with.">
          <span className={FACT}>{ABOUT_FACTS.tmdb}</span>
        </Row>
      </Group>
    </Workspace>
  );
}
