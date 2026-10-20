import { useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { Button, type ButtonProps } from "@giga/ui/controls/Button";
import { useAppStore } from "@/store/app-store";
import { AccountDialog } from "./AccountDialog";

/* The sleeping wording rides the family `reason`, as every titlebar control's does under an open window (`50`
 * section 2.5). */
const SLEEPING = "Close the open window to open the account dialog.";

/** The control's props (`06` section 2, the Account row), pure so the sleeping carriage is testable without a DOM.
 *  Signed out a ghost `Sign in`; signed in the username as the label - the dialog it opens carries the session's
 *  sign-out. Asleep under an open work window, disabled with the reason. */
export function accountButtonProps(
  signedIn: boolean,
  username: string | null,
  asleep: boolean,
  onOpen: () => void,
): ButtonProps {
  const label = signedIn ? (username ?? "Account") : "Sign in";
  return {
    size: "sm",
    variant: "ghost",
    reason: asleep ? SLEEPING : undefined,
    title: asleep ? undefined : label,
    "aria-label": `Account: ${label}`,
    "aria-haspopup": "dialog",
    onClick: onOpen,
    children: (
      <>
        {signedIn ? null : <LogIn aria-hidden />} {label}
      </>
    ),
  };
}

/** The titlebar's Account control (`06` section 2, `63` section 3.5): signed out it opens the gate as a dialog;
 *  signed in the same dialog with the session's sign-out. Esc or the backdrop closes it and focus returns to this
 *  control. */
export function AccountControl({ asleep }: { readonly asleep: boolean }) {
  const signedIn = useAppStore((state) => state.signedIn);
  const username = useAppStore((state) => state.session?.username ?? null);
  const [mode, setMode] = useState<"gate" | "session" | null>(null);
  const control = useRef<HTMLButtonElement>(null);

  const open = (): void => {
    setMode(signedIn ? "session" : "gate");
  };
  const close = (): void => {
    setMode(null);
    control.current?.focus();
  };

  return (
    <>
      <Button {...accountButtonProps(signedIn, username, asleep, open)} ref={control} />
      {mode !== null && <AccountDialog mode={mode} onClose={close} />}
    </>
  );
}
