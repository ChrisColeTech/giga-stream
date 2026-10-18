import { Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { cn } from "@giga/ui/lib/cn";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";

export interface FileRowProps {
  readonly label?: string;
  readonly tip: string;
  /** The chosen file's name; empty before one is chosen. */
  readonly value: string;
  /** What the hidden input accepts (`.m3u,.m3u8,audio/x-mpegurl`). */
  readonly accept: string;
  /** The button's tooltip at rest. */
  readonly chooseTitle: string;
  /** A refusal under the row (the page's or the backend's). */
  readonly error?: string;
  /** Why `Choose file` cannot open the dialog now; undefined when it works. */
  readonly chooseReason?: string;
  /** A file was chosen. It is held by the form and read only when the form is committed. */
  readonly onChoose: (file: File) => void;
}

/** A file from this machine (`43` section 4.1, modelled on `FolderRow`): the row's label, a read-only mono field showing
 *  the chosen file's name, and a trailing ghost `Choose file` with its `Upload` glyph. The button opens a hidden file
 *  input (the LoRA Studio `ImagesGroup` pattern); the chosen file is handed to the form, never uploaded here. The input
 *  is emptied after each choice so the same file can be chosen again. No placeholder: the format rides the tip. */
export function FileRow({ label = "File", tip, value, accept, chooseTitle, error, chooseReason, onChoose }: FileRowProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row
      label={label}
      tip={tip}
      error={error}
      trailing={
        <Button variant="ghost" title={chooseTitle} reason={chooseReason} onClick={() => input.current?.click()}>
          <Upload aria-hidden /> Choose file
        </Button>
      }
    >
      <Input
        value={value}
        readOnly
        className={cn(FIELD_CONTROL, "font-mono")}
        aria-label={label}
        aria-invalid={error !== undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-label={`${label} picker`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) onChoose(file);
        }}
      />
    </Row>
  );
}
