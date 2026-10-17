import { LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Form } from "@giga/ui/form/Form";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SIGNED_IN_NOTICE, SIGN_IN_REASON } from "@/constants/sign-in-copy";
import { useAppStore } from "@/store/app-store";

/** The sign-in group: Email, Password and one primary `Sign in`, disabled until both are filled (the template's model:
 *  the button says why). Enter in either field submits. The fixture build signs in as whoever types; `29` (Wave 7) sends
 *  the pair to the backend and shows a wrong password under the Password row. */
export function SignInForm() {
  const signIn = useAppStore((state) => state.signIn);
  const say = useAppStore((state) => state.say);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const missing = email.trim() === "" || password === "";

  const submit = () => {
    if (missing) return;
    signIn(email);
    say(SIGNED_IN_NOTICE);
  };

  return (
    <Form ariaLabel="Sign in" onSubmit={submit}>
      <Group id="sign-in" icon={LogIn} title="Sign in" collapsible={false} last>
        <Row label="Email">
          <Input
            type="email"
            value={email}
            className={FIELD_CONTROL}
            aria-label="Email"
            autoComplete="username"
            spellCheck={false}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Row>
        <Row label="Password">
          <Input
            type="password"
            value={password}
            className={FIELD_CONTROL}
            aria-label="Password"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </Row>
        <Actions>
          <Button type="submit" variant="primary" reason={missing ? SIGN_IN_REASON : undefined}>
            Sign in
          </Button>
        </Actions>
      </Group>
    </Form>
  );
}
