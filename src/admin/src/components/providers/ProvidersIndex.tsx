import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_PROVIDER_LABELS } from "@/constants/provider-copy";
import { NewProviderForm } from "./NewProviderForm";
import { ProvidersList } from "./ProvidersList";

/** The Providers index: the page toolbar with `Titles →` on the right, over `New provider` and the list, whose first row
 *  holds the bulk verbs. */
export function ProvidersIndex() {
  return (
    <>
      <IndexToolbar tab="providers" />
      <Workspace labels={NEW_PROVIDER_LABELS} fill>
        <NewProviderForm />
        <ProvidersList />
      </Workspace>
    </>
  );
}
