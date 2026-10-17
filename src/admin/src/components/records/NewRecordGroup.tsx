import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";

/** The group's last verb: `Create`, disabled with the missing field's reason (`<Label> is required.`) while a required
 *  field is empty (the template's model, `28` Appendix A row 12). */
export interface CreateVerb {
  readonly onPress: () => void;
  readonly reason?: string;
  readonly label?: string;
}

export interface NewRecordGroupProps {
  /** Prefixed by the page (`ch-create`), so two groups never fold together. */
  readonly id: string;
  /** The tile: `plus`, or `user-plus` for an account. */
  readonly icon: LucideIcon;
  /** `New channel`. */
  readonly title: string;
  /** The form's rows. */
  readonly children: ReactNode;
  /** Absent while the form has no fields to create from (a page still loading). */
  readonly create?: CreateVerb;
}

/** The `New <record>` frame every index opens with: the tile, the mono title, the fold, the page's rows, and the one
 *  primary `Create` ending the group (`28` section 6.1). The group draws the splitter after itself. */
export function NewRecordGroup({ id, icon, title, children, create }: NewRecordGroupProps) {
  return (
    <Group id={id} icon={icon} title={title}>
      {children}
      {create !== undefined && (
        <Actions>
          <Button variant="primary" reason={create.reason} onClick={create.onPress}>
            {create.label ?? "Create"}
          </Button>
        </Actions>
      )}
    </Group>
  );
}
