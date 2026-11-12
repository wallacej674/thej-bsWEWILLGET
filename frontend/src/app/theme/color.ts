/**
 * A translucent version of any CSS colour, including `var(--token)` colours,
 * so tints follow the active light or dark theme.
 */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
