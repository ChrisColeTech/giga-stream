import { ChannelsIndex } from "@/components/channels/ChannelsIndex";
import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { useChannelsLoad } from "@/hooks/useChannelsLoad";
import { useAppStore } from "@/store/app-store";

/** Channels (`36`): the index (the toolbar with the bulk verbs and `Preview →`, `New channel`, the list) or, when a row is
 *  open, that channel's workspace, live or stream. The page is the only reader of `workspaces.channels`; it loads the
 *  channels when first shown after sign-in and keeps the statusbar's `N preparing`. */
export function ChannelsPage({ active }: PageProps) {
  const openId = useAppStore((state) => state.workspaces.channels);
  useChannelsLoad(active);
  return (
    <TabPage active={active} label="Channels">
      {openId === null ? <ChannelsIndex /> : <ChannelsIndex />}
    </TabPage>
  );
}
