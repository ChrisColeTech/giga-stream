import { Eye } from "lucide-react";
import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { Button } from "@giga/ui/controls/Button";
import { DELETE_PROVIDER_TITLE, PREVIEW_PROVIDER_TOOLTIP } from "@/constants/provider-copy";
import { canPreviewProvider } from "@/lib/provider-rows";
import type { AdminProvider } from "@/services/schemas/provider-schema";

export interface ProviderActionsProps {
  readonly provider: AdminProvider;
  /** Why Delete is disabled (a write running, the backend unreachable); undefined when it works. */
  readonly deleteReason: string | undefined;
  /** Why the eye is disabled (the backend unreachable: the window reads nothing); undefined when it works. */
  readonly previewReason: string | undefined;
  readonly onPreview: (providerId: number) => void;
  readonly onDelete: () => void;
}

/** The end cell of a provider row (`55` decision 4), the channels' own eye beside the armed `Delete`: `Preview provider`
 *  opens the provider preview window for this row. The eye is ABSENT - never disabled - for a stream-family provider or a
 *  template-less one (there is no embed to preview, as the channels' `Mark` is absent for a live-kind channel), and
 *  disabled with its reason while the backend cannot be reached. */
export function ProviderActions({ provider, deleteReason, previewReason, onPreview, onDelete }: ProviderActionsProps) {
  return (
    <span className="flex items-center gap-1">
      {canPreviewProvider(provider) && (
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          aria-label={PREVIEW_PROVIDER_TOOLTIP}
          title={previewReason === undefined ? PREVIEW_PROVIDER_TOOLTIP : undefined}
          reason={previewReason}
          onClick={() => onPreview(provider.id)}
        >
          <Eye aria-hidden />
        </Button>
      )}
      <ArmedButton
        question={`Delete ${provider.name}?`}
        disabled={deleteReason !== undefined}
        title={deleteReason ?? DELETE_PROVIDER_TITLE}
        onConfirm={onDelete}
      >
        Delete
      </ArmedButton>
    </span>
  );
}