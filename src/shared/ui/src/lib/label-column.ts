/** Manrope semibold at 14px averages ~8px a character. Size the label column to the longest label a group renders, plus the info glyph. */
export function labelColumn(labels: readonly string[]): string {
  const longest = labels.reduce((widest, label) => Math.max(widest, label.length), 0)
  return `${Math.max(120, Math.ceil(longest * 8) + 36)}px`
}
