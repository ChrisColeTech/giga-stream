import type { CSSProperties } from "react";
import { useState } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import {
  ACCOUNT_GONE,
  ACCOUNT_SECTIONS,
  ACCOUNT_SECTION_KEYS,
  WORKSPACE_LABELS,
} from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useFollowRecord } from "@/hooks/useFollowRecord";
import { useWorkspaceGone } from "@/hooks/useWorkspaceGone";
import { useRecordForm } from "@/hooks/useRecordForm";
import { draftOf, sameAccountDraft } from "@/lib/account-draft";
import { EMPTY_QUESTION_DRAFT, type QuestionDraft } from "@/lib/account-question";
import { accountSaveReason, saveAccountRecord, type AccountSaveOutcome } from "@/lib/account-save";
import { disableReason } from "@/lib/account-guard";
import type { SaveVerb } from "@/lib/workspace-verbs";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { AccountDetailsGroup } from "./AccountDetailsGroup";
import { AccountPasswordGroup } from "./AccountPasswordGroup";
import { AccountQuestionGroup } from "./AccountQuestionGroup";

/** Where a question refusal sits: under its own row, the other row cleared. */
const questionError = (field: "question" | "answer", sentence: string) =>
  field === "question" ? { question: sentence, answer: null } : { question: null, answer: sentence };

function Editor({ account, active }: { readonly account: AdminAccount; readonly active: boolean }) {
  const form = useRecordForm({ initial: draftOf(account), same: sameAccountDraft });
  const { flows, saving, track } = useAccountActions();
  const items = useAppStore((state) => state.accounts.items);
  const unreachable = useAppStore((state) => state.accounts.unreachable);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const spy = useScrollSpy(ACCOUNT_SECTION_KEYS, ACCOUNT_SECTION_KEYS[0] ?? "ac-details");
  const [question, setQuestion] = useState<QuestionDraft>(EMPTY_QUESTION_DRAFT);
  const [questionErrors, setQuestionErrors] = useState<{ readonly question: string | null; readonly answer: string | null }>({
    question: null,
    answer: null,
  });

  useFollowRecord(form, account, draftOf, sameAccountDraft);

  const setQuestionDraft = (patch: Partial<QuestionDraft>): void => {
    setQuestion({ ...question, ...patch });
    setQuestionErrors({ question: null, answer: null });
  };

  const after = (outcome: AccountSaveOutcome): void => {
    if (outcome.stage === "saved") {
      if (outcome.account !== null) form.reset(draftOf(outcome.account));
      setQuestion(EMPTY_QUESTION_DRAFT);
    } else if (outcome.stage === "fields-refused") {
      if (outcome.field !== undefined) form.setError(outcome.field, outcome.sentence);
    } else if (outcome.stage === "question-refused") {
      if (outcome.account !== null) form.reset(draftOf(outcome.account));
      if (outcome.field !== undefined) setQuestionErrors(questionError(outcome.field, outcome.sentence));
    }
  };
  const save = async (): Promise<void> => {
    form.clearErrors();
    setQuestionErrors({ question: null, answer: null });
    after(
      await saveAccountRecord(
        {
          fields: () => track("save", () => flows.save(account.id, form.draft)),
          question: (number, answer) => track("question", () => flows.saveQuestion(account.id, number, answer)),
        },
        question,
      ),
    );
  };
  const saveVerb: SaveVerb = { onPress: () => void save(), reason: accountSaveReason(form.dirty, question, saving, unreachable) };

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
      toolbar={<WorkspaceToolbar dirty={form.dirty} onDiscard={form.discard} save={saveVerb} />}
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
          <div ref={spy.bind("ac-question")}>
            <AccountQuestionGroup
              account={account}
              draft={question}
              errors={questionErrors}
              onChange={setQuestionDraft}
              onCommit={() => void save()}
            />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One account's workspace, opened from the list already held (no request to open it, `29` section 8): the rail
 *  (`‹ Accounts`, Details, Password, Security question), the page toolbar (`Discard changes` left; the ONE `Save`
 *  right, no forward verb) and one scrolling page. The Save commits the ENTIRE record (`55` decision 5): the fields,
 *  then the Security question while its group holds a draft; `Set new password` stays on the Password group (an
 *  action, not a save). If the account is no longer in a read list, the workspace closes with a notice. */
export function AccountWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const account = useAppStore((state) => state.accounts.items.find((item) => String(item.id) === id));
  const status = useAppStore((state) => state.accounts.status);
  useWorkspaceGone("accounts", account === undefined && status === "ready", ACCOUNT_GONE, "Account");

  return account === undefined ? null : <Editor key={String(account.id)} account={account} active={active} />;
}
