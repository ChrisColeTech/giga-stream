import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_PROVIDER_LABELS } from "@/constants/provider-copy";
import { NewProviderForm } from "./NewProviderForm";
import { ProvidersList } from "./ProvidersList";
import { ProvidersToolbar } from "./ProvidersToolbar";

/** The Providers index: the bulk toolbar with `Titles →` over `New provider` and the list. */
export function ProvidersIndex() {
  return (
    <>
      <ProvidersToolbar />
      <Workspace labels={NEW_PROVIDER_LABELS}>
        <NewProviderForm />
        <ProvidersList />
      </Workspace>
    </>
  );
}
