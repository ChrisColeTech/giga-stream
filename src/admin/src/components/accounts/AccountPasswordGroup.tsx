import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { NEW_PASSWORD_TIP, SET_PASSWORD_TIP, TYPE_PASSWORD } from "@/constants/account-copy";
import { setPasswordReason } from "@/lib/account-checks";
import type { FlowResult } from "@/services/account-flows";

export interface AccountPasswordGroupProps {
  readonly saving: boolean;
  readonly unreachable: boolean;
  /** Sends the password. The group clears its field only on success; a refusal under `password` shows under the row. */
  readonly onSet: (password: string) => Promise<FlowResult>;
}

/** `Password`: one `New password` field and its own ghost verb, `Set new password`, which is not part of Save. Disabled
 *  with `Type a new password.` or the length refusal until the value is valid, and while a call runs or the backend is
 *  unreachable. Enabled, its tooltip says it signs the account out everywhere. The value lives only in this field. */
export function AccountPasswordGroup({ saving, unreachable, onSet }: AccountPasswordGroupProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reason = setPasswordReason(value, saving, unreachable, TYPE_PASSWORD);

  const press = async (): Promise<void> => {
    if (reason !== undefined) return;
    setError(null);
    const result = await onSet(value);
    if (result.ok) setValue("");
    else if (result.dropped !== true && result.field === "password") setError(result.sentence);
  };
  const verb = (
    <Button variant="ghost" reason={reason} onClick={() => void press()}>
      Set new password
    </Button>
  );

  return (
    <Group id="ac-password" icon={KeyRound} title="Password">
      <Row label="New password" tip={NEW_PASSWORD_TIP} error={error}>
        <Input
          type="password"
          value={value}
          className={FIELD_CONTROL}
          aria-label="New password"
          aria-invalid={error !== null}
          autoComplete="new-password"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void press();
          }}
        />
      </Row>
      <Actions>{reason === undefined ? <Tooltip text={SET_PASSWORD_TIP}>{verb}</Tooltip> : verb}</Actions>
    </Group>
  );
}
