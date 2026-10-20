import { useEffect, useRef } from "react";
import { UserRound } from "lucide-react";
import { IconButton, type IconButtonProps } from "@giga/ui/controls/IconButton";
import { useAppStore } from "@/store/app-store";

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
    "aria-haspopup": "dialog",
    onClick: onOpen,
    children: <UserRound className="size-3.75" aria-hidden />,
  };
}

/** The titlebar's icon-only account door. Every signed-in surface is hosted by the one overlay state. */
export function AccountControl({ asleep }: { readonly asleep: boolean }) {
  const session = useAppStore((state) => state.session);
  const gateOpen = useAppStore((state) => state.gateOpen);
  const overlay = useAppStore((state) => state.overlay);
  const openGate = useAppStore((state) => state.openGate);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const opener = useRef<HTMLButtonElement | null>(null);
  const returning = useRef(false);

  useEffect(() => {
    const flowOpen = gateOpen || overlay === "account-popup" || overlay === "account";
    if (flowOpen) returning.current = true;
    else if (returning.current) {
      returning.current = false;
      opener.current?.focus();
    }
  }, [gateOpen, overlay]);

  const open: IconButtonProps["onClick"] = (event) => {
    opener.current = event.currentTarget;
    if (session === null) openGate();
    else openOverlay("account-popup", event.currentTarget);
  };

  return <IconButton {...accountButtonProps(session !== null, session?.username ?? null, asleep, open)} />;
}
