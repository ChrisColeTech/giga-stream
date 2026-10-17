import type { CSSProperties, ReactNode } from "react";
import { labelColumn } from "@/components/ui/NumberField";
import { Section } from "@/components/ui/Section";
import { useAppStore } from "@/store/app-store";

/* One label column for every playback row, sized to the longest label the pane renders (LoRA Studio's rail rows). */
const LABEL_COLUMN = { "--label-col": labelColumn(["Resolution", "Live edge"]) } as CSSProperties;

export interface PlaybackSectionProps {
  /** The fold key in the store; a section keeps its fold across a surface switch. */
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

/** One of the five collapsible groups of the playback settings, on the family accordion (LoRA Studio's compose rail). */
export function PlaybackSection({ id, title, children }: PlaybackSectionProps) {
  const open = useAppStore((state) => state.folded[id] !== true);
  const toggleFold = useAppStore((state) => state.toggleFold);
  return (
    <Section title={title} open={open} onToggle={() => toggleFold(id)}>
      <div className="flex flex-col gap-1.25" style={LABEL_COLUMN}>
        {children}
      </div>
    </Section>
  );
}
