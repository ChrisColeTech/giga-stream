import { User } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Toggle } from "@giga/ui/controls/Toggle";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { ENABLED_TIP, KIND_TIP, LAST_SIGN_IN_TIP, USERNAME_TIP } from "@/constants/account-copy";
import { kindLabel } from "@/lib/account-rows";
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
}

/** `Details`: Username, the read-only Kind beside it (`62` section 3.7), the Enabled switch (the inverse of the stored
 *  `disabled`) and the last sign-in. The username is the identity and comes first; an account has no name. The kind is a
 *  fact of the row, never a draft field: nothing on this form edits it. The switch is disabled with its reason while
 *  this is the last enabled account. The security-question flag moved to its own group's badge (docs/54); the ONE Save
 *  is the toolbar's (docs/55 decision 5). */
export function AccountDetailsGroup({ account, draft, errors, onChange, lockReason }: AccountDetailsGroupProps) {
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
      <Row label="Kind" tip={KIND_TIP}>
        <span className="flex h-9 items-center text-sm text-muted">{kindLabel(account)}</span>
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
    </Group>
  );
}
