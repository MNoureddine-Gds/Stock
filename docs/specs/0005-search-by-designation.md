# 0005. Rechercher le stock par désignation

**Date**: 2026-11-02
**Status**: Proposed

## Summary

La recherche actuelle trouve un article par code article ou code barre. Cette proposition ajoute la recherche par fragment de désignation tout en gardant le champ unique et le scan. Elle parcourt toutes les positions autorisées par pages, puis montre tous les résultats sans en cacher.

## Context

L’application utilise Firebase Authentication et Cloud Firestore. La recherche existante trouve d’abord les positions par code article exact, puis par code barre exact. Les désignations peuvent se trouver dans `designation`, `name`, `articleName` ou `description`.

Firestore ne fournit pas directement une recherche contenant un fragment de texte sans index ou service supplémentaire. La recherche choisie lit donc les positions accessibles par pages et filtre les désignations dans le navigateur. Le minimum de trois caractères réduit les recherches trop larges, mais chaque recherche par désignation peut toujours lire une grande partie de la collection.

> ⚠️ Premise note: Une recherche par fragment peut coûter davantage qu’une recherche exacte. Le parcours complet paginé évite de cacher des positions et respecte les accès Firestore, mais son coût dépend du volume autorisé. Si ce coût devient gênant, une indexation dédiée devra être conçue séparément.

## Requirements

**User stories**:
- En tant que personne connectée, je veux retrouver une position par code article, code barre ou désignation afin de consulter rapidement son emplacement et son stock.
- En tant que personne connectée, je veux parcourir tous les résultats correspondants afin qu’une position ne soit pas masquée par une limite arbitraire.

**Acceptance criteria**:
- **AC-1**: Le champ unique et la recherche existante par code article exact et code barre exact restent utilisables. Le scan remplit toujours ce champ.
- **AC-2**: L’application cherche d’abord le code article exact, puis le code barre exact. Elle cherche une désignation seulement si aucune position ne correspond exactement au code saisi.
- **AC-3**: Une recherche par désignation exige au moins trois caractères après retrait des espaces de bord. Elle cherche le fragment n’importe où dans les champs, dans l’ordre `designation`, `name`, `articleName`, puis `description`.
- **AC-4**: La recherche de désignation ignore les différences de casse et d’accents. Elle compare le texte saisi et les désignations normalisés de la même façon.
- **AC-5**: La recherche par désignation lit toutes les pages visibles de `stockPositions`, ordonnées par identifiant de document. Une erreur de lecture arrête la recherche et ne présente pas un résultat partiel comme complet.
- **AC-6**: Tous les résultats sont accessibles par pages de 20 positions, sans plafond total. Chaque position garde son propre résultat, même si plusieurs positions partagent le même article.
- **AC-7**: Les résultats gardent les champs déjà affichés, y compris le code article, la désignation, le magasin, la division, l’emplacement, les quantités, la date et le code barre.
- **AC-8**: Les états de chargement, aucun résultat et erreur sont clairement affichés. Les règles Firestore continuent de limiter les résultats aux positions lisibles par le compte connecté.

## Options considered

### Option 1: Lire les positions visibles et filtrer dans le navigateur

L’application parcourt la collection par pages et recherche le fragment dans les désignations.

**Pros**:
- Réutilise Firebase et les permissions actuelles.
- Trouve un fragment à n’importe quel endroit du texte.
- Ne demande ni service ni préparation des documents existants.

**Cons**:
- Une recherche peut lire une grande partie de la collection.
- Le navigateur doit garder ou parcourir les données de recherche.

### Option 2: Préparer des champs normalisés dans Firestore

Chaque position reçoit des valeurs de recherche calculées à l’avance et maintenues lors de ses changements.

**Pros**:
- Réduit les lectures lors de certaines recherches.
- Peut être adapté à un plus grand volume.

**Cons**:
- Demande de préparer les positions existantes.
- Il faut maintenir les champs de recherche à chaque écriture.
- Une recherche contenant un fragment arbitraire ne se traduit pas directement par une requête Firestore simple.

### Option 3: Ajouter un moteur de recherche

Un service spécialisé indexe les désignations et retourne les positions correspondantes.

**Pros**:
- Recherche textuelle plus rapide et plus complète à grande échelle.

**Cons**:
- Ajoute un fournisseur, une configuration et un coût opérationnel.
- Demande de synchroniser les changements Firestore vers l’index.

## Decision

**Chosen option**: Option 1: Lire les positions visibles et filtrer dans le navigateur.

L’application utilise Firebase seul, lit les positions accessibles par pages, puis affiche les correspondances par fragment dans une liste paginée.

## Rationale

Le projet utilise déjà Firestore, et aucun volume mesuré ne justifie un nouveau service. Le parcours paginé réutilise les règles de lecture et permet de garder tous les résultats accessibles. Le seuil de trois caractères limite les recherches les plus larges, sans prétendre supprimer le coût d’une recherche complète.

## Feature design

**Data model sketch**:

Aucun nouveau document ni champ Firestore n’est requis.

| Source | Données utilisées | Type |
|---|---|---|
| `stockPositions` | `articlecode`, `barcodes`, `designation`, `name`, `articleName`, `description`, et les champs affichés existants | Documents existants |

**State transitions**:

Aucun état persistant n’est ajouté. La recherche passe de saisie à chargement, puis à résultats, aucun résultat ou erreur.

**API surface**:

| Action | Type | Entrées principales | Résultat principal | Authentification | Erreurs importantes |
|---|---|---|---|---|---|
| Chercher un code article | Lecture Firestore exacte | Texte saisi | Toutes les positions de l’article | Compte connecté | Lecture refusée ou erreur réseau |
| Chercher un code barre | Lectures Firestore exactes, formats texte et tableau | Texte saisi | Positions portant le code barre et positions du même article | Compte connecté | Lecture refusée ou erreur réseau |
| Chercher une désignation | Lecture Firestore paginée puis filtre local | Texte normalisé d’au moins trois caractères | Positions dont une désignation contient le texte | Compte connecté | Lecture interrompue, mémoire insuffisante |
| Parcourir les résultats | Pagination locale | Résultats trouvés et numéro de page | Jusqu’à 20 positions par page | Compte connecté | Aucun résultat suivant |

**Value sourcing**:

| Action | Valeur produite ou affichée | Source |
|---|---|---|
| Déterminer le type de recherche | Code article exact, code barre exact ou désignation | Priorité décidée dans cette spécification |
| Normaliser le texte | Texte sans espaces de bord, en minuscules et sans accents | Champ de recherche du navigateur |
| Obtenir les positions | Document et identifiant de position | Pages de `stockPositions` autorisées par Firestore |
| Choisir la désignation | Première valeur non vide parmi les alias | `designation`, `name`, `articleName`, `description` |
| Afficher un résultat | Champs de position et valeurs actuelles | Document Firestore, avec les alias déjà utilisés par `index.html` |
| Construire les pages | Vingt résultats par page, sans limite totale | Résultats complets après lecture |

**Key invariants**:

1. Une lecture incomplète ne devient jamais un résultat annoncé comme complet.
2. Une position n’est jamais supprimée du résultat simplement parce qu’une autre position partage son code article.
3. La recherche exacte continue de précéder la recherche par désignation.
4. La recherche par désignation n’écrit rien dans Firestore.
5. La recherche et le scan restent utilisables sur téléphone.

**Security model**:

Toutes les recherches exigent un compte Firebase connecté. Les règles Firestore existantes restent la seule autorité sur les positions que ce compte peut lire. Le navigateur n’élargit pas cet accès.

**Critical test scenarios**:

- Le code article exact retourne toutes ses positions et n’appelle pas le filtre de désignation, vérifie **AC-1**, **AC-2**, **AC-6**.
- Un code barre enregistré comme texte ou comme tableau retourne ses positions, puis les autres positions du même article, vérifie **AC-1**, **AC-2**.
- Un fragment de trois caractères trouve une désignation avec une autre casse et sans les mêmes accents, vérifie **AC-3**, **AC-4**.
- Plus de vingt résultats restent accessibles par pages et aucune position n’est omise, vérifie **AC-5**, **AC-6**.
- Un refus de lecture après une page affiche une erreur et aucun résultat partiel comme complet, vérifie **AC-5**, **AC-8**.
- Un compte non connecté ne peut pas chercher, et un compte connecté conserve le scan, vérifie **AC-1**, **AC-8**.

## Build plan

1. Conserver les recherches exactes par code article et code barre, puis ajouter le filtre de désignation avec les alias et la normalisation décidés, satisfait **AC-1**, **AC-2**, **AC-3**, **AC-4**.
2. Parcourir les positions par pages complètes, arrêter sur toute erreur, puis garder tous les résultats accessibles par pages de 20, satisfait **AC-5**, **AC-6**.
3. Préserver l’affichage des positions, les états d’erreur et les fonctions de recherche et de scan sur les tailles d’écran existantes, satisfait **AC-7**, **AC-8**.
4. Vérifier les recherches exactes, les alias, les résultats au delà de la première page, les permissions et les échecs de lecture, satisfait **AC-1** à **AC-8**.

## Consequences

**Positive**:
- Les personnes peuvent chercher un article sans connaître son code exact.
- Toutes les positions restent accessibles.
- Aucun nouveau service ni changement du modèle Firestore n’est requis.

**Negative / tradeoffs**:
- Une recherche de désignation peut lire toutes les positions autorisées.
- Les performances dépendent du volume et de la mémoire disponibles dans le navigateur.

**Neutral**:
- Les noms de champs historiques restent pris en charge.
- Une indexation dédiée pourra être proposée si des mesures montrent un besoin.

## Follow-up

- [ ] Mesurer les lectures et le temps de recherche sur le volume réel avant d’envisager un service d’indexation.

## References

**Project sources**:
- `AGENTS.md`, règles de lecture Firestore et conventions de données.
- `docs/scope/scope.md`, recherche et consultation des positions.
- `index.html`, recherche exacte, scan et alias d’affichage existants.
- `docs/specs/0001-export-stock-excel.md`, parcours paginé des positions.

**Practices & standards**:
- La recherche paginée ne doit pas présenter un sous ensemble comme complet.
- Les permissions du service de données sont appliquées à chaque lecture.
