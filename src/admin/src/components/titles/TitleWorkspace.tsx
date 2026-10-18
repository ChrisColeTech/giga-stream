import { useEffect } from "react";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { LOADING_REASON, TITLE_GONE } from "@/constants/title-copy";
import { useTitleDetail } from "@/hooks/useTitleDetail";
import { useAppStore } from "@/store/app-store";
import { TitleEditor } from "./TitleEditor";
import { TitleFrame } from "./TitleFrame";
import { TitleSkeletonPage } from "./TitleSkeletonPage";

const NOTHING = (): void => undefined;

/** One title's workspace (`37` section 4.3). It opens from the held row, then reads the detail for the fields a list
 *  row lacks; until that answers its groups wear shimmer lines in their shape and Discard and Save wait with
 *  `Loading.`. A movie has no Seasons item or group. If the title is gone, the workspace closes with a notice. */
export function TitleWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const row = useAppStore((state) => state.titles.items.find((item) => item.id === id));
  const requestTab = useAppStore((state) => state.requestTab);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const say = useAppStore((state) => state.say);
  const detail = useTitleDetail(id);
  const value = detail?.status === "ready" ? detail.value : null;
  const gone = row === undefined && value === null && detail?.status === "failed";

  useEffect(() => {
    if (!gone) return;
    closeWorkspace("titles");
    say(TITLE_GONE, "warn", "Title");
  }, [gone, closeWorkspace, say]);

  const jobs = { label: "Jobs →", onPress: () => requestTab("jobs") };
  if (value !== null) return <TitleEditor key={id} detail={value} active={active} jobs={jobs} />;
  const series = row?.kind === "tv";
  return (
    <TitleFrame
      series={series}
      active={active}
      toolbar={
        <WorkspaceToolbar
          label="Title toolbar"
          dirty
          discard={{ label: "Discard changes", onPress: NOTHING, reason: LOADING_REASON }}
          save={{ label: "Save", onPress: NOTHING, reason: LOADING_REASON }}
          forward={jobs}
        />
      }
    >
      {(spy) => <TitleSkeletonPage series={series} bind={spy.bind} />}
    </TitleFrame>
  );
}
