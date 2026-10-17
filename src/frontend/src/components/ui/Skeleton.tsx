import type { CSSProperties } from "react";
import { SHIMMER } from "@/constants/skeleton";
import { cn } from "@/lib/cn";

/** A caller that sizes the block itself (a height, an inset, an absolute fill) takes over from the default text-line height. */
const SIZED = /(^|\s)(h-|inset-|absolute|size-)/;

/** One shimmer block: the loading and empty treatment every region wears. Without a size of its own it is a text line
 *  (9 px high); with one, it is the size the caller gives. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  const sized = className !== undefined && SIZED.test(className);
  return <span aria-hidden className={cn(SHIMMER, !sized && "h-[9px]", className)} style={style} />;
}
