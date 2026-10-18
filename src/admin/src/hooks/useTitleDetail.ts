import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import type { TitleDetailState } from "@/store/titles-slice";
import { useTitleFlows } from "./useTitleFlows";

/** The open title's detail (`37` section 4.3): read once when the workspace opens on an id (`GET /api/titles/:id?
 *  includeDisabled=true`, the fields a list row lacks), never again by itself. Undefined until the read starts. */
export function useTitleDetail(id: string): TitleDetailState | undefined {
  const flows = useTitleFlows();
  const signedIn = useAppStore((state) => state.signedIn);
  const detail = useAppStore((state) => (state.titles.detail?.id === id ? state.titles.detail : undefined));

  useEffect(() => {
    if (signedIn) void flows.detail(id);
  }, [id, signedIn, flows]);

  return detail;
}
