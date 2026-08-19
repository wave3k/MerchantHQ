# Commerce Manager

MVP React Native hors ligne pour gérer une boutique sur une tablette Android.
Les comptes, produits, clients, commandes, stocks et logs sont stockés dans une
base SQLite locale sur l’appareil.

## Fonctionnalités

- Compte propriétaire unique, synchronisé avec Turso et utilisable hors ligne
- Verrouillage et écran de veille après 5 minutes d’inactivité
- Caisse avec panier, client facultatif, espèces, Mobile Money ou carte
- Section **Tickets** avec créateur visuel, glisser-déposer tactile et aperçu 58/80 mm
- Blocs personnalisables : logo, coordonnées, informations légales, vente, articles, taxe et textes libres
- Impression de test ou automatique via Android Print Manager
- Diminution atomique du stock pendant l’encaissement
- Catalogue, prix, seuils d’alerte et ajustements de stock
- Fiches clients avec nombre de commandes et total acheté
- Rendez-vous clients avec création de client intégrée et produit facultatif
- Rappel local une heure avant chaque rendez-vous
- Notifications locales pour le stock à surveiller et le résumé de 19 h
- Fiches employés sans compte de connexion
- Attribution de chaque vente à l’employé qui l’a traitée
- Nombre de ventes et chiffre attribué par employé
- Accueil à deux onglets : **Caisse** pour les actions rapides, rendez-vous et stocks
  à surveiller ; **Dashboard** pour l’analyse
- Dashboard filtrable par jour, semaine ou mois : revenus, panier moyen, produits,
  employés, évolution et derniers encaissements
- Journal détaillé avec valeurs avant/après
- Export et restauration d’une sauvegarde JSON
- Sauvegarde quotidienne chiffrée en transit vers Turso, avec reprise hors ligne
- Détection au lancement d’une copie Turso plus récente créée sur une autre tablette,
  avec restauration guidée et protection contre l’écrasement
- Devise principale et secondaire avec taux de conversion
- Informations de l’établissement, taxe, horaires et paiements acceptés
- Interface française ou anglaise et thèmes Cobalt, Nuit ou Contraste
- Accès développeur protégé depuis la connexion et limité à 5 minutes
- Données de démonstration facultatives

## Édition personnelle

Cette branche n’affiche qu’un seul compte de connexion : le propriétaire Boss.
Les anciens comptes d’équipe sont désactivés sans supprimer leur historique.
Le personnel reste géré dans **Employés** et chaque vente doit être attribuée à
la personne qui l’a traitée.

## Lancer avec Bun

Prérequis : [Bun](https://bun.sh/) et Expo Go compatible SDK 54 sur la tablette.
Node n’est pas nécessaire pour lancer ce projet déjà initialisé.

```bash
bun install
bun run tablet
```

La commande détecte automatiquement l’adresse Wi-Fi de l’ordinateur et évite
les vérifications Internet d’Expo. Scannez ensuite le nouveau QR code avec
Expo Go. L’ordinateur et la tablette doivent être sur le même réseau pendant
le chargement du bundle de développement.
L’application et ses données métier fonctionnent ensuite sans serveur.

### Lancer dans le navigateur

```bash
bun run web
```

Ouvrez ensuite `http://localhost:8081/index.html` si le navigateur ne s’ouvre
pas automatiquement.

La version Web utilise une base SQLite propre au navigateur : elle ne lit pas
directement les données de la tablette. Les notifications Android, les tâches
d’arrière-plan, Android Print Manager et la sauvegarde Turso sont désactivés
dans le navigateur. Le jeton Turso privé n’est jamais intégré au bundle Web.

À la première ouverture :

1. Créez le compte Boss avec un mot de passe d’au moins 4 caractères.
2. Ajoutez les produits.
3. Ajoutez le personnel depuis **Employés**. Ces fiches n’ouvrent pas l’application.
4. Autorisez les notifications Android au premier lancement. Elles sont générées
   localement et ne nécessitent ni Internet ni compte cloud.
5. Les outils avancés sont cachés. Dans **Réglages**, appuyez quatre fois sur
   la version de l’application pour afficher le **Mode développeur**.

## Vérifications

```bash
bun run typecheck
bun test
bun expo install --check
bun run export:android
```

## Stockage et sécurité

- La base principale se nomme `commerce-manager-public.db`.
- SQLite utilise le mode WAL et les clés étrangères.
- Une vente, ses lignes, les mouvements de stock et son log sont enregistrés
  dans une seule transaction.
- Les codes sont salés et dérivés localement avec PBKDF2-SHA-256. La nouvelle
  dérivation est asynchrone et adaptée aux tablettes ; les anciens hashes sont
  convertis automatiquement après leur première connexion réussie.
- Le dernier compte choisi est mémorisé dans SecureStore, mais jamais son mot
  de passe ni une session ouverte.
- Une sauvegarde JSON doit être conservée dans un emplacement sûr : elle
  contient toutes les données, y compris les comptes et les hashes.
- Le jeton Turso est conservé dans SecureStore avec le stockage sécurisé Android.
  Il n’est ni écrit dans SQLite, ni ajouté aux exports JSON, ni versionné par Git.
- La configuration locale `.env.local`, ignorée par Git, peut préparer
  automatiquement une tablette. Une variable `EXPO_PUBLIC_` est toutefois
  intégrée au bundle Expo : utilisez une clé dédiée et remplacez-la après le
  premier provisionnement pour un déploiement durable.
- La sauvegarde Turso contient une copie complète des données et des hashes de
  comptes. L’accès au projet Turso doit donc rester réservé au propriétaire.
- La table `commerce_latest_backup` mémorise la dernière copie et la version
  de l’application qui l’a créée. Une autre tablette la propose au démarrage
  seulement si elle est plus récente et compatible ; rien n’est remplacé sans
  confirmation.
- Le compte propriétaire unique est aussi conservé dans la table Turso
  `commerce_owner_account`. En l’absence d’Internet, sa copie locale permet
  de continuer à travailler.
- Les rendez-vous sont inclus dans la sauvegarde. Après une restauration, leurs
  rappels sont recréés sur la tablette active.

## Notifications locales

- Un rendez-vous futur déclenche un rappel une heure avant son heure prévue.
- Une alerte apparaît quand la liste ou la quantité des produits sous leur seuil
  de surveillance change.
- Le résumé de la journée est programmé pour 19 h et actualisé après les ventes.
- Les notifications restent locales et ne dépendent pas de Turso.

## Sauvegarde Turso

- SQLite reste la base principale : les ventes ne dépendent jamais d’Internet.
- À partir de 21 h, un instantané complet de la journée devient dû.
- Si Internet ou Turso est indisponible, la date reste en attente dans SQLite et
  l’envoi est retenté à la prochaine ouverture, au retour dans l’application ou
  lors d’une exécution Android en arrière-plan.
- Chaque envoi réseau dispose de trois tentatives courtes ; une erreur n’empêche
  jamais la caisse de fonctionner.
- Android choisit lui-même le moment exact d’une tâche de fond : 21 h est le
  seuil métier, pas une garantie d’exécution à la minute.
- Expo Go sur Android ne lance pas la tâche TaskManager en arrière-plan. Les
  reprises au premier plan fonctionnent dans Expo Go ; un build de développement
  ou de production est requis pour les tentatives réellement en arrière-plan.

## Impression

La section **Tickets** permet d’ajouter des informations, de déplacer les blocs
avec leur poignée, de les masquer, dupliquer, renommer et mettre en forme. Les
formats 58 mm et 80 mm, les marges, la densité, le détail des articles et
l’impression automatique sont configurables. Les coordonnées proposées dans le
créateur viennent de la fiche **Établissement** dans les Réglages.

Le bouton **Tester** ouvre Android Print Manager avec le modèle affiché, même
avant de l’enregistrer. Le choix matériel est volontairement laissé à Android ;
l’application génère le ticket et Android gère l’imprimante USB, réseau ou le
service d’impression installé.
