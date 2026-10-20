import { LogOut, UserRound } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { FACT_UNKNOWN, SETTINGS_LABELS } from "@/constants/settings-sections";
import { useSignOut } from "@/hooks/useSignOut";
import { useAppStore } from "@/store/app-store";

/* A read-only fact: mono, muted, one control high (the About section's pattern). */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

/** Session: who the gate let in (`62` section 3.5), and `Sign out`. Signing out returns to the gate and keeps the
 *  device's local state (`62` D8): nothing here wipes a store. Signed out the fact is a dash and the button says why
 *  it cannot be used. */
export function SessionSection() {
  const session = useAppStore((state) => state.session);
  const signOut = useSignOut();
  const unknown = session === null ? "Signed out." : undefined;

  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.session" title="Session" icon={UserRound} last>
        <Row label="Signed in as" tip="The account this app is signed in with.">
          <span className={FACT} title={unknown}>
            {session?.username ?? FACT_UNKNOWN}
          </span>
        </Row>
        <Actions>
          <Button variant="ghost" reason={unknown} onClick={() => void signOut()}>
            <LogOut aria-hidden /> Sign out
          </Button>
        </Actions>
      </Group>
    </Workspace>
  );
}
