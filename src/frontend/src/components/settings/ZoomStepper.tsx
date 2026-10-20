import { Minus, Plus } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { ZOOM_AT_MAX, ZOOM_AT_MIN } from "@/constants/settings-sections";
import { canStepZoom, formatZoom, stepZoom } from "@giga/ui/lib/settings-zoom";

export interface ZoomStepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/** UI zoom: a minus, the value to one decimal, and a plus. Each press applies at once. At either end its step is
  *  disabled, and the reason rides on the kit's focusable tooltip. */
export function ZoomStepper({ value, onChange }: ZoomStepperProps) {
  const lower = canStepZoom(value, -1) ? undefined : ZOOM_AT_MIN;
  const higher = canStepZoom(value, 1) ? undefined : ZOOM_AT_MAX;

  return (
    <span role="group" aria-label="UI zoom" className="inline-flex items-center gap-2">
      <IconButton aria-label="Zoom out" title="Zoom out" reason={lower}
        onClick={() => onChange(stepZoom(value, -1))}>
        <Minus className="size-3.5" aria-hidden />
      </IconButton>
      <span className="w-10 text-center font-mono text-sm tabular-nums text-text">{formatZoom(value)}</span>
      <IconButton aria-label="Zoom in" title="Zoom in" reason={higher}
        onClick={() => onChange(stepZoom(value, 1))}>
        <Plus className="size-3.5" aria-hidden />
      </IconButton>
    </span>
  );
}
