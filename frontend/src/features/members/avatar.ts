// Member avatar helpers shared by the app shell and the dashboard, so a
// person's initials and colour are the same everywhere they appear.

// Warm palette that sits on the gold theme; the text on top is #1a130b.
export const AVATAR_COLORS = [
  "#d6a844", // gold
  "#c8743e", // burnt orange
  "#b08968", // taupe
  "#c2a25a", // wheat
  "#a9774a", // bronze
  "#cd8a5c", // clay
] as const;

export function avatarColor(id: string): string {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
