// Member avatar helpers shared by the app shell and the dashboard, so a
// person's initials and colour are the same everywhere they appear.

// Business palette of mid-tones; initials on top are white in both themes.
export const AVATAR_COLORS = [
  "#2563eb", // blue
  "#4f46e5", // indigo
  "#0d9488", // teal
  "#7c3aed", // violet
  "#0284c7", // sky
  "#475569", // slate
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
