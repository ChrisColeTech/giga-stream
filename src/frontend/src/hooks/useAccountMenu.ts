import { useEffect, useRef } from "react";
import type { MouseEventHandler } from "react";
import type { MenuItem } from "@giga/ui/menus/types";
import { openMenu } from "@/lib/menu";
import { useAppStore } from "@/store/app-store";
import { useSignOut } from "./useSignOut";

export function accountMenuItems(openAccount: () => void, signOut: () => void): MenuItem[] {
  return [
    { kind: "action", label: "Account", onSelect: openAccount },
    { kind: "action", label: "Logout", onSelect: signOut },
  ];
}

/** Owns account-flow focus and summons the shell's shared menu directly below its titlebar opener. */
export function useAccountMenu(): {
  readonly signedIn: boolean;
  readonly username: string | null;
  readonly open: MouseEventHandler<HTMLButtonElement>;
} {
  const session = useAppStore((state) => state.session);
  const gateOpen = useAppStore((state) => state.gateOpen);
  const overlay = useAppStore((state) => state.overlay);
  const openGate = useAppStore((state) => state.openGate);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const signOut = useSignOut();
  const opener = useRef<HTMLButtonElement | null>(null);
  const returning = useRef(false);

  useEffect(() => {
    const flowOpen = gateOpen || overlay === "account";
    if (flowOpen) returning.current = true;
    else if (returning.current) {
      returning.current = false;
      opener.current?.focus();
    }
  }, [gateOpen, overlay]);

  const open: MouseEventHandler<HTMLButtonElement> = (event) => {
    opener.current = event.currentTarget;
    if (session === null) {
      openGate();
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    openMenu({
      clientX: box.left,
      clientY: box.bottom,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
    }, accountMenuItems(
      () => openOverlay("account"),
      () => { void signOut(); },
    ));
  };

  return { signedIn: session !== null, username: session?.username ?? null, open };
}
