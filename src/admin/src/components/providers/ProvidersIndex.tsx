import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_PROVIDER_LABELS } from "@/constants/provider-copy";
import { useIndexPreviewPromote } from "@/hooks/useIndexPreviewPromote";
import { NewProviderForm } from "./NewProviderForm";
import { ProvidersList } from "./ProvidersList";

/** The Providers index: Preview promotes exactly one previewable ticked provider. */
export function ProvidersIndex() {
  const promote = useIndexPreviewPromote("providers");
  return (
    <>
      <IndexToolbar promote={promote} />
      <Workspace labels={NEW_PROVIDER_LABELS} fill>
        <NewProviderForm />
        <ProvidersList />
      </Workspace>
    </>
  );
}
