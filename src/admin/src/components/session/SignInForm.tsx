import { useEffect, useRef, useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Row } from "@giga/ui/form/Row";
import { GATE_HEADING, SIGNING_IN_LABEL } from "@/constants/sign-in-copy";
import { useSignIn } from "@/hooks/useSignIn";
import { gateError } from "@/lib/gate-state";
import { signInReason } from "@/lib/sign-in-verb";
import { useAppStore } from "@/store/app-store";

/** The gate's form: Email, Password and one primary `Sign in`, disabled with its reason until both are filled and while
 *  the port answers (`34` section 3). Enter in either field submits. A refusal keeps the email, clears the password
 *  (not for an unreachable backend: the retry needs it), shows its sentence under the Password row and puts focus back
 *  there. Email is focused on open. */
export function SignInForm() {
  const gate = useAppStore((state) => state.gate);
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /* The library's Input takes no ref; the row's wrapper finds its field. */
  const passwordRow = useRef<HTMLDivElement>(null);
  const submitting = gate.phase === "submitting";
  const reason = signInReason(email, password, gate);
  const error = gateError(gate);

  useEffect(() => {
    if (error !== null) passwordRow.current?.querySelector("input")?.focus();
  }, [gate, error]);

  const submit = async () => {
    if (reason !== undefined) return;
    const result = await signIn(email, password);
    if (result !== null && !result.ok && result.refusal !== "unreachable") setPassword("");
  };

  return (
    <Form ariaLabel="Sign in" onSubmit={() => void submit()} className="gap-3">
      <h2 className="m-0 mb-1 font-mono text-base font-semibold text-text">{GATE_HEADING}</h2>
      <Row label="Email">
        <Input
          type="email"
          value={email}
          className={FIELD_CONTROL}
          aria-label="Email"
          autoComplete="username"
          spellCheck={false}
          autoFocus
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Row>
      <div ref={passwordRow}>
        <Row label="Password" error={error}>
          <Input
            type="password"
            value={password}
            className={FIELD_CONTROL}
            aria-label="Password"
            aria-invalid={error !== null}
            autoComplete="current-password"
            disabled={submitting}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Row>
      </div>
      <div className="pt-1">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          reason={reason}
          className={submitting ? "animate-pulse-busy" : undefined}
        >
          {submitting ? SIGNING_IN_LABEL : "Sign in"}
        </Button>
      </div>
    </Form>
  );
}
