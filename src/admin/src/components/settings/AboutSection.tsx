import { Info } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { ABOUT_TIPS, APP_VERSION, FACT_UNKNOWN, SETTINGS_LABELS } from "@/constants/settings-sections";
import { useAboutFacts } from "@/hooks/useAboutFacts";

/* A read-only fact: mono, muted, one control high (the template's About). */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

/** About: the version, the backend's version and revision, the address in use, the runtime and whether TMDB is
 *  configured. The fixture build supplies the backend's facts; `29` reads them from `/healthz`. */
export function AboutSection() {
  const facts = useAboutFacts();
  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.about" title="About" icon={Info} last>
        <Row label="Version" tip={ABOUT_TIPS.version}>
          <span className={FACT}>{APP_VERSION}</span>
        </Row>
        <Row label="Backend version" tip={ABOUT_TIPS.backendVersion}>
          <span className={FACT}>{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Backend revision" tip={ABOUT_TIPS.backendRevision}>
          <span className={FACT}>{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Address" tip={ABOUT_TIPS.address}>
          <span className={FACT}>{facts.address}</span>
        </Row>
        <Row label="Runtime" tip={ABOUT_TIPS.runtime}>
          <span className={FACT}>{facts.runtime}</span>
        </Row>
        <Row label="TMDB" tip={ABOUT_TIPS.tmdb}>
          <span className={FACT}>{FACT_UNKNOWN}</span>
        </Row>
      </Group>
    </Workspace>
  );
}
