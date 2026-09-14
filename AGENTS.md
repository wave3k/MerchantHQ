# Agent rules — MerchantHQ (app)

Périmètre : **tout le travail vit dans ce dossier (MerchantHQ)** — app mobile, worker
Cloudflare intégré. Le projet **Renaissance Manager** (ancien dossier
`../Commerce Manager`) est **abandonné** : ne plus y travailler.

Tous les skills installés sont consolidés ici dans `.agents/skills` (97 skills :
généraux, Expo/EAS, Cloudflare). Ce dossier est la racine de travail.

Voir les instructions générales dans `../Developement/AGENTS.md` (ou `~/Documents/My Docs/Developement/AGENTS.md`).

## Règle skills (OBLIGATOIRE)
- **Avant CHAQUE tâche** : passer en revue les skills disponibles dans `.agents/skills`
  et vérifier si au moins un peut aider. Si oui → **le charger et l'appliquer AVANT de
  coder** (outil `skill`, ou lecture du `SKILL.md` du dossier concerné).
- Ne jamais commencer une tâche non triviale sans avoir fait cette vérification.
- Correspondances fréquentes :
  - **UI / UX / design / CSS / composants** → `better-ui`, `better-interface`, `better-layout`,
    `better-typography`, `better-colors`, `better-accessibility`, `interface-review`,
    `apple-design`, `emil-design-eng`
  - **Animation / motion** → `animate`, `animate-expo`, `review-animations`, `improve-animations`
  - **Accessibilité (a11y)** → `accessibility-scan`, `accessibility-inspect`, `accessibility-fix`
  - **Expo / React Native** → `expo-router`, `expo-ui`, `expo-native-ui`, `expo-design-system`,
    `expo-animation`, `expo-data-fetching`, `react-native-best-practices`
  - **Build / déploiement mobile** → `eas-update`, `eas-app-stores`, `expo-dev-client`
  - **Worker Cloudflare / API** → `workers-best-practices`, `wrangler`, `cloudflare`, `durable-objects`
  - **Tests / qualité / refactor** → `test-driven-development`, `code-review-and-quality`,
    `code-simplification`, `debugging-and-error-recovery`, `incremental-implementation`
  - **Sécurité / performance** → `security-and-hardening`, `performance-optimization`
  - **Rédaction / textes** → `humanize`, `better-writing`
- Vérifier le rendu avec Playwright après toute modif UI.

## Responsive (OBLIGATOIRE)
- Après TOUTE modif UI, vérifier avec Playwright à 3 largeurs : `375px`, `768px`, `1280px`.
- Vérifier qu'aucun bouton n'est caché/hors écran, qu'aucune modale ne déborde, et que le
  contenu reste lisible. Corriger ce qui dépasse.

## Hors-ligne (OBLIGATOIRE)
- Les fonctions métier et les notifications doivent marcher hors-ligne.
- Toute opération réseau (backup, sync compte, abonnement) doit avoir une file d'attente
  locale et être retentée au retour au premier plan.