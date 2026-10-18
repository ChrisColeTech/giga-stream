import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";

export interface TitleTextRowProps {
  readonly label: string;
  readonly tip?: string;
  readonly value: string;
  readonly error?: string | undefined;
  readonly onChange?: (value: string) => void;
  /** A fact shown in a field: the Kind, a synced title's TMDB id. */
  readonly readOnly?: boolean;
  readonly inputMode?: "numeric" | "decimal";
}

/** One text row of the title workspace: the label (with its info tip), a field spanning the row with its own
 *  `aria-label`, and the refusal under it with `aria-invalid`. No placeholder (`28` Appendix A row 18). */
export function TitleTextRow({ label, tip, value, error, onChange, readOnly = false, inputMode }: TitleTextRowProps) {
  return (
    <Row label={label} tip={tip} error={error}>
      <Input
        value={value}
        readOnly={readOnly}
        inputMode={inputMode}
        className={FIELD_CONTROL}
        aria-label={label}
        aria-invalid={error !== undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </Row>
  );
}
