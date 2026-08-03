export interface FamilyColor {
  main: string;
  bg: string;
}

// Each family pinned to a distinct hue — add new families here to avoid fallback clashes
export const FAMILY_COLORS: Record<string, FamilyColor> = {
  // ── Real families (from data) ─────────────────────────────────────────────
  boissons:   { main: '#2563eb', bg: 'rgba(37,99,235,0.10)'  },  // 220° blue
  huile:      { main: '#16a34a', bg: 'rgba(22,163,74,0.10)'  },  // 140° green
  sucre:      { main: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },  //  55° amber
  sauces:     { main: '#ef4444', bg: 'rgba(239,68,68,0.10)'  },  //   0° red
  margarine:  { main: '#ec4899', bg: 'rgba(236,72,153,0.10)' },  // 322° pink
  assila:     { main: '#84cc16', bg: 'rgba(132,204,22,0.10)' },  //  84° lime
  chocolat:   { main: '#92400e', bg: 'rgba(146,64,14,0.10)'  },  //  28° chocolate
  confitures: { main: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },  // 262° violet
  fromage:    { main: '#06b6d4', bg: 'rgba(6,182,212,0.10)'  },  // 188° cyan
  // ── Generic extras ───────────────────────────────────────────────────────
  farine:     { main: '#f97316', bg: 'rgba(249,115,22,0.10)' },  //  28° orange
  lait:       { main: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },  // 200° sky
  sel:        { main: '#64748b', bg: 'rgba(100,116,139,0.10)'},  // neutral slate
  the:        { main: '#10b981', bg: 'rgba(16,185,129,0.10)' },  // 160° emerald
  cafe:       { main: '#b45309', bg: 'rgba(180,83,9,0.10)'   },  //  30° warm brown
  biscuits:   { main: '#f43f5e', bg: 'rgba(244,63,94,0.10)'  },  // 351° rose
  confiserie: { main: '#a855f7', bg: 'rgba(168,85,247,0.10)' },  // 270° purple
  conserves:  { main: '#14b8a6', bg: 'rgba(20,184,166,0.10)' },  // 174° teal
  detergent:  { main: '#6366f1', bg: 'rgba(99,102,241,0.10)' },  // 240° indigo
};

// General-purpose chart color palette (donut segments, bar items, etc.)
export const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#a855f7',
];

const FALLBACK_MAINS = CHART_COLORS;

// Returns main color for a family, with consistent fallback for unknown families
export function getFamilyColor(nom: string): string {
  const key = nom.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents: thé→the, café→cafe
  return FAMILY_COLORS[key]?.main ?? FALLBACK_MAINS[stableIndex(key)];
}

export function getFamilyBg(nom: string): string {
  const key = nom.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (FAMILY_COLORS[key]) return FAMILY_COLORS[key].bg;
  const main = FALLBACK_MAINS[stableIndex(key)];
  return hexToRgba(main, 0.10);
}

// Deterministic index so unknown families always get the same color
function stableIndex(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % FALLBACK_MAINS.length;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
