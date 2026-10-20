// Renders the shared placeholder product images (public/images/products/*.webp)
// from simple inline SVG drawings. Uses sharp, which ships with Next.js.
// Usage: node scripts/generate-images.mjs

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SIZE = 400;
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images", "products");
mkdirSync(outDir, { recursive: true });

const frame = (accent, body, label) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f1f1f8"/>
  <rect x="16" y="16" width="368" height="368" rx="24" fill="none" stroke="${accent}" stroke-width="6"/>
  ${body}
  <text x="200" y="360" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#22225a" text-anchor="middle">${label}</text>
</svg>`;

const pins = (count, from, step, horizontal, fixed, length) =>
  Array.from({ length: count }, (_, i) =>
    horizontal
      ? `<rect x="${from + i * step}" y="${fixed}" width="8" height="${length}" fill="#9a9ab8"/>`
      : `<rect x="${fixed}" y="${from + i * step}" width="${length}" height="8" fill="#9a9ab8"/>`,
  ).join("");

const IMAGES = {
  cpu: frame(
    "#2e3192",
    `${pins(8, 104, 26, true, 60, 30)}${pins(8, 104, 26, true, 270, 30)}
     ${pins(8, 84, 26, false, 70, 30)}${pins(8, 84, 26, false, 300, 30)}
     <rect x="100" y="90" width="200" height="180" rx="12" fill="#2e3192"/>
     <rect x="140" y="125" width="120" height="110" rx="8" fill="#8989e0"/>`,
    "CPU",
  ),
  gpu: frame(
    "#1b7f5c",
    `<rect x="50" y="110" width="300" height="140" rx="14" fill="#1b7f5c"/>
     <circle cx="135" cy="180" r="50" fill="#d8efe6"/><circle cx="135" cy="180" r="12" fill="#1b7f5c"/>
     <circle cx="265" cy="180" r="50" fill="#d8efe6"/><circle cx="265" cy="180" r="12" fill="#1b7f5c"/>
     <rect x="80" y="250" width="200" height="20" fill="#c9a227"/>`,
    "GPU",
  ),
  ram: frame(
    "#a33a3a",
    `<rect x="40" y="130" width="320" height="100" rx="8" fill="#a33a3a"/>
     ${Array.from({ length: 6 }, (_, i) => `<rect x="${62 + i * 50}" y="148" width="36" height="52" fill="#f3d6d6"/>`).join("")}
     ${pins(24, 48, 13, true, 230, 22).replaceAll("#9a9ab8", "#c9a227")}`,
    "RAM",
  ),
  disk: frame(
    "#5a4a8a",
    `<rect x="80" y="70" width="240" height="220" rx="18" fill="#5a4a8a"/>
     <circle cx="200" cy="170" r="72" fill="#e3def3"/><circle cx="200" cy="170" r="14" fill="#5a4a8a"/>
     <rect x="200" y="225" width="80" height="12" rx="6" fill="#c9a227" transform="rotate(-35 200 231)"/>`,
    "DYSK",
  ),
};

for (const [name, svg] of Object.entries(IMAGES)) {
  const file = join(outDir, `${name}.webp`);
  await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(file);
  console.log(`Wrote ${file}`);
}
