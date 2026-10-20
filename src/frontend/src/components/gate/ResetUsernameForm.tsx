import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Row } from "@giga/ui/form/Row";
import { RESET_BACK, RESET_CONTINUE, RESET_HEADING, RESET_WAITING_REASON, USERNAME_LIMIT } from "@/constants/reset-copy";
import { continueReason } from "@/lib/reset-verb";

export interface ResetUsernameFormProps {
  /** The username typed on the sign-in view, carried over. */
  readonly initialUsername: string;
  readonly busy: boolean;
  readonly onContinue: (username: string) => void;
  readonly onBack: (username: string) => void;
}

/** Step 1 of the reset (`40` section 4.1): the Username row, a primary `Continue` (disabled with `Enter your
 *  username.` while empty, and while the question is being asked) and a ghost `Back to sign in`. Enter in the field
 *  submits. The field is focused on open. */
export function ResetUsernameForm({ initialUsername, busy, onContinue, onBack }: ResetUsernameFormProps) {
  const [username, setUsername] = useState(initialUsername);
  const reason = continueReason(username, busy);

  return (
    <Form
      ariaLabel={RESET_HEADING}
      onSubmit={() => {
        if (reason === undefined) onContinue(username);
      }}
      className="gap-3"
    >
      <h2 className="m-0 mb-1 font-mono text-base font-semibold text-text">{RESET_HEADING}</h2>
      <Row label="Username">
        <Input
          type="text"
          value={username}
          className={FIELD_CONTROL}
          aria-label="Username"
          autoComplete="username"
          spellCheck={false}
          maxLength={USERNAME_LIMIT}
          autoFocus
          disabled={busy}
          onChange={(event) => setUsername(event.target.value)}
        />
      </Row>
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          reason={reason}
          className={busy ? "animate-pulse-busy" : undefined}
        >
          {RESET_CONTINUE}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          full
          reason={busy ? RESET_WAITING_REASON : undefined}
          onClick={() => onBack(username)}
        >
          {RESET_BACK}
        </Button>
      </div>
    </Form>
  );
}
