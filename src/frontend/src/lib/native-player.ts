import { stableAddressOf } from "@/lib/player-sources";

export const positionOf = (media: HTMLVideoElement): [number, number | undefined] => [
  Math.round(media.currentTime * 1000),
  Number.isFinite(media.duration) && media.duration > 0 ? Math.round(media.duration * 1000) : undefined,
];

export const isHlsAddress = (url: string): boolean => /\.m3u8(?:$|[?#])/i.test(url);

export const nativeAttachmentKey = (url: string, retry: number): string =>
  `${stableAddressOf(url)}\u0000${retry}`;

export function pauseForStop(media: { readonly pause: () => void } | null | undefined): void {
  media?.pause();
}
