# 0005 · Rechercher et afficher le stock par article

## Context

L’application utilise Firebase Authentication et Cloud Firestore. La collection `stockPositions` contient une position par document, et un article peut donc apparaître dans plusieurs magasins ou emplacements. La recherche existante trouve d’abord les positions par code article exact, puis par code barre exact. Les désignations peuvent se trouver dans `designation`, `name`, `articleName` ou `description`. (basis: `docs/scope/scope.md`, objectif de recherche et de consultation)

Firestore ne fournit pas directement une recherche contenant un fragment de texte sans index ou service supplémentaire. La recherche par désignation lit donc les positions accessibles par pages et filtre les désignations dans le navigateur. Le tableau regroupe ensuite les positions par code article. Une désignation peut toujours entraîner la lecture d’une grande partie de la collection.

L’affichage actuel produit une carte par position. La recherche par code barre journalise et ignore les erreurs de requête. Avec des totaux regroupés, ignorer une erreur pourrait présenter un stock incomplet comme correct.

> ⚠️ Premise note: Une recherche par fragment peut coûter davantage qu’une recherche exacte. Le parcours complet paginé évite de cacher des positions et respecte les accès Firestore, mais son coût dépend du volume autorisé. Si ce coût devient gênant, une indexation dédiée devra être conçue séparément.

## Options considered

### Option 1: Faire évoluer la recherche actuelle

L’application conserve les recherches exactes et le parcours paginé. Elle regroupe les positions correspondantes dans le navigateur et remplace les cartes par un tableau. (basis: `AGENTS.md`, `index.html`)

**Pros**:
- Réutilise Firebase, les règles de lecture et les fonctions déjà en place.
- Ne demande ni migration ni préparation des documents existants.
- La modification peut être annulée par le retour à la version précédente.

**Cons**:
- Le navigateur doit garder les résultats et calculer les totaux.
- Les données d’un groupe peuvent être volumineuses lorsqu’un article existe à beaucoup d’emplacements.

### Option 2: Créer une nouvelle vue à côté de la recherche actuelle

Une nouvelle vue regroupée serait construite à côté des cartes existantes, puis activée après vérification. (basis: déploiement réversible d’une interface existante)

**Pros**:
- Permet de comparer l’affichage actuel et le nouvel affichage avant le basculement.
- Peut être utile si la nouvelle présentation doit être déployée progressivement.

**Cons**:
- Duplique temporairement le rendu et augmente la complexité d’une petite application statique.
- Une activation progressive demanderait une configuration supplémentaire.

### Option 3: Remplacer entièrement la recherche

La recherche et son parcours de données seraient réécrits au lieu de réutiliser les fonctions actuelles. (basis: `AGENTS.md`, règles de préservation des fonctions existantes)

**Pros**:
- Peut uniformiser la recherche, le regroupement et l’affichage dans une nouvelle implémentation.

**Cons**:
- Augmente le risque de régression sur les recherches exactes et le scan.
- N’apporte aucun bénéfice mesuré par rapport à une évolution ciblée.

## Rationale

L’application lit déjà les positions et sait parcourir la collection par pages. Aucun nouveau service ni modèle Firestore n’est requis. Le regroupement côté navigateur évite de changer les données existantes et garde les résultats soumis aux règles de lecture. Les règles d’import et de mouvement limitent les quantités à deux décimales. (basis: spécifications 0004 et 0006) La recherche par désignation peut toutefois lire toute la collection accessible. Toute lecture interrompue doit rester visible plutôt que de présenter un résultat incomplet comme complet. (basis: pagination complète et refus des résultats partiels)

Pour les localisations, l’ingénieur a choisi d’afficher uniquement les adresses distinctes, reliées par « + », comme « K10E + K5A ». Ce format rend les adresses visibles ensemble, mais retire le magasin et la division. Il peut donc être ambigu si plusieurs magasins utilisent le même code d’adresse.

## References

**Project sources**:
- `AGENTS.md`, règles de lecture Firestore et conventions de données.
- `docs/scope/scope.md`, recherche et consultation des positions.
- `index.html`, recherche exacte, scan et alias d’affichage existants.
- `docs/specs/0001-export-stock-excel.md`, parcours paginé des positions.
- `docs/specs/0004-import-initial-stock-excel.md` et `docs/specs/0006-stock-movements.md`, précision des quantités.

**Practices & standards**:
- La recherche paginée ne doit pas présenter un sous ensemble comme complet.
- Les permissions du service de données sont appliquées à chaque lecture.
- Une modification d’interface réversible par le retour à la version précédente ne nécessite pas de mécanisme de déploiement progressif.
