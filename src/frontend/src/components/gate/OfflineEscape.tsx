import { Button } from "@giga/ui/controls/Button";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { OFFLINE_LABEL, OFFLINE_TIP } from "@/constants/gate-copy";
import { useAppStore } from "@/store/app-store";

/** The desktop's one way past the gate (`62` section 3.5): enter the app signed out, with today's local-only
 *  behaviour - the fileserver's shared stores, no account, nothing synced. The public web has no such escape; the
 *  gate renders this only on the desktop runtime. */
export function OfflineEscape() {
  const continueOffline = useAppStore((state) => state.continueOffline);
  return (
    <Tooltip text={OFFLINE_TIP} focusable label={`${OFFLINE_LABEL}. ${OFFLINE_TIP}`}>
      <Button variant="ghost" size="lg" full onClick={continueOffline}>
        {OFFLINE_LABEL}
      </Button>
    </Tooltip>
  );
}
