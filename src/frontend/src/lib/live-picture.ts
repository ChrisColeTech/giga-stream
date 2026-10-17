import type { PictureFit } from "@/types/settings";

/* How the picture sits in the stage changes only the element's object-fit, never the stream (`06` section 3.3). */
export type { PictureFit };

export interface PictureFitOption {
  readonly value: PictureFit;
  readonly label: string;
}

export const PICTURE_FIT_OPTIONS: readonly PictureFitOption[] = [
  { value: "fit", label: "Fit" },
  { value: "fill", label: "Fill" },
  { value: "original", label: "Original" },
];

export type ObjectFit = "contain" | "cover" | "none";

const OBJECT_FIT: Record<PictureFit, ObjectFit> = {
  fit: "contain",
  fill: "cover",
  original: "none",
};

export function objectFitOf(fit: PictureFit): ObjectFit {
  return OBJECT_FIT[fit];
}
