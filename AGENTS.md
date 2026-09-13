# Agent rules — Commerce-Manager (app)

Voir les instructions générales dans `../Developement/AGENTS.md` (ou `~/Documents/My Docs/Developement/AGENTS.md`).

## Règle skills (OBLIGATOIRE)
- **Avant chaque tâche** : vérifier si un skill disponible peut aider → l'utiliser.
- **Site web / interface / UI-UX / design** : charger et appliquer les skills UI/UX
  (better-ui, better-accessibility, better-colors, better-interface, better-layout,
  better-typography, better-writing, interface-review, variant — installés dans
  `.agents/skills`).
- Vérifier le rendu avec Playwright après toute modif UI.

## Responsive (OBLIGATOIRE)
- Après TOUTE modif UI, vérifier avec Playwright à 3 largeurs : `375px`, `768px`, `1280px`.
- Vérifier qu'aucun bouton n'est caché/hors écran, qu'aucune modale ne déborde, et que le
  contenu reste lisible. Corriger ce qui dépasse.

## Hors-ligne (OBLIGATOIRE)
- Les fonctions métier et les notifications doivent marcher hors-ligne.
- Toute opération réseau (backup, sync compte, abonnement) doit avoir une file d'attente
  locale et être retentée au retour au premier plan.