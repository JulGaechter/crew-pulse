/**
 * CrewPulse-Design "Midnight Ice": dunkler Grund, hellblaue Symbole.
 * Alle Farben, Schriften und Rundungen der App kommen von hier.
 */

export const C = {
  // Flächen (von hinten nach vorne)
  bg: '#0A0D14',
  surface: '#121722',
  raised: '#1A2130',
  bubbleOther: '#151B27',
  border: '#1E2635',
  borderStrong: '#2A3344',

  // Text
  text: '#EEF2F8',
  textSoft: '#C5CCDA',
  textMuted: '#8A94A8',

  // Akzent
  accent: '#7CD4FF', // Icons, Knöpfe, eigene Nachrichten
  accentSoft: '#14324A', // leise Akzentfläche (Chips, ausgewählte Tabs)
  accentBorder: '#17405F',
  onAccent: '#0A0D14', // Text/Icons auf Hellblau
  onAccentMuted: '#1F4A63', // Zeit, Nebeninfo auf Hellblau
  hintBg: '#0F2234',
  hintText: '#C9E9FF',

  // Status
  online: '#34D399',
  danger: '#FF7A85',
  dangerBg: '#1A1214',
  dangerBorder: '#3B1D22',
  warning: '#F5B86B',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

/** Namen der geladenen Schriften (siehe app/_layout.tsx) */
export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

export const R = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

/** Avatar-Farben (Hintergrund + Schrift), gewählt aus dem Namen */
const AVATAR_PALETTE: readonly [string, string][] = [
  ['#14324A', '#7CD4FF'],
  ['#3A2618', '#F5B86B'],
  ['#13332A', '#86E3B5'],
  ['#2A2440', '#C4B5FD'],
  ['#3A1F2C', '#F9A8D4'],
  ['#1E3333', '#5EEAD4'],
];

function hash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarColors(name: string) {
  const [bg, fg] = AVATAR_PALETTE[hash(name) % AVATAR_PALETTE.length];
  return { bg, fg };
}

/** Namensfarbe im Chat (gut lesbar auf dunklen Bubbles) */
export function nameColor(name: string) {
  return avatarColors(name).fg;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}
