import type { CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import {
  PREVIEW_PROVIDER_TOOLTIP,
  PROVIDER_GONE,
  PROVIDER_SECTIONS,
  PROVIDER_SECTION_KEYS,
  PROVIDER_WORKSPACE_LABELS,
  SAVE_PROVIDER_FIRST,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/provider-copy";
import { PREVIEW_ARROW_LABEL } from "@/constants/preview-copy";
import { useFollowRecord } from "@/hooks/useFollowRecord";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useProviderPreviewOpen } from "@/hooks/useProviderPreviewOpen";
import { useWorkspaceGone } from "@/hooks/useWorkspaceGone";
import { useRecordForm } from "@/hooks/useRecordForm";
import { canPreviewProvider } from "@/lib/provider-rows";
import { saveRequiredReason } from "@/lib/provider-checks";
import { draftOfProvider, sameProviderDraft } from "@/lib/provider-draft";
import { changeReason, type ToolbarVerb } from "@/lib/workspace-verbs";
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
  const openPreview = useProviderPreviewOpen();
  const spy = useScrollSpy(PROVIDER_SECTION_KEYS, PROVIDER_SECTION_KEYS[0] ?? "pv-details");

  useFollowRecord(form, provider, draftOfProvider, sameProviderDraft);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await track("save", () => flows.save(provider.id, form.draft));
    if (result.ok) {
      if (result.value !== null) form.reset(draftOfProvider(result.value));
    } else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };
  const reason = saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : saveRequiredReason(form.draft);

  /* The promote (`55` decision 2): `Preview →`, the `PromoteButton`'s shape, opens the provider preview of the SAVED
     provider - `Save the provider first` while the draft differs. A stream-family provider or a template-less one has
     no embed to preview, so the promote is absent (as its row's eye is). */
  const promote: ToolbarVerb | undefined = canPreviewProvider(provider)
    ? {
        label: PREVIEW_ARROW_LABEL,
        tip: PREVIEW_PROVIDER_TOOLTIP,
        reason: form.dirty ? SAVE_PROVIDER_FIRST : undefined,
        onPress: () => openPreview(provider.id),
      }
    : undefined;

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
          dirty={form.dirty}
          onDiscard={form.discard}
          save={{ onPress: () => void save(), reason: changeReason(form.dirty, reason) }}
          promote={promote}
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
            <ProviderPlayerGroup
              draft={form.draft}
              errors={form.errors}
              onChange={form.set}
              onRefuse={form.setError}
            />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One provider's workspace (`37` section 3.3), opened from the list already held: the rail (`‹ Providers`, Details,
 *  Templates, Player), the page toolbar (`Discard changes` left; `Save`, then the promote `Preview →` rightmost, `55`
 *  decision 2) and one scrolling page. One Save sends a `PUT` of only the changed fields. If the provider is no longer in a read list, the workspace closes with a
 *  notice. */
export function ProviderWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const provider = useAppStore((state) => state.providers.items.find((item) => String(item.id) === id));
  const status = useAppStore((state) => state.providers.status);
  useWorkspaceGone("providers", provider === undefined && status === "ready", PROVIDER_GONE, "Provider");

  return provider === undefined ? null : <Editor key={provider.id} provider={provider} active={active} />;
}
