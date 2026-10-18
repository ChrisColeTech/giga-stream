import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Row } from "@giga/ui/form/Row";
import {
  ANSWER_LIMIT,
  ANSWER_TIP,
  NO_QUESTION_REASON,
  NO_QUESTION_TITLE,
  RESET_BACK,
  RESET_HEADING,
  RESET_SUBMIT,
  RESET_SUBMITTING,
  RESET_WAITING_REASON,
} from "@/constants/reset-copy";
import type { ResetState } from "@/lib/reset-state";
import { resetReason } from "@/lib/reset-verb";
import type { ResetResult } from "@/types/auth";
import { GateNotice } from "./GateNotice";

export interface ResetAnswerFormProps {
  readonly state: ResetState;
  /** Sends the answer and the new password; answers what came back, or null when nothing was sent. */
  readonly onReset: (answer: string, newPassword: string) => Promise<ResetResult | null>;
  readonly onBack: () => void;
}

/** Step 2 of the reset (`40` section 4.1): the question (read only), why a question-less account cannot be reset here,
 *  the Answer and New password rows, a primary `Reset password` and a ghost `Back to sign in`. Answer is focused on open.
 *  A refusal of the answer clears the answer and the new password and puts focus back on Answer; a refusal of the new
 *  password keeps the answer and focuses the password. Both sit under their row as alerts. */
export function ResetAnswerForm({ state, onReset, onBack }: ResetAnswerFormProps) {
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  /* The library's Input takes no ref; the row's wrapper finds its field. */
  const answerRow = useRef<HTMLDivElement>(null);
  const passwordRow = useRef<HTMLDivElement>(null);
  const { busy, error } = state;
  const reason = resetReason(answer, newPassword, busy);

  useEffect(() => {
    if (error === null) return;
    (error.field === "answer" ? answerRow : passwordRow).current?.querySelector("input")?.focus();
  }, [error]);

  const submit = async (): Promise<void> => {
    if (reason !== undefined) return;
    const result = await onReset(answer, newPassword);
    if (result !== null && !result.ok && result.refusal === "invalid") {
      setAnswer("");
      setNewPassword("");
    }
  };

  return (
    <Form ariaLabel={RESET_HEADING} onSubmit={() => void submit()} className="gap-3">
      <h2 className="m-0 mb-1 font-mono text-base font-semibold text-text">{RESET_HEADING}</h2>
      <Row label="Question" align="start">
        <p className="m-0 py-2 text-sm leading-5 text-text">{state.question}</p>
      </Row>
      <GateNotice sentence={NO_QUESTION_REASON} title={NO_QUESTION_TITLE} icon={CircleHelp} />
      <div ref={answerRow}>
        <Row label="Answer" tip={ANSWER_TIP} error={error?.field === "answer" ? error.sentence : null}>
          <Input
            type="text"
            value={answer}
            className={FIELD_CONTROL}
            aria-label="Answer"
            aria-invalid={error?.field === "answer"}
            autoComplete="off"
            spellCheck={false}
            maxLength={ANSWER_LIMIT}
            autoFocus
            disabled={busy}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </Row>
      </div>
      <div ref={passwordRow}>
        <Row label="New password" error={error?.field === "newPassword" ? error.sentence : null}>
          <Input
            type="password"
            value={newPassword}
            className={FIELD_CONTROL}
            aria-label="New password"
            aria-invalid={error?.field === "newPassword"}
            autoComplete="new-password"
            disabled={busy}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Row>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          reason={reason}
          className={busy ? "animate-pulse-busy" : undefined}
        >
          {busy ? RESET_SUBMITTING : RESET_SUBMIT}
        </Button>
        <Button variant="ghost" size="lg" full reason={busy ? RESET_WAITING_REASON : undefined} onClick={onBack}>
          {RESET_BACK}
        </Button>
      </div>
    </Form>
  );
}
