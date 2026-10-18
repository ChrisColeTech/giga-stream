import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_PROVIDER_LABELS } from "@/constants/provider-copy";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NewProviderForm } from "./NewProviderForm";
import { ProvidersList } from "./ProvidersList";

/** The Providers index: the toolbar with the `Titles` arrow over `New provider` and the list, whose table strip holds
 *  the bulk verbs. */
export function ProvidersIndex() {
  return (
    <>
      <IndexToolbar frame={INDEX_FRAMES.providers} />
      <Workspace labels={NEW_PROVIDER_LABELS}>
        <NewProviderForm />
        <ProvidersList />
      </Workspace>
    </>
  );
}
