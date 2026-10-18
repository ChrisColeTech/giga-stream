import { DiscardBar } from "@/components/records/DiscardBar";
import { LOADING_REASON, TITLE_GONE } from "@/constants/title-copy";
import { useTitleDetail } from "@/hooks/useTitleDetail";
import { useWorkspaceGone } from "@/hooks/useWorkspaceGone";
import { useAppStore } from "@/store/app-store";
import { TitleEditor } from "./TitleEditor";
import { TitleFrame } from "./TitleFrame";
import { TitleSkeletonPage } from "./TitleSkeletonPage";

const NOTHING = (): void => undefined;

/** One title's workspace (`37` section 4.3). It opens from the held row, then reads the detail for the fields a list
 *  row lacks; until that answers its groups wear shimmer lines in their shape and Discard waits with `Loading.`. A movie has no Seasons item or group. If the title is gone, the workspace closes with a notice. */
export function TitleWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const row = useAppStore((state) => state.titles.items.find((item) => item.id === id));
  const detail = useTitleDetail(id);
  const value = detail?.status === "ready" ? detail.value : null;
  useWorkspaceGone("titles", row === undefined && value === null && detail?.status === "failed", TITLE_GONE, "Title");

  if (value !== null) return <TitleEditor key={id} detail={value} active={active} />;
  const series = row?.kind === "tv";
  return (
    <TitleFrame
      series={series}
      active={active}
      bar={<DiscardBar dirty onDiscard={NOTHING} blocked={LOADING_REASON} />}
    >
      {(spy) => <TitleSkeletonPage series={series} bind={spy.bind} />}
    </TitleFrame>
  );
}
