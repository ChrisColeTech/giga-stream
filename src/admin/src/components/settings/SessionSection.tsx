import { LogOut, User } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { FACT_UNKNOWN, NOT_SIGNED_IN, SETTINGS_LABELS } from "@/constants/settings-sections";
import { useSignOut } from "@/hooks/useSignOut";
import { useAppStore } from "@/store/app-store";

/* A read-only fact: mono, muted, one control high (the template's About). */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

/** Session: who is signed in, and `Sign out`. Signing out closes Settings and lands on the sign-in page with the chrome in
 *  place. Signed out, the facts are dashes and `Sign out` says why it cannot be used. */
export function SessionSection() {
  const actor = useAppStore((state) => state.actor);
  const signOut = useSignOut();
  const unknown = actor === null ? NOT_SIGNED_IN : undefined;

  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.session" title="Session" icon={User} last>
        <Row label="Signed in as" tip="The account this window is signed in with.">
          <span className={FACT} title={unknown}>
            {actor?.email ?? FACT_UNKNOWN}
          </span>
        </Row>
        <Row label="Name">
          <span className={FACT} title={unknown}>
            {actor?.name ?? FACT_UNKNOWN}
          </span>
        </Row>
        <Actions>
          <Button
            variant="ghost"
            reason={unknown}
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden /> Sign out
          </Button>
        </Actions>
      </Group>
    </Workspace>
  );
}
