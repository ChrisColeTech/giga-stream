import type { CSSProperties } from "react";
import { SHIMMER } from "@/constants/skeleton";
import { cn } from "@/lib/cn";

/** One shimmer block: the loading and empty treatment every region wears. Its size comes from the caller. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cn(SHIMMER, "h-[9px]", className)} style={style} />;
}
