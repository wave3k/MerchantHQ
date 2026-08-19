# Commerce Manager — système visuel local

## Intention

Un outil de boutique quotidien, chaleureux mais précis. Le bleu cobalt sert de
signature et d’indication d’action ; il ne doit pas remplir l’écran ni diminuer
la lisibilité des chiffres, des produits ou du panier.

## Direction

- Genre : moderne minimal
- Ton : chaleureux, professionnel, précis
- Macrostructure : Workbench tablette avec navigation latérale existante
- Accueil : Ecosystem Index en deux vues, Caisse opérationnelle et Dashboard analytique
- Créateur de tickets : Component Playground en trois zones (blocs, aperçu, propriétés)
- Accent : cobalt
- Neutres : papier bleuté et encres ardoise
- Typographies : Space Grotesk, IBM Plex Sans et JetBrains Mono
- Mouvement : uniquement les retours tactiles déjà nécessaires

## Palette verrouillée

- Papier : `oklch(98.5% 0.004 250)` / `#F7F9FC`
- Papier secondaire : `oklch(96.2% 0.008 250)` / `#EEF2F7`
- Surface : `oklch(99.2% 0.003 250)` / `#FBFCFE`
- Encre : `oklch(24% 0.02 258)` / `#1F2938`
- Encre secondaire : `oklch(28.5% 0.03 258)` / `#334155`
- Texte atténué : `oklch(49% 0.025 255)` / `#647389`
- Règle : `oklch(88% 0.012 252)` / `#D9E0EA`
- Accent : `oklch(48% 0.19 256)` / `#1D55C5`
- Accent pressé : `oklch(39% 0.16 256)` / `#16449E`
- Accent doux : `oklch(94% 0.03 256)` / `#E8EFFC`
- Texte sur accent : `oklch(98.5% 0.004 250)` / `#F8FAFF`

## Règles

- Aucun dégradé.
- Aucun changement de géométrie ou de densité des pages.
- Les produits, données et actions gardent les mêmes tailles tactiles.
- L’accent bleu couvre moins de 5 % de chaque vue.
- Les couleurs succès, avertissement et erreur conservent leur signification.
- La base `commerce-manager-public.db`, les clés SecureStore et le format des sauvegardes
  restent inchangés pour préserver toutes les données existantes.

## Variantes accessibles

- Nuit : fond ardoise très sombre, texte bleuté clair et accent cobalt lumineux.
- Contraste : fond blanc, texte noir, bordures renforcées et accent cobalt sombre.
- Les tickets restent noirs sur blanc, indépendamment du thème, pour une impression nette.

## Exports

La source portable reste `tokens.css`; l’application React Native consomme son
équivalent dans `src/theme.ts`.

### CSS

```css
:root {
  --color-paper: oklch(98.5% 0.004 250);
  --color-paper-2: oklch(96.2% 0.008 250);
  --color-surface: oklch(99.2% 0.003 250);
  --color-rule: oklch(88% 0.012 252);
  --color-muted: oklch(49% 0.025 255);
  --color-ink: oklch(24% 0.02 258);
  --color-accent: oklch(48% 0.19 256);
  --color-accent-ink: oklch(98.5% 0.004 250);
  --font-display: "Space Grotesk";
  --font-body: "IBM Plex Sans";
  --font-outlier: "JetBrains Mono";
  --space-2xs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
  --radius-card: 10px;
  --radius-input: 6px;
  --radius-pill: 999px;
}
```

### Tailwind v4

```css
@theme {
  --color-paper: oklch(98.5% 0.004 250);
  --color-paper-2: oklch(96.2% 0.008 250);
  --color-surface: oklch(99.2% 0.003 250);
  --color-rule: oklch(88% 0.012 252);
  --color-muted: oklch(49% 0.025 255);
  --color-ink: oklch(24% 0.02 258);
  --color-accent: oklch(48% 0.19 256);
  --color-accent-ink: oklch(98.5% 0.004 250);
  --font-display: "Space Grotesk";
  --font-body: "IBM Plex Sans";
  --font-outlier: "JetBrains Mono";
  --spacing-2xs: 4px;
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 40px;
  --radius-card: 10px;
  --radius-input: 6px;
  --radius-pill: 999px;
}
```

### DTCG

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(98.5% 0.004 250)", "$type": "color" },
    "paper-2": { "$value": "oklch(96.2% 0.008 250)", "$type": "color" },
    "surface": { "$value": "oklch(99.2% 0.003 250)", "$type": "color" },
    "rule": { "$value": "oklch(88% 0.012 252)", "$type": "color" },
    "muted": { "$value": "oklch(49% 0.025 255)", "$type": "color" },
    "ink": { "$value": "oklch(24% 0.02 258)", "$type": "color" },
    "accent": { "$value": "oklch(48% 0.19 256)", "$type": "color" },
    "accent-ink": { "$value": "oklch(98.5% 0.004 250)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk", "$type": "fontFamily" },
    "body": { "$value": "IBM Plex Sans", "$type": "fontFamily" },
    "outlier": { "$value": "JetBrains Mono", "$type": "fontFamily" }
  },
  "space": {
    "2xs": { "$value": "4px", "$type": "dimension" },
    "xs": { "$value": "8px", "$type": "dimension" },
    "sm": { "$value": "12px", "$type": "dimension" },
    "md": { "$value": "16px", "$type": "dimension" },
    "lg": { "$value": "24px", "$type": "dimension" },
    "xl": { "$value": "40px", "$type": "dimension" }
  }
}
```

### shadcn/ui

```css
:root {
  --background: 98.5% 0.004 250;
  --foreground: 24% 0.02 258;
  --card: 99.2% 0.003 250;
  --card-foreground: 24% 0.02 258;
  --popover: 99.2% 0.003 250;
  --popover-foreground: 24% 0.02 258;
  --primary: 48% 0.19 256;
  --primary-foreground: 98.5% 0.004 250;
  --secondary: 96.2% 0.008 250;
  --secondary-foreground: 28.5% 0.03 258;
  --muted: 88% 0.012 252;
  --muted-foreground: 49% 0.025 255;
  --accent: 48% 0.19 256;
  --accent-foreground: 98.5% 0.004 250;
  --border: 88% 0.012 252;
  --input: 88% 0.012 252;
  --ring: 48% 0.19 256;
  --radius: 10px;
}
```