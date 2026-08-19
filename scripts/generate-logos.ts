import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const accent = "#1D55C5";
const accentSoft = "#E8EFFC";
const accentDark = "#16449E";
const white = "#FFFFFF";

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`;

const logos: Record<string, string> = {
  // ── Vente Cash ──────────────────────────────────────────
  // A: Caisse enregistreuse stylisee (carre arrondi + ecran + tiroir)
  "vente-cash": svg(`
    <rect x="6" y="10" width="36" height="28" rx="8" fill="${accent}"/>
    <rect x="10" y="14" width="28" height="10" rx="4" fill="${accentSoft}"/>
    <rect x="10" y="28" width="28" height="4" rx="2" fill="${accentSoft}" opacity="0.6"/>
    <circle cx="38" cy="36" r="6" fill="${accentDark}"/>
    <circle cx="38" cy="36" r="3" fill="${accentSoft}"/>
  `),
  // B: Caisse avec piece et recu
  "vente-cash-detail": svg(`
    <rect x="8" y="12" width="32" height="24" rx="7" fill="${accent}"/>
    <rect x="12" y="16" width="24" height="8" rx="3" fill="${accentSoft}"/>
    <rect x="12" y="28" width="24" height="3" rx="1.5" fill="${accentSoft}" opacity="0.5"/>
    <circle cx="14" cy="6" r="5" fill="${accentDark}"/>
    <circle cx="14" cy="6" r="2.5" fill="${accentSoft}"/>
    <path d="M34 6 h6 l-2 3 2 3 h-6 z" fill="${accent}" opacity="0.7"/>
  `),

  // ── Stock Logistique ────────────────────────────────────
  // A: Carton avec coche
  "stock-logistique": svg(`
    <rect x="10" y="16" width="28" height="22" rx="5" fill="${accent}"/>
    <rect x="8" y="12" width="32" height="7" rx="3.5" fill="${accentDark}"/>
    <path d="M18 28 l4 4 l8 -8" fill="none" stroke="${accentSoft}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  // B: Cartons empiles + fleche
  "stock-logistique-detail": svg(`
    <rect x="28" y="4" width="14" height="9" rx="3" fill="${accentSoft}"/>
    <rect x="10" y="16" width="28" height="22" rx="5" fill="${accent}"/>
    <rect x="8" y="12" width="32" height="7" rx="3.5" fill="${accentDark}"/>
    <path d="M24 32 v-8" fill="none" stroke="${accentSoft}" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 27 l4 -4 4 4" fill="none" stroke="${accentSoft}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  `),

  // ── QG / Hub ────────────────────────────────────────────
  // A: Batiment QG avec drapeau
  "qg-hub": svg(`
    <rect x="11" y="18" width="26" height="22" rx="6" fill="${accent}"/>
    <rect x="15" y="23" width="5" height="5" rx="2" fill="${accentSoft}"/>
    <rect x="28" y="23" width="5" height="5" rx="2" fill="${accentSoft}"/>
    <rect x="21" y="31" width="6" height="9" rx="3" fill="${accentSoft}"/>
    <path d="M24 18 v-10" fill="none" stroke="${accentDark}" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 8 h7 l-2.5 3.5 2.5 3.5 h-7 z" fill="${accent}"/>
  `),
  // B: Reseau hub (noeud central + 4 satellites)
  "qg-hub-detail": svg(`
    <path d="M24 24 L12 12 M24 24 L36 12 M24 24 L12 36 M24 24 L36 36" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="10" fill="${accent}"/>
    <circle cx="24" cy="24" r="4" fill="${accentSoft}"/>
    <circle cx="12" cy="12" r="4" fill="${accentSoft}" stroke="${accent}" stroke-width="1.5"/>
    <circle cx="36" cy="12" r="4" fill="${accentSoft}" stroke="${accent}" stroke-width="1.5"/>
    <circle cx="12" cy="36" r="4" fill="${accentSoft}" stroke="${accent}" stroke-width="1.5"/>
    <circle cx="36" cy="36" r="4" fill="${accentSoft}" stroke="${accent}" stroke-width="1.5"/>
  `),

  // ── 10 Nouveaux logos ───────────────────────────────────

  // 7: VenteCash minimal — piece unique
  "vente-cash-minimal": svg(`
    <circle cx="24" cy="24" r="14" fill="${accent}"/>
    <circle cx="24" cy="24" r="9" fill="${accentSoft}"/>
    <circle cx="24" cy="24" r="4" fill="${accent}"/>
    <path d="M24 15 v-2 M24 35 v-2 M15 24 h-2 M35 24 h-2" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
  `),

  // 8: VenteCash style recu
  "vente-cash-receipt": svg(`
    <rect x="10" y="6" width="28" height="36" rx="4" fill="${accentSoft}"/>
    <rect x="14" y="12" width="20" height="3" rx="1.5" fill="${accent}"/>
    <rect x="14" y="19" width="16" height="2" rx="1" fill="${accent}" opacity="0.5"/>
    <rect x="14" y="24" width="20" height="2" rx="1" fill="${accent}" opacity="0.5"/>
    <rect x="14" y="29" width="12" height="2" rx="1" fill="${accent}" opacity="0.5"/>
    <path d="M14 35 l3 3 3 -3 3 3 3 -3 3 3 3 -3" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>
  `),

  // 9: VenteCash billet
  "vente-cash-bill": svg(`
    <rect x="4" y="14" width="40" height="20" rx="4" fill="${accent}"/>
    <rect x="8" y="18" width="32" height="12" rx="2" fill="${accentSoft}"/>
    <circle cx="24" cy="24" r="5" fill="${accent}" opacity="0.4"/>
    <text x="24" y="28" text-anchor="middle" font-size="10" font-weight="bold" fill="${accent}">$</text>
  `),

  // 10: StockLogistique palette
  "stock-logistique-palette": svg(`
    <rect x="6" y="20" width="36" height="20" rx="4" fill="${accent}"/>
    <rect x="10" y="10" width="28" height="14" rx="3" fill="${accentDark}"/>
    <rect x="14" y="4" width="20" height="10" rx="3" fill="${accentSoft}"/>
    <rect x="18" y="26" width="12" height="3" rx="1.5" fill="${accentSoft}" opacity="0.6"/>
  `),

  // 11: StockLogistique camion
  "stock-logistique-truck": svg(`
    <rect x="4" y="16" width="24" height="18" rx="4" fill="${accent}"/>
    <path d="M28 22 h10 l6 6 v6 h-16 z" fill="${accentDark}" rx="3"/>
    <rect x="30" y="24" width="6" height="5" rx="1" fill="${accentSoft}"/>
    <circle cx="12" cy="36" r="3.5" fill="${accentDark}"/>
    <circle cx="12" cy="36" r="1.5" fill="${accentSoft}"/>
    <circle cx="38" cy="36" r="3.5" fill="${accentDark}"/>
    <circle cx="38" cy="36" r="1.5" fill="${accentSoft}"/>
  `),

  // 12: StockLogistique barcode
  "stock-logistique-barcode": svg(`
    <rect x="8" y="8" width="32" height="32" rx="6" fill="${accent}"/>
    <rect x="13" y="14" width="3" height="16" rx="1" fill="${accentSoft}"/>
    <rect x="18" y="14" width="2" height="16" rx="1" fill="${accentSoft}"/>
    <rect x="22" y="14" width="4" height="16" rx="1" fill="${accentSoft}"/>
    <rect x="28" y="14" width="2" height="16" rx="1" fill="${accentSoft}"/>
    <rect x="32" y="14" width="3" height="16" rx="1" fill="${accentSoft}"/>
    <rect x="14" y="34" width="20" height="2" rx="1" fill="${accentSoft}" opacity="0.5"/>
  `),

  // 13: QGHub localisation
  "qg-hub-pin": svg(`
    <path d="M24 4 C16 4 10 10.5 10 18.5 C10 29 24 44 24 44 C24 44 38 29 38 18.5 C38 10.5 32 4 24 4 z" fill="${accent}"/>
    <circle cx="24" cy="18" r="7" fill="${accentSoft}"/>
    <circle cx="24" cy="18" r="3" fill="${accent}"/>
  `),

  // 14: QGHub bouclier
  "qg-hub-shield": svg(`
    <path d="M24 4 L8 12 v12 c0 10 16 18 16 18 c10 -8 16 -18 16 -18 V12 Z" fill="${accent}"/>
    <path d="M24 10 L14 16 v8 c0 6 10 12 10 12 c6 -6 10 -12 10 -12 v-8 Z" fill="${accentSoft}"/>
    <path d="M20 22 l3 3 6 -6" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  `),

  // 15: QGHub etoile
  "qg-hub-star": svg(`
    <path d="M24 4 l5.5 11.2 12.3 1.8 -8.9 8.7 2.1 12.3 L24 31.4 13 28 l2.1 -12.3 -8.9 -8.7 12.3 -1.8 z" fill="${accent}"/>
    <circle cx="24" cy="21" r="6" fill="${accentSoft}"/>
    <path d="M21 21 l2 2 4 -4" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `),

  // 16: VenteCash bronze (style piece avec symbole)
  "vente-cash-bronze": svg(`
    <circle cx="24" cy="24" r="16" fill="${accent}"/>
    <circle cx="24" cy="24" r="12" fill="${accentDark}"/>
    <circle cx="24" cy="24" r="12" fill="none" stroke="${accentSoft}" stroke-width="1"/>
    <text x="24" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="${accentSoft}">C</text>
  `),

  // 17: MerchantHQ combined (caisse + carton + batiment)
  "merchanthq-combined": svg(`
    <rect x="4" y="22" width="18" height="14" rx="4" fill="${accent}"/>
    <rect x="7" y="25" width="12" height="5" rx="2" fill="${accentSoft}"/>
    <rect x="26" y="18" width="18" height="18" rx="4" fill="${accentDark}"/>
    <rect x="30" y="22" width="4" height="4" rx="1" fill="${accentSoft}"/>
    <rect x="36" y="22" width="4" height="4" rx="1" fill="${accentSoft}"/>
    <rect x="32" y="30" width="4" height="6" rx="2" fill="${accentSoft}"/>
    <path d="M13 22 v-8" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M13 14 h6 l-2 3 2 3 h-6 z" fill="${accent}"/>
  `),

  // 18: MerchantHQ rond (emblem)
  "merchanthq-emblem": svg(`
    <circle cx="24" cy="24" r="20" fill="${accent}"/>
    <circle cx="24" cy="24" r="16" fill="${accentDark}"/>
    <rect x="12" y="16" width="12" height="10" rx="3" fill="${accentSoft}"/>
    <rect x="15" y="19" width="6" height="3" rx="1" fill="${accent}" opacity="0.5"/>
    <rect x="26" y="18" width="10" height="14" rx="3" fill="${accentSoft}"/>
    <rect x="29" y="21" width="3" height="3" rx="1" fill="${accent}" opacity="0.5"/>
    <rect x="33" y="21" width="3" height="3" rx="1" fill="${accent}" opacity="0.5"/>
    <rect x="30" y="27" width="4" height="5" rx="2" fill="${accent}" opacity="0.5"/>
    <path d="M18 16 v-5" fill="none" stroke="${accentSoft}" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 11 h4 l-1.5 2 1.5 2 h-4 z" fill="${accentSoft}"/>
  `),
};

await mkdir("assets/logos", { recursive: true });

const sharp = (await import("sharp")).default;

for (const [name, source] of Object.entries(logos)) {
  const out = join("assets/logos", `${name}.png`);
  await sharp(Buffer.from(source), { density: 768 })
    .resize(512, 512)
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}

// Also write SVG source files for reference
await mkdir("src/components/logos", { recursive: true });
console.log(`\n✓ ${Object.keys(logos).length} logos generated`);
