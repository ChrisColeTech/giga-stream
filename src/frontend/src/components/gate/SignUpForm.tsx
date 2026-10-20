import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Row } from "@giga/ui/form/Row";
import { SECURITY_QUESTIONS } from "@/constants/security-questions";
import { useRegister } from "@/hooks/useRegister";
import { registrationReason } from "@/lib/registration-verb";
import type { RegistrationInput } from "@/types/auth";

export interface SignUpFormProps {
  readonly onBack: () => void;
}

/** Registration in the family gate column: four rows, the fixed eight-question native select and one commit. */
export function SignUpForm({ onBack }: SignUpFormProps) {
  const { state, register } = useRegister();
  const [input, setInput] = useState<RegistrationInput>({
    username: "",
    password: "",
    securityQuestion: null,
    securityAnswer: "",
  });
  const reason = registrationReason(input, state.busy);
  const error = state.error;
  const change = (patch: Partial<RegistrationInput>): void => setInput((current) => ({ ...current, ...patch }));

  return (
    <Form ariaLabel="Sign up" onSubmit={() => reason === undefined && void register(input)} className="gap-3">
      <h2 className="m-0 mb-1 font-mono text-base font-semibold text-text">Sign up</h2>
      <Row label="Username" error={error?.field === "username" ? error.sentence : null}>
        <Input autoFocus type="text" value={input.username} className={FIELD_CONTROL} aria-label="Username"
          autoComplete="username" spellCheck={false} disabled={state.busy}
          onChange={(event) => change({ username: event.target.value })} />
      </Row>
      <Row label="Password" error={error?.field === "password" ? error.sentence : null}>
        <Input type="password" value={input.password} className={FIELD_CONTROL} aria-label="Password"
          autoComplete="new-password" disabled={state.busy}
          onChange={(event) => change({ password: event.target.value })} />
      </Row>
      <Row label="Security question" error={error?.field === "securityQuestion" ? error.sentence : null}>
        <Select value={input.securityQuestion ?? ""} className={FIELD_CONTROL} aria-label="Security question"
          disabled={state.busy}
          onChange={(event) => change({ securityQuestion: event.target.value === "" ? null : Number(event.target.value) })}>
          <option value="">Choose a question</option>
          {SECURITY_QUESTIONS.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </Select>
      </Row>
      <Row label="Answer" error={error?.field === "securityAnswer" ? error.sentence : null}>
        <Input type="text" value={input.securityAnswer} className={FIELD_CONTROL} aria-label="Security answer"
          autoComplete="off" spellCheck={false} disabled={state.busy}
          onChange={(event) => change({ securityAnswer: event.target.value })} />
      </Row>
      {error?.field === "form" && <p role="alert" className="m-0 text-sm text-st-failed">{error.sentence}</p>}
      <div className="flex flex-col gap-2 pt-1">
        <Button type="submit" variant="primary" size="lg" full reason={reason}
          className={state.busy ? "animate-pulse-busy" : undefined}>
          {state.busy ? "Signing up..." : "Sign up"}
        </Button>
        <Button variant="ghost" size="lg" full reason={state.busy ? reason : undefined} onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </Form>
  );
}
