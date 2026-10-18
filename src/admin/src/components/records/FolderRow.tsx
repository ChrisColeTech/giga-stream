import { FolderOpen } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { cn } from "@giga/ui/lib/cn";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";

export interface FolderRowProps {
  readonly label?: string;
  readonly tip: string;
  readonly value: string;
  /** A refusal under the row (the page's or the backend's `That folder does not exist.`). */
  readonly error?: string;
  readonly onChange: (value: string) => void;
  /** Why `Choose` cannot open a dialog here (a plain browser); undefined in the backend's own window. */
  readonly chooseReason?: string;
  /** Opens the backend window's folder dialog; a chosen path is written into the field only, never saved. */
  readonly onChoose: () => void;
  readonly onEnter?: () => void;
}

/** A folder on the backend machine (`28` Appendix A row 17, `36` section 5.1): the row's label and glyph, a mono path
 *  field spanning the row, and a trailing ghost `Choose` with its folder glyph. Without the backend's window the button
 *  stays in place, disabled with its reason, and the path is typed. No placeholder: the format rides the tip. */
export function FolderRow({ label = "Folder", tip, value, error, onChange, chooseReason, onChoose, onEnter }: FolderRowProps) {
  return (
    <Row
      label={label}
      tip={tip}
      error={error}
      trailing={
        <Button variant="ghost" reason={chooseReason} onClick={onChoose}>
          <FolderOpen aria-hidden /> Choose
        </Button>
      }
    >
      <Input
        value={value}
        className={cn(FIELD_CONTROL, "font-mono")}
        aria-label={label}
        aria-invalid={error !== undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
      />
    </Row>
  );
}
