import { ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { ANSWER_TIP, QUESTION_TIP, SAVE_QUESTION, SAVING_QUESTION } from "@/constants/account-copy";
import { SECURITY_ANSWER_MAX, SECURITY_QUESTION_OPTIONS } from "@/constants/security-questions";
import { EMPTY_QUESTION_DRAFT, questionStatus, saveQuestionReason, type QuestionDraft } from "@/lib/account-question";
import type { FlowResult } from "@/services/account-flows";
import type { AdminAccount } from "@/types/admin-account";

export interface AccountQuestionGroupProps {
  readonly account: AdminAccount;
  readonly saving: boolean;
  readonly unreachable: boolean;
  /** Sends the question's number and the answer. The group empties only on success; a refusal sits under its row. */
  readonly onSave: (question: number, answer: string) => Promise<FlowResult>;
}

/** `Security question` (docs/54 section 2): the selected account's reset question, set by the signed-in admin with no
 *  current password. The eight-question Select, an Answer typed in clear, and the group's own primary `Save question`,
 *  not part of `Save details`. The badge carries the account's `Set` / `Not set` flag (the Details group's fact row is
 *  gone). On success the form empties: nothing is kept on screen, and the store's row flips its flag. The answer lives
 *  only in this field. */
export function AccountQuestionGroup({ account, saving, unreachable, onSave }: AccountQuestionGroupProps) {
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION_DRAFT);
  const [errors, setErrors] = useState<{ readonly question: string | null; readonly answer: string | null }>({
    question: null,
    answer: null,
  });
  const reason = saveQuestionReason(draft, saving, unreachable);

  const set = (patch: Partial<QuestionDraft>): void => {
    setDraft({ ...draft, ...patch });
    setErrors({ question: null, answer: null });
  };

  const submit = async (): Promise<void> => {
    if (reason !== undefined) return;
    const result = await onSave(Number(draft.question), draft.answer);
    if (result.ok) setDraft(EMPTY_QUESTION_DRAFT);
    else if (result.dropped !== true && result.field === "answer") setErrors({ question: null, answer: result.sentence });
    else if (result.dropped !== true && result.field === "question") setErrors({ question: result.sentence, answer: null });
  };

  return (
    <Group
      id="ac-question"
      icon={ShieldQuestion}
      title="Security question"
      badge={questionStatus(account.securityQuestionSet)}
      last
    >
      <Form ariaLabel="Security question" onSubmit={() => void submit()} className="gap-3">
        <Row label="Security question" tip={QUESTION_TIP} error={errors.question}>
          <Select
            value={draft.question}
            aria-label="Security question"
            aria-invalid={errors.question !== null}
            onChange={(event) => set({ question: event.target.value })}
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
            onChange={(event) => set({ answer: event.target.value })}
          />
        </Row>
        <Actions>
          <Button type="submit" variant="primary" reason={reason} className={saving ? "animate-pulse-busy" : undefined}>
            {saving ? SAVING_QUESTION : SAVE_QUESTION}
          </Button>
        </Actions>
      </Form>
    </Group>
  );
}
