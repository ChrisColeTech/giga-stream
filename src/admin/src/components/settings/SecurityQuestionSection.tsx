import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import {
  ACCOUNT_GROUP_TITLE,
  ANSWER_TIP,
  CURRENT_PASSWORD_TIP,
  QUESTION_TIP,
  SAVE_QUESTION,
  SAVING_QUESTION,
} from "@/constants/security-question-copy";
import { SECURITY_ANSWER_MAX, SECURITY_QUESTION_OPTIONS } from "@/constants/security-questions";
import { SETTINGS_LABELS } from "@/constants/settings-sections";
import { useSaveSecurityQuestion } from "@/hooks/useSaveSecurityQuestion";
import {
  EMPTY_QUESTION_DRAFT,
  questionStatus,
  saveQuestionReason,
  type QuestionDraft,
} from "@/lib/security-question-form";
import type { QuestionRefusal } from "@/services/security-question";
import { useAppStore } from "@/store/app-store";

/** Account: the signed-in account's own security question (`40` section 4.2). The group's badge says `Set` or `Not set`.
 *  Rows in order: Security question (the eight), Answer (typed in clear), Current password. `Save question` is the one
 *  primary, disabled with the first missing field's reason, `Saving.` while it runs. A refusal sits under its row; saving
 *  signs nothing out. On success the form empties (the answer and the password are not kept on screen). */
export function SecurityQuestionSection() {
  const actor = useAppStore((state) => state.actor);
  const signedIn = useAppStore((state) => state.signedIn);
  const { busy, save } = useSaveSecurityQuestion();
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION_DRAFT);
  const [refusal, setRefusal] = useState<QuestionRefusal | null>(null);
  const reason = saveQuestionReason(draft, signedIn, busy);
  const set = (patch: Partial<QuestionDraft>): void => {
    setDraft({ ...draft, ...patch });
    setRefusal(null);
  };
  const errorOf = (field: QuestionRefusal["field"]): string | null => (refusal?.field === field ? refusal.sentence : null);

  const submit = async (): Promise<void> => {
    if (reason !== undefined) return;
    const failed = await save(draft);
    setRefusal(failed);
    if (failed === null) setDraft(EMPTY_QUESTION_DRAFT);
    else if (failed.field === "currentPassword") setDraft({ ...draft, currentPassword: "" });
  };

  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group
        id="settings.account"
        title={ACCOUNT_GROUP_TITLE}
        icon={KeyRound}
        badge={actor === null ? undefined : questionStatus(actor.securityQuestionSet)}
        last
      >
        <Form ariaLabel={ACCOUNT_GROUP_TITLE} onSubmit={() => void submit()} className="gap-3">
          <Row label="Security question" tip={QUESTION_TIP} error={errorOf("question")}>
            <Select
              value={draft.question}
              aria-label="Security question"
              aria-invalid={refusal?.field === "question"}
              disabled={!signedIn}
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
          <Row label="Answer" tip={ANSWER_TIP} error={errorOf("answer")}>
            <Input
              type="text"
              value={draft.answer}
              className={FIELD_CONTROL}
              aria-label="Answer"
              aria-invalid={refusal?.field === "answer"}
              autoComplete="off"
              spellCheck={false}
              maxLength={SECURITY_ANSWER_MAX}
              disabled={!signedIn}
              onChange={(event) => set({ answer: event.target.value })}
            />
          </Row>
          <Row label="Current password" tip={CURRENT_PASSWORD_TIP} error={errorOf("currentPassword")}>
            <Input
              type="password"
              value={draft.currentPassword}
              className={FIELD_CONTROL}
              aria-label="Current password"
              aria-invalid={refusal?.field === "currentPassword"}
              autoComplete="current-password"
              disabled={!signedIn}
              onChange={(event) => set({ currentPassword: event.target.value })}
            />
          </Row>
          <Actions>
            <Button type="submit" variant="primary" reason={reason} className={busy ? "animate-pulse-busy" : undefined}>
              {busy ? SAVING_QUESTION : SAVE_QUESTION}
            </Button>
          </Actions>
        </Form>
      </Group>
    </Workspace>
  );
}
