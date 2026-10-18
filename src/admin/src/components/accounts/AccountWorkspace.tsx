import { useEffect, type CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import {
  ACCOUNT_GONE,
  ACCOUNT_SECTIONS,
  ACCOUNT_SECTION_KEYS,
  SAVING_REASON,
  UNREACHABLE_REASON,
  WORKSPACE_LABELS,
} from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { draftOf, sameAccountDraft } from "@/lib/account-draft";
import { disableReason } from "@/lib/account-guard";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { AccountDetailsGroup } from "./AccountDetailsGroup";
import { AccountPasswordGroup } from "./AccountPasswordGroup";

function Editor({ account, active }: { readonly account: AdminAccount; readonly active: boolean }) {
  const form = useRecordForm({ initial: draftOf(account), same: sameAccountDraft });
  const { flows, saving, track } = useAccountActions();
  const items = useAppStore((state) => state.accounts.items);
  const unreachable = useAppStore((state) => state.accounts.unreachable);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const spy = useScrollSpy(ACCOUNT_SECTION_KEYS, ACCOUNT_SECTION_KEYS[0] ?? "ac-details");

  /* The list changed under the workspace (a refresh, a save): a clean form follows the new record; a form being edited
     keeps what the person typed, unless it already holds the saved values. */
  useEffect(() => {
    const next = draftOf(account);
    if (!form.dirty || sameAccountDraft(form.draft, next)) form.reset(next);
  }, [account]);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await track("save", () => flows.save(account.id, form.draft));
    if (result.ok) {
      if (result.value !== null) form.reset(draftOf(result.value));
    } else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  return (
    <WorkspaceFrame
      tab="accounts"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Account sections"
          back={{ label: "Accounts", onPress: () => closeWorkspace("accounts") }}
          sections={ACCOUNT_SECTIONS}
          spy={spy}
        />
      }
      toolbar={
        <WorkspaceToolbar
          label="Account toolbar"
          dirty={form.dirty}
          discard={{ label: "Discard changes", onPress: form.discard }}
          save={{
            label: "Save",
            onPress: () => void save(),
            reason: saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined,
          }}
        />
      }
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div className="flex flex-col px-6 pb-8" style={{ "--label-col": labelColumn(WORKSPACE_LABELS) } as CSSProperties}>
          <div ref={spy.bind("ac-details")}>
            <AccountDetailsGroup
              account={account}
              draft={form.draft}
              errors={form.errors}
              onChange={form.set}
              lockReason={disableReason(items, account)}
            />
          </div>
          <div ref={spy.bind("ac-password")}>
            <AccountPasswordGroup
              saving={saving}
              unreachable={unreachable}
              onSet={(password) => track("password", () => flows.setPassword(account.id, password))}
            />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One account's workspace, opened from the list already held (no request to open it, `29` section 8): the rail
 *  (`‹ Accounts`, Details, Password), a toolbar with `Discard changes` and `Save` only, and one scrolling page. If the
 *  account is no longer in a read list, the workspace closes with a notice. */
export function AccountWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const account = useAppStore((state) => state.accounts.items.find((item) => String(item.id) === id));
  const status = useAppStore((state) => state.accounts.status);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const say = useAppStore((state) => state.say);
  const gone = account === undefined && status === "ready";

  useEffect(() => {
    if (!gone) return;
    closeWorkspace("accounts");
    say(ACCOUNT_GONE, "warn", "Account");
  }, [gone, closeWorkspace, say]);

  return account === undefined ? null : <Editor key={String(account.id)} account={account} active={active} />;
}
