import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_PROVIDER_LABELS } from "@/constants/provider-copy";
import { NewProviderForm } from "./NewProviderForm";
import { ProvidersList } from "./ProvidersList";

/** The Providers index: `New provider` and the list, whose table strip holds the bulk verbs and the `Go to Titles`
 *  icon. No page toolbar sits above them. */
export function ProvidersIndex() {
  return (
    <Workspace labels={NEW_PROVIDER_LABELS}>
      <NewProviderForm />
      <ProvidersList />
    </Workspace>
  );
}
