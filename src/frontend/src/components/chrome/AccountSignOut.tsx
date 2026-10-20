import { LogOut } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Row } from "@giga/ui/form/Row";
import { FACT_UNKNOWN } from "@/constants/settings-sections";
import { useSignOut } from "@/hooks/useSignOut";
import { useAppStore } from "@/store/app-store";

/* A read-only fact, as the Settings window's Session section draws it. */
const FACT = "flex min-h-9 items-center font-mono text-sm text-muted";

export interface AccountSignOutProps {
  /** Sign out finished: the dialog closes and focus returns to the titlebar control (`63` section 3.5). */
  readonly onDone: () => void;
}

/** The signed-in half of the Account dialog (`63` section 3.5): the Session section's fact and its `Sign out`, in
 *  the gate column's own scale. Signing out keeps the device's local state - nothing is wiped (`62` D8) - and the
 *  dialog closes around it. */
export function AccountSignOut({ onDone }: AccountSignOutProps) {
  const session = useAppStore((state) => state.session);
  const signOut = useSignOut();
  const press = (): void => {
    void signOut().then(onDone);
  };
  return (
    <div className="flex w-full flex-col gap-4">
      <h2 className="m-0 mb-1 font-mono text-base font-semibold text-text">Session</h2>
      <Row label="Signed in as" tip="The account this app is signed in with.">
        <span className={FACT} title={session === null ? FACT_UNKNOWN : undefined}>
          {session?.username ?? FACT_UNKNOWN}
        </span>
      </Row>
      <div className="pt-1">
        <Button variant="ghost" size="lg" full onClick={press}>
          <LogOut aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  );
}
