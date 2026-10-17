import { ToolbarStrip } from "@giga/ui/shell/ToolbarStrip";
import type { IndexFrame } from "@/constants/index-frames";
import { indexVerbs } from "@/lib/index-verbs";
import { useAppStore } from "@/store/app-store";

/** An index's toolbar strip: the forward verb and nothing else (`28` section 9, item 1). Always drawn, even empty, so
 *  the page below keeps its place from tab to tab. */
export function IndexToolbar({ frame }: { readonly frame: IndexFrame }) {
  const requestTab = useAppStore((state) => state.requestTab);
  return <ToolbarStrip label={`${frame.listTitle} toolbar`} verbs={indexVerbs(frame.forward, (tab) => requestTab(tab))} />;
}
