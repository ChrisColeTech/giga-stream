import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { ProvidersIndex } from "@/components/providers/ProvidersIndex";
import { ProviderWorkspace } from "@/components/providers/ProviderWorkspace";
import { useProvidersLoad } from "@/hooks/useProvidersLoad";
import { useAppStore } from "@/store/app-store";

/** Providers: the index (bulk toolbar with `Titles →`, `New provider`, the list) or, when a row is open, that provider's
 *  workspace. The page is the only reader of `workspaces.providers`. It loads the providers when first shown in a
 *  session. */
export function ProvidersPage({ active }: PageProps) {
  const openId = useAppStore((state) => state.workspaces.providers);
  useProvidersLoad(active);
  return (
    <TabPage active={active} label="Providers">
      {openId === null ? <ProvidersIndex /> : <ProviderWorkspace id={openId} active={active} />}
    </TabPage>
  );
}
