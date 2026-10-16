import type { ReactNode } from "react";
import { RailSection } from "@/components/ui/RailSection";

export interface PlaybackSectionProps {
  /** The fold key in the store; a section keeps its fold across a surface switch. */
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

/** One of the five collapsible groups of the playback settings: the rail group's header folds its rows (`06` section 2.8). */
export function PlaybackSection({ id, title, children }: PlaybackSectionProps) {
  return (
    <RailSection id={id} title={title}>
      {children}
    </RailSection>
  );
}
