import { mkdir } from "node:fs/promises";

import sharp from "sharp";

const color = "#1D55C5";
const detail = "#E8EFFC";

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`;

const logos: Record<string, string> = {
  "vente-cash": svg(`
    <rect x="9" y="9" width="30" height="30" rx="9" fill="${color}"/>
    <circle cx="24" cy="24" r="10" fill="${detail}"/>
    <circle cx="24" cy="24" r="4.5" fill="${color}"/>
  `),
  "vente-cash-detail": svg(`
    <circle cx="12" cy="7" r="5" fill="${color}"/>
    <circle cx="12" cy="7" r="2.5" fill="${detail}"/>
    <circle cx="38" cy="43" r="5" fill="${color}"/>
    <circle cx="38" cy="43" r="2.5" fill="${detail}"/>
    <rect x="8" y="12" width="32" height="27" rx="8" fill="${color}"/>
    <rect x="12" y="17" width="24" height="5" rx="2.5" fill="${detail}"/>
    <rect x="12" y="30" width="24" height="3.5" rx="1.75" fill="${detail}"/>
  `),
  "stock-logistique": svg(`
    <rect x="28" y="4" width="12" height="9" rx="3" fill="${detail}"/>
    <rect x="10" y="14" width="28" height="24" rx="6" fill="${color}"/>
    <path d="M17 27 l5 5 l9 -9" fill="none" stroke="${detail}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  "stock-logistique-detail": svg(`
    <rect x="30" y="4" width="14" height="10" rx="3.5" fill="${detail}"/>
    <rect x="10" y="16" width="28" height="24" rx="6" fill="${color}"/>
    <path d="M24 32 v-8" fill="none" stroke="${detail}" stroke-width="4" stroke-linecap="round"/>
    <path d="M19 26 l5 -5 5 5" fill="none" stroke="${detail}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  "qg-hub": svg(`
    <path d="M24 6 v10" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M24 6 h8 l-3 4 3 4 h-8 z" fill="${color}"/>
    <rect x="11" y="16" width="26" height="24" rx="7" fill="${color}"/>
    <rect x="15" y="22" width="5" height="5" rx="2.5" fill="${detail}"/>
    <rect x="28" y="22" width="5" height="5" rx="2.5" fill="${detail}"/>
    <rect x="21" y="31" width="6" height="9" rx="3" fill="${detail}"/>
  `),
  "qg-hub-detail": svg(`
    <path d="M24 24 L11 11 M24 24 L37 11 M24 24 L11 37 M24 24 L37 37" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="11" fill="${color}"/>
    <circle cx="24" cy="24" r="4.5" fill="${detail}"/>
    <circle cx="11" cy="11" r="4" fill="${detail}"/>
    <circle cx="37" cy="11" r="4" fill="${detail}"/>
    <circle cx="11" cy="37" r="4" fill="${detail}"/>
    <circle cx="37" cy="37" r="4" fill="${detail}"/>
  `),
};

await mkdir("assets/logos", { recursive: true });

for (const [name, source] of Object.entries(logos)) {
  const out = `assets/logos/${name}.png`;
  await sharp(Buffer.from(source), { density: 768 })
    .resize(512, 512)
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}