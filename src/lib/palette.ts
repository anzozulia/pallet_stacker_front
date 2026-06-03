// Pure, deterministic box-type -> colour palette (D-09). Deterministic so a given
// type always gets the same swatch across renders and the legend stays stable.
// Seeded by the mockup's three colours; extra types extend harmoniously by spinning
// hue in HSL while keeping S/L near the seeds so the legend reads as one family.
// Pure — no `three`, no React, no IO — safe to import anywhere.

export const SEED_COLORS = ['#6d63f5', '#0ea5a3', '#e0892b'] as const; // indigo / teal / amber

/**
 * Map a set of box-type keys to deterministic hex colours.
 * Dedupes + sorts the keys so the assignment is stable regardless of input order.
 * The first three sorted types take the seed colours; further types get a
 * hue-spun harmonious extension.
 */
export function colorForType(typeKeys: string[]): Map<string, string> {
  const sorted = [...new Set(typeKeys)].sort();
  const out = new Map<string, string>();
  sorted.forEach((k, i) => {
    out.set(
      k,
      i < SEED_COLORS.length ? SEED_COLORS[i] : spinHue(SEED_COLORS[i % SEED_COLORS.length], i),
    );
  });
  return out;
}

// Parse a #rrggbb hex -> HSL, add (i*47)deg to the hue (keeping S/L from the seed),
// and return a #rrggbb hex. The 47deg step is coprime-ish with 360 so successive
// extra types land on visibly distinct hues.
function spinHue(hex: string, i: number): string {
  const { h, s, l } = hexToHsl(hex);
  const h2 = (((h + i * 47) % 360) + 360) % 360;
  return hslToHex(h2, s, l);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const toHex = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
