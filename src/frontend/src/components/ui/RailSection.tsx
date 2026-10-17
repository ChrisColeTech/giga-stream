import type { ReactNode } from "react";
import { Section } from "./Section";

export interface RailSectionProps {
  /** Stable id: the key the section's fold state is kept under in the store. */
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

/** A rail's collapsible group. It is the shared `Section`, so a rail and an inspector fold the same way. */
export function RailSection({ id, title, children }: RailSectionProps) {
  return (
    <Section id={id} title={title}>
      {children}
    </Section>
  );
}
