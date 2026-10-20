import { Button } from "@giga/ui/controls/Button";
import { PopupPanel } from "@/components/popups/PopupPanel";
import { useSignOut } from "@/hooks/useSignOut";
import { useAppStore } from "@/store/app-store";
import type { PopupAnchor } from "@/types/overlays";

export interface AccountPopupProps {
  readonly anchor: PopupAnchor;
}

/** The signed-in account menu. Its two actions are intentionally the complete body. */
export function AccountPopup({ anchor }: AccountPopupProps) {
  const close = useAppStore((state) => state.closeOverlay);
  const open = useAppStore((state) => state.openOverlay);
  const signOut = useSignOut();

  return (
    <PopupPanel title="Account" size="compact" policy="live" anchor={anchor} onClose={close}>
      <div className="flex flex-col gap-1">
        <Button autoFocus variant="ghost" full onClick={() => { close(); open("account"); }}>Account</Button>
        <Button variant="ghost" full onClick={() => { close(); void signOut(); }}>Logout</Button>
      </div>
    </PopupPanel>
  );
}
