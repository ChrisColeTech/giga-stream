import { useEffect, type CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import {
  PROVIDER_GONE,
  PROVIDER_SECTIONS,
  PROVIDER_SECTION_KEYS,
  PROVIDER_WORKSPACE_LABELS,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { saveRequiredReason } from "@/lib/provider-checks";
import { draftOfProvider, sameProviderDraft } from "@/lib/provider-draft";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useAppStore } from "@/store/app-store";
import { ProviderDetailsGroup } from "./ProviderDetailsGroup";
import { ProviderPlayerGroup } from "./ProviderPlayerGroup";
import { ProviderTemplatesGroup } from "./ProviderTemplatesGroup";

function Editor({ provider, active }: { readonly provider: AdminProvider; readonly active: boolean }) {
  const form = useRecordForm({ initial: draftOfProvider(provider), same: sameProviderDraft });
  const { flows, saving, track } = useProviderActions();
  const unreachable = useAppStore((state) => state.providers.unreachable);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const requestTab = useAppStore((state) => state.requestTab);
  const spy = useScrollSpy(PROVIDER_SECTION_KEYS, PROVIDER_SECTION_KEYS[0] ?? "pv-details");

  /* The list changed under the workspace (a refresh, a bulk run): a clean form follows the new record; a form being
     edited keeps what the person typed, unless it already holds the saved values. */
  useEffect(() => {
    const next = draftOfProvider(provider);
    if (!form.dirty || sameProviderDraft(form.draft, next)) form.reset(next);
  }, [provider]);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await track("save", () => flows.save(provider.id, form.draft));
    if (result.ok) {
      if (result.value !== null) form.reset(draftOfProvider(result.value));
    } else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };
  const reason = saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : saveRequiredReason(form.draft);

  return (
    <WorkspaceFrame
      tab="providers"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Provider sections"
          back={{ label: "Providers", onPress: () => closeWorkspace("providers") }}
          sections={PROVIDER_SECTIONS}
          spy={spy}
        />
      }
      toolbar={
        <WorkspaceToolbar
          label="Provider toolbar"
          dirty={form.dirty}
          discard={{ label: "Discard changes", onPress: form.discard }}
          save={{ label: "Save", onPress: () => void save(), reason }}
          forward={{ label: "Titles →", onPress: () => requestTab("titles") }}
        />
      }
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div
          className="flex flex-col px-6 pb-8"
          style={{ "--label-col": labelColumn(PROVIDER_WORKSPACE_LABELS) } as CSSProperties}
        >
          <div ref={spy.bind("pv-details")}>
            <ProviderDetailsGroup
              draft={form.draft}
              created={provider.created_at}
              errors={form.errors}
              onChange={form.set}
            />
          </div>
          <div ref={spy.bind("pv-templates")}>
            <ProviderTemplatesGroup draft={form.draft} errors={form.errors} onChange={form.set} />
          </div>
          <div ref={spy.bind("pv-player")}>
            <ProviderPlayerGroup draft={form.draft} errors={form.errors} onChange={form.set} onRefuse={form.setError} />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One provider's workspace (`37` section 3.3), opened from the list already held: the rail (`‹ Providers`, Details,
 *  Templates, Player), a toolbar with `Discard changes`, `Save` and `Titles →`, and one scrolling page. One Save
 *  sends a `PUT` of only the changed fields. If the provider is no longer in a read list, the workspace closes with a
 *  notice. */
export function ProviderWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const provider = useAppStore((state) => state.providers.items.find((item) => String(item.id) === id));
  const status = useAppStore((state) => state.providers.status);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const say = useAppStore((state) => state.say);
  const gone = provider === undefined && status === "ready";

  useEffect(() => {
    if (!gone) return;
    closeWorkspace("providers");
    say(PROVIDER_GONE, "warn", "Provider");
  }, [gone, closeWorkspace, say]);

  return provider === undefined ? null : <Editor key={provider.id} provider={provider} active={active} />;
}
