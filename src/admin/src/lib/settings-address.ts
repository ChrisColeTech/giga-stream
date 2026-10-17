/** The address a commit sends, or null when there is nothing new to send. The draft is trimmed, and a value equal to the last
 *  one sent is not sent again: Enter followed by leaving the field sends once, and a refused address is not resent until
 *  it is edited. */
export function addressToSend(draft: string, lastSent: string): string | null {
  const next = draft.trim();
  return next === lastSent ? null : next;
}
