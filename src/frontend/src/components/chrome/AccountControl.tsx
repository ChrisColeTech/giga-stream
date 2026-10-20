import { UserRound } from "lucide-react";
import { IconButton, type IconButtonProps } from "@giga/ui/controls/IconButton";
import { useAccountMenu } from "@/hooks/useAccountMenu";

const SLEEPING = "Close the open window to open the account flow.";

/** Pure account-trigger props: the user glyph never turns into account text or a username. */
export function accountButtonProps(
  signedIn: boolean,
  username: string | null,
  asleep: boolean,
  onOpen: IconButtonProps["onClick"],
): IconButtonProps {
  const label = signedIn ? `Account${username === null ? "" : ` for ${username}`}` : "Sign in";
  return {
    reason: asleep ? SLEEPING : undefined,
    title: asleep ? undefined : label,
    "aria-label": label,
    "aria-haspopup": signedIn ? "menu" : "dialog",
    onClick: onOpen,
    children: <UserRound className="size-3.75" aria-hidden />,
  };
}

/** The titlebar's icon-only account door. Signed-in actions use the shell's one shared menu host. */
export function AccountControl({ asleep }: { readonly asleep: boolean }) {
  const { signedIn, username, open } = useAccountMenu();

  return <IconButton {...accountButtonProps(signedIn, username, asleep, open)} />;
}
