import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ZOOM_AT_MAX, ZOOM_AT_MIN } from "@/constants/settings-sections";
import { canStepZoom, formatZoom, stepZoom } from "@/lib/settings-zoom";

export interface ZoomStepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/** UI zoom: a minus, the value to one decimal, and a plus. Each press applies at once. At either end its step is
 *  disabled, and the reason rides on the step as its tooltip; the wrapper carries it because a disabled icon button
 *  takes no pointer, so its own tooltip would never show. */
export function ZoomStepper({ value, onChange }: ZoomStepperProps) {
  const lower = canStepZoom(value, -1) ? undefined : ZOOM_AT_MIN;
  const higher = canStepZoom(value, 1) ? undefined : ZOOM_AT_MAX;

  return (
    <span role="group" aria-label="UI zoom" className="inline-flex items-center gap-2">
      <span title={lower} className="inline-flex">
        <IconButton
          bordered
          aria-label="Zoom out"
          title={lower ?? "Zoom out"}
          disabled={lower !== undefined}
          onClick={() => onChange(stepZoom(value, -1))}
        >
          <Minus className="size-3.5" aria-hidden />
        </IconButton>
      </span>
      <span className="w-10 text-center font-mono text-sm tabular-nums text-text">{formatZoom(value)}</span>
      <span title={higher} className="inline-flex">
        <IconButton
          bordered
          aria-label="Zoom in"
          title={higher ?? "Zoom in"}
          disabled={higher !== undefined}
          onClick={() => onChange(stepZoom(value, 1))}
        >
          <Plus className="size-3.5" aria-hidden />
        </IconButton>
      </span>
    </span>
  );
}
