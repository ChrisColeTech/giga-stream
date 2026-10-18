import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { ProvidersIndex } from "@/components/providers/ProvidersIndex";
import { useProvidersLoad } from "@/hooks/useProvidersLoad";

/** Providers: the index (bulk toolbar with `Titles →`, `New provider`, the list). It loads the providers when first
 *  shown in a session. */
export function ProvidersPage({ active }: PageProps) {
  useProvidersLoad(active);
  return (
    <TabPage active={active} label="Providers">
      <ProvidersIndex />
    </TabPage>
  );
}
