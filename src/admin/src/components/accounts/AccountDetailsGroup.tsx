import { User } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Toggle } from "@giga/ui/controls/Toggle";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { SaveDetails } from "@/components/records/SaveDetails";
import type { SaveVerb } from "@/lib/workspace-verbs";
import { ENABLED_TIP, LAST_SIGN_IN_TIP, SECURITY_QUESTION_TIP, USERNAME_TIP } from "@/constants/account-copy";
import type { AccountDraft } from "@/lib/account-draft";
import { formatWhen } from "@/lib/format-when";
import type { FormErrors } from "@/lib/record-form";
import type { AdminAccount } from "@/types/admin-account";

export interface AccountDetailsGroupProps {
  readonly account: AdminAccount;
  readonly draft: AccountDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<AccountDraft>) => void;
  /** Why the Enabled switch cannot be turned off (the last enabled account); undefined when it can. */
  readonly lockReason: string | undefined;
  /** The form's one commit, ending this group. */
  readonly save: SaveVerb;
}

/** `Details`: Username, the Enabled switch (the inverse of the stored `disabled`), the last sign-in and whether a
 *  security question is set (`Set` or `Not set`), both read only. The username is the identity and comes first; an
 *  account has no name. The switch is disabled with its reason while this is the last enabled account. */
export function AccountDetailsGroup({ account, draft, errors, onChange, lockReason, save }: AccountDetailsGroupProps) {
  const toggle = (
    <Toggle
      checked={draft.enabled}
      aria-label="Enabled"
      disabled={lockReason !== undefined}
      onChange={(enabled) => onChange({ enabled })}
    />
  );
  return (
    <Group id="ac-details" icon={User} title="Details">
      <Row label="Username" tip={USERNAME_TIP} error={errors["username"]}>
        <Input
          type="text"
          value={draft.username}
          className={FIELD_CONTROL}
          aria-label="Username"
          aria-invalid={errors["username"] !== undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ username: event.target.value })}
        />
      </Row>
      <Row label="Enabled" tip={ENABLED_TIP} error={errors["enabled"]}>
        {lockReason === undefined ? (
          toggle
        ) : (
          <Tooltip text={lockReason} focusable label={`Enabled. ${lockReason}`}>
            {toggle}
          </Tooltip>
        )}
      </Row>
      <Row label="Last sign-in" tip={LAST_SIGN_IN_TIP}>
        <span className="flex h-9 items-center font-mono text-sm text-muted">{formatWhen(account.lastSignInAt)}</span>
      </Row>
      <Row label="Security question" tip={SECURITY_QUESTION_TIP}>
        <span className="flex h-9 items-center font-mono text-sm text-muted">
          {account.securityQuestionSet === true ? "Set" : "Not set"}
        </span>
      </Row>
      <SaveDetails save={save} />
    </Group>
  );
}
