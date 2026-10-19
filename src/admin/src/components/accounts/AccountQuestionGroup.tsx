import { ShieldQuestion } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { ANSWER_TIP, QUESTION_TIP } from "@/constants/account-copy";
import { SECURITY_ANSWER_MAX, SECURITY_QUESTION_OPTIONS } from "@/constants/security-questions";
import { questionStatus, type QuestionDraft } from "@/lib/account-question";
import type { AdminAccount } from "@/types/admin-account";

export interface AccountQuestionGroupProps {
  readonly account: AdminAccount;
  /** The question draft, held by the workspace: it is part of the record the toolbar's ONE Save commits. */
  readonly draft: QuestionDraft;
  /** A refusal under its row, from the last Save (cleared by the next edit). */
  readonly errors: { readonly question: string | null; readonly answer: string | null };
  readonly onChange: (patch: Partial<QuestionDraft>) => void;
  /** The toolbar's ONE Save (Enter in the Answer commits the whole record, as the group's own save once did). */
  readonly onCommit: () => void;
}

/** `Security question` (docs/54 section 2; docs/55 decision 5): the selected account's reset question, set by the
 *  signed-in admin with no current password. The eight-question Select and an Answer typed in clear; the group holds
 *  a draft only - the toolbar's ONE Save commits it after the fields (`Save question` is gone). The badge carries the
 *  account's `Set` / `Not set` flag. The answer lives only in this field. */
export function AccountQuestionGroup({ account, draft, errors, onChange, onCommit }: AccountQuestionGroupProps) {
  return (
    <Group
      id="ac-question"
      icon={ShieldQuestion}
      title="Security question"
      badge={questionStatus(account.securityQuestionSet)}
      last
    >
      <Form ariaLabel="Security question" onSubmit={onCommit} className="gap-3">
        <Row label="Security question" tip={QUESTION_TIP} error={errors.question}>
          <Select
            value={draft.question}
            aria-label="Security question"
            aria-invalid={errors.question !== null}
            onChange={(event) => onChange({ question: event.target.value })}
          >
            <option value="" />
            {SECURITY_QUESTION_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Answer" tip={ANSWER_TIP} error={errors.answer}>
          <Input
            type="text"
            value={draft.answer}
            className={FIELD_CONTROL}
            aria-label="Answer"
            aria-invalid={errors.answer !== null}
            autoComplete="off"
            spellCheck={false}
            maxLength={SECURITY_ANSWER_MAX}
            onChange={(event) => onChange({ answer: event.target.value })}
          />
        </Row>
      </Form>
    </Group>
  );
}
