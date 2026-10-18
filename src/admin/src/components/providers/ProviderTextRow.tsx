import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";

export interface ProviderTextRowProps {
  readonly label: string;
  readonly tip?: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
}

/** One text row of the provider workspace: the label (with its info tip), a field spanning the row with its own
 *  `aria-label`, and the refusal under it with `aria-invalid`. No placeholder (`28` Appendix A row 18). */
export function ProviderTextRow({ label, tip, value, error, onChange }: ProviderTextRowProps) {
  return (
    <Row label={label} tip={tip} error={error}>
      <Input
        value={value}
        className={FIELD_CONTROL}
        aria-label={label}
        aria-invalid={error !== undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </Row>
  );
}
