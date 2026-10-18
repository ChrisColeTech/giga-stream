import { createContext } from "react";

/** The three-state `All` of an index table (`01` section 9): it is the header row's tick, in the checkbox column right
 *  above the row ticks. */
export interface SelectAll {
  /** `Select all channels`: the accessible name. */
  readonly label: string;
  /** All, none (`false`) or some (`"mixed"`) of the listed rows are ticked. */
  readonly checked: boolean | "mixed";
  /** Called with `true` from none or some (select all), `false` from all (clear). */
  readonly onToggle: (checked: boolean) => void;
  /** Nothing is listed yet. */
  readonly disabled?: boolean;
}

export const SelectAllContext = createContext<SelectAll | null>(null);
