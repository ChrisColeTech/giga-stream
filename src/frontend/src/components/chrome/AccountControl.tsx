import { useEffect, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { Button, type ButtonProps } from "@giga/ui/controls/Button";
import { useAppStore } from "@/store/app-store";
import { AccountDialog } from "./AccountDialog";

/* The sleeping wording rides the family `reason`, as every titlebar control's does under an open window (`50`
 * section 2.5). */
const SLEEPING = "Close the open window to open the account dialog.";

/** The control's props (`06` section 2, the Account row), pure so the sleeping carriage is testable without a DOM.
 *  Signed out a ghost `Sign in`, which opens the gate wall; signed in the username as the label - the dialog it
 *  opens carries the session's sign-out. Asleep under an open work window, disabled with the reason. */
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

/** The titlebar's Account control (`06` section 2, `63` sections 3.1 and 3.5): signed out it opens the gate as the
 *  admin console's full-screen wall (`34` sections 2 and 4); signed in the dialog with the session's sign-out.
 *  Escape closes either, and focus returns to this control. */
export function AccountControl({ asleep }: { readonly asleep: boolean }) {
  const session = useAppStore((state) => state.session);
  const signedIn = session !== null;
  const username = session?.username ?? null;
  const gateOpen = useAppStore((state) => state.gateOpen);
  const openGate = useAppStore((state) => state.openGate);
  const [dialog, setDialog] = useState(false);
  const control = useRef<HTMLButtonElement>(null);

  /* The wall closes from inside itself (Escape, a sign-in): focus returns here when it does. The flag keeps the
   * effect from grabbing focus on mount. */
  const returned = useRef(false);
  useEffect(() => {
    if (gateOpen) returned.current = true;
    else if (returned.current) {
      returned.current = false;
      control.current?.focus();
    }
  }, [gateOpen]);

  const open = (): void => {
    if (signedIn) setDialog(true);
    else openGate();
  };
  const close = (): void => {
    setDialog(false);
    control.current?.focus();
  };

  return (
    <>
      <Button {...accountButtonProps(signedIn, username, asleep, open)} ref={control} />
      {dialog && <AccountDialog session={session} onGate={openGate} onClose={close} />}
    </>
  );
}
