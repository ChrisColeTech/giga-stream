const pad = (value: number): string => String(value).padStart(2, "0");

/** A duration as the playlist shows it: `00:42`, `12:08`, and `1:02:03` once it passes the hour. Whole seconds, rounded
 *  down; a negative or non-finite value is zero. */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
