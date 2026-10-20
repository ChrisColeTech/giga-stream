import { UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { workSpec } from "@/constants/child-window";
import { useProfileUpdate } from "@/hooks/useProfileUpdate";
import { profileUpdateReason } from "@/lib/profile-verb";
import { useAppStore } from "@/store/app-store";

const SPEC = workSpec("account", "Account");
const LABELS = ["Username"] as const;

/** The account profile work window: one group and one Save for the username document. */
export function AccountWindow() {
  const close = useAppStore((state) => state.closeOverlay);
  const current = useAppStore((state) => state.session?.username ?? "");
  const [username, setUsername] = useState(current);
  const { state, updateUsername } = useProfileUpdate();
  const reason = username === current ? "The username has not changed." : profileUpdateReason(username, state.busy);

  return (
    <ChildWindow spec={SPEC} onClose={close}>
      <Form ariaLabel="Account profile" onSubmit={() => reason === undefined && void updateUsername(username)}
        className="min-h-0 flex-1">
        <Workspace labels={LABELS}>
          <Group title="Account" icon={UserRound} last>
            <Row label="Username" error={state.error}>
              <Input autoFocus value={username} className={FIELD_CONTROL} aria-label="Username" autoComplete="username"
                spellCheck={false} disabled={state.busy} onChange={(event) => setUsername(event.target.value)} />
            </Row>
            <Actions>
              <Button type="submit" variant="primary" reason={reason}
                className={state.busy ? "animate-pulse-busy" : undefined}>Save</Button>
            </Actions>
          </Group>
        </Workspace>
      </Form>
    </ChildWindow>
  );
}
