const pad = (value: number): string => String(value).padStart(2, "0");

/** A time as the lists show it: `YYYY-MM-DD HH:mm`, in the machine's own zone, built from the local parts. `never`
 *  when the moment does not exist (an account that has not signed in yet). */
export function formatWhen(ms: number | undefined): string {
  if (ms === undefined) return "never";
  const date = new Date(ms);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
