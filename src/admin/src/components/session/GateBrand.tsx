import { Tv } from "lucide-react";
import { GATE_BRAND_HEADLINE } from "@/constants/sign-in-copy";

/** The gate's left column, the Giga Images wall's brand column in the admin's words (`34` section 2): the lockup and a
 *  mono headline; no paragraph of explanation (`01` section 9: no sentence the screen does not need). Hidden under 720px,
 *  where the form takes the whole width. */
export function GateBrand() {
  return (
    <div className="hidden w-[44%] max-w-130 min-w-80 flex-col justify-center gap-4.5 border-r border-hair bg-panel px-12 min-[720px]:flex">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7.5 place-items-center rounded-card bg-accent">
          <Tv className="size-4 text-accent-ink" aria-hidden />
        </span>
        <span className="flex flex-col font-mono leading-[1.12] tracking-[.1em]">
          <b className="text-sm font-semibold text-text">GIGA</b>
          <i className="text-sm font-medium text-faint not-italic">STREAM ADMIN</i>
        </span>
      </div>
      <h1 className="m-0 font-mono text-2xl leading-[1.3] font-semibold text-text">{GATE_BRAND_HEADLINE}</h1>
    </div>
  );
}
