# 0005. Rechercher et afficher le stock par article

**Date**: 2026-11-04
**Status**: In Progress

## Summary

La recherche conserve les correspondances exactes par code article et code barre, ainsi que la recherche par désignation. Les positions d’un article sont additionnées et réunies sur une ligne seulement si elles occupent plusieurs adresses distinctes. Sinon, chaque position conserve sa ligne et sa quantité actuelle. Les adresses distinctes réunies s’affichent sous la forme « K10E + K5A », sans modifier Firestore.

## Requirements

**User stories**:
- En tant que personne connectée, je veux retrouver un article par code article, code barre ou désignation afin de consulter son stock total et ses emplacements.
- En tant que personne connectée, je veux une ligne par article dans un tableau afin de comparer les résultats facilement.

**Acceptance criteria**:
- **AC-1**: Le champ unique et les recherches exactes par code article et code barre restent utilisables. Le scan remplit toujours ce champ.
- **AC-2**: L’application cherche d’abord le code article exact, puis le code barre exact. Elle cherche une désignation seulement si aucune position ne correspond exactement au code saisi.
- **AC-3**: Une recherche par désignation exige au moins trois caractères après retrait des espaces de bord. Elle cherche le fragment n’importe où dans les champs, dans l’ordre `designation`, `name`, `articleName`, puis `description`.
- **AC-4**: La recherche de désignation ignore les différences de casse et d’accents. Elle compare le texte saisi et les désignations normalisés de la même façon.
- **AC-5**: La recherche par désignation lit toutes les pages autorisées de `stockPositions`, ordonnées par identifiant de document. Une erreur de lecture arrête la recherche et ne présente jamais un résultat partiel comme complet.
- **AC-6**: Les positions ayant le même `articlecode` sont réunies sur une ligne et leurs quantités sont additionnées uniquement si elles ont plusieurs adresses distinctes. Si elles partagent une seule adresse, chaque position garde sa propre ligne et sa quantité. Les documents sans code article restent chacun sur leur propre ligne. Pour chaque code trouvé par recherche exacte, par code barre ou par désignation, le tableau inclut toutes les positions autorisées ayant ce code, même si leur désignation ne contient pas le texte recherché.
- **AC-7**: Les résultats sont présentés dans un tableau avec les colonnes « Code article », « Désignation », « Codes barres », « Localisations » et « Stock actuel ». La quantité initiale et la date d’inventaire ne sont pas affichées. Sur téléphone, le tableau peut défiler horizontalement.
- **AC-8**: La désignation affichée est la première valeur non vide selon l’ordre des identifiants de document, en utilisant les alias `designation`, `name`, `articleName`, puis `description`. Les codes barres distincts sont réunis dans une cellule, séparés par des virgules, et les astérisques Code 39 sont retirés.
- **AC-9**: Pour les positions réunies parce qu’elles ont plusieurs adresses, la cellule « Localisations » affiche uniquement les adresses distinctes, reliées par « + » dans l’ordre de première apparition selon les identifiants Firestore. Une position affichée seule garde uniquement sa propre adresse. Le magasin et la division ne sont pas affichés. Une position sans adresse n’est pas omise et affiche « Adresse non renseignée ».
- **AC-10**: Le stock actuel est la somme des quantités actuelles des positions réunies. Pour chaque position, l’application retient la première valeur exploitable dans l’ordre `currentqy`, `currentqty`, `currentQuantity`, `quantity`, puis `stockactuel`. Une quantité exploitable est un nombre fini non négatif avec au plus deux décimales, ou une chaîne décimale avec un point ou une virgule comme séparateur décimal, qui représente une valeur finie non négative et compte au plus 15 chiffres significatifs. Les espaces de début et de fin sont ignorés. Les valeurs absentes ou invalides sont ignorées si un alias suivant est exploitable. Si aucun alias ne l’est pour une position, la cellule affiche « Incomplet » au lieu d’un total partiel. Une quantité égale à zéro reste valide.
- **AC-11**: Tous les articles trouvés sont accessibles par pages de 20 lignes, sans plafond total, et sont triés par code article en ordre croissant. Les lignes sans code article suivent l’ordre des identifiants Firestore. Le statut indique le nombre d’articles, non le nombre de positions.
- **AC-12**: Les états de chargement, aucun résultat et erreur sont clairement affichés. Toute erreur de lecture Firestore arrête la recherche, sans exception silencieuse ni résultat partiel. Les règles Firestore limitent toujours les données aux positions lisibles par le compte connecté. La recherche ne modifie aucune donnée.
- **AC-13**: La recherche par code article, la recherche par code barre et le scan restent utilisables après le changement.

## Decision

**Chosen option**: Option 1: Faire évoluer la recherche actuelle.

L’application conserve Firebase, lit les positions selon les règles actuelles, regroupe les résultats dans le navigateur et les présente dans un tableau paginé. (basis: `AGENTS.md`, `index.html`, spécification 0001)

## Rationale

Voir [rationale.md](./rationale.md) pour le raisonnement et les options considérées.

## Feature design

**Data model sketch**:

Aucun document ni champ Firestore n’est ajouté. Le navigateur construit un groupe temporaire par valeur exacte de `articlecode`. Les documents sans `articlecode` restent des groupes indépendants, identifiés pendant la recherche par leur identifiant Firestore.

| Entity | Key | Fields used | Relationships and constraints |
|---|---|---|---|
| Position Firestore | `stockPositions/{documentId}` | Code article, désignation, code barre, magasin, division, adresse et quantité actuelle | Une position appartient à un groupe d’article si son `articlecode` est identique. Aucun changement de persistance. |
| Ligne de résultat | Code article ou identifiant temporaire de position | Désignation, codes barres distincts, localisations distinctes et total de stock actuel | Une ligne par code article. Une position sans code garde sa propre ligne. |

**State transitions**:

Aucun état persistant n’est ajouté. La recherche passe de saisie à chargement, puis à résultats, aucun résultat ou erreur.

**API surface**:

| Action | Type | Entrées principales | Résultat principal | Authentification | Erreurs importantes |
|---|---|---|---|---|---|
| Chercher un code article | Lecture Firestore exacte | Texte saisi | Groupe des positions autorisées dont `articlecode` correspond exactement | Compte connecté | Lecture refusée ou erreur réseau |
| Chercher un code barre | Lectures Firestore exactes, formats texte et tableau | Texte saisi | Groupes des articles portant ce code barre | Compte connecté | Toute erreur de lecture arrête la recherche |
| Chercher une désignation | Lecture Firestore paginée puis filtre local | Texte normalisé d’au moins trois caractères | Groupes des articles ayant une désignation correspondante, avec toutes leurs positions autorisées | Compte connecté | Lecture interrompue, mémoire insuffisante |
| Parcourir les résultats | Pagination locale | Groupes trouvés et numéro de page | Jusqu’à 20 articles par page | Compte connecté | Aucun résultat suivant |

**Value sourcing**:

| Action | Valeur produite ou affichée | Source |
|---|---|---|
| Déterminer le type de recherche | Code article exact, code barre exact ou désignation | Priorité décidée dans cette spécification |
| Normaliser le texte | Texte sans espaces de bord, en minuscules et sans accents | Champ de recherche du navigateur |
| Identifier un groupe | Valeur exacte du code article; sans code, identifiant de position | `articlecode` et identifiant Firestore |
| Obtenir les positions | Documents et identifiants de position | Résultats exacts ou pages de `stockPositions` autorisées par Firestore |
| Choisir la désignation | Première valeur non vide du premier document par identifiant | Alias `designation`, `name`, `articleName`, `description` |
| Réunir les codes barres | Valeurs distinctes séparées par une virgule, sans astérisques Code 39 | `barcodes`, sinon `barcode`, puis `codebarre`, sur chaque position |
| Construire les localisations | Adresses distinctes reliées par « + » dans l’ordre de première apparition; « Adresse non renseignée » si une position n’a pas d’adresse | Positions triées par identifiant Firestore, puis les alias `address`, `emplacement`, `location` |
| Calculer le stock actuel | Une position seule affiche directement sa première quantité valide; plusieurs positions ne sont additionnées que si elles ont plusieurs adresses distinctes. « Incomplet » si une position affichée seule ou un groupe réunissant plusieurs adresses contient une quantité invalide | `currentqy`, `currentqty`, `currentQuantity`, `quantity`, puis `stockactuel`; les chaînes doivent correspondre à `^-?\\d+(\\.\\d{1,2})?$`, représenter une valeur non négative et respecter 15 chiffres significatifs |
| Construire les pages | Vingt lignes par page, sans limite totale | Positions seules ou groupes réunis après lecture |

**Key invariants**:

1. Une erreur de lecture ne devient jamais un résultat annoncé comme complet.
2. Les positions d’un article ne sont réunies et additionnées que si leurs adresses distinctes sont multiples.
3. Une position sans code article reste indépendante.
4. Une quantité manquante ou invalide n’est jamais remplacée par zéro.
5. La recherche exacte continue de précéder la recherche par désignation.
6. La recherche ne modifie rien dans Firestore et respecte les règles du compte connecté.
7. La recherche et le scan restent utilisables sur téléphone.

**Security model**:

Toutes les recherches exigent un compte Firebase connecté. Les règles Firestore existantes restent la seule autorité sur les positions que ce compte peut lire. Le navigateur n’élargit pas cet accès.

**Critical test scenarios**:

- Le code article exact retourne une ligne dont le total inclut toutes ses positions, vérifie **AC-1**, **AC-2**, **AC-6**, **AC-10**.
- Un code barre enregistré comme texte ou comme tableau retourne un seul groupe par code article et inclut toutes ses positions, vérifie **AC-1**, **AC-2**, **AC-6**, **AC-8**, **AC-9**.
- Un fragment de trois caractères trouve une désignation avec une autre casse et sans les mêmes accents, vérifie **AC-3**, **AC-4**.
- Plusieurs positions d’un article donnent une ligne, avec leurs adresses distinctes reliées par « + », leurs codes barres et leur stock total. Une position sans adresse affiche « Adresse non renseignée », vérifie **AC-6** à **AC-10**.
- Un article sans quantité exploitable affiche « Incomplet », et une quantité zéro reste zéro, vérifie **AC-10**.
- Plus de vingt articles restent accessibles par pages et aucun groupe n’est omis, vérifie **AC-5**, **AC-11**.
- Une erreur dans une des deux requêtes de code barre affiche une erreur, sans utiliser les résultats de l’autre requête comme résultat complet, vérifie **AC-1**, **AC-12**.
- Un refus de lecture affiche une erreur et aucun résultat partiel comme complet, vérifie **AC-5**, **AC-12**.
- Un compte non connecté ne peut pas chercher, les règles continuent de limiter les lectures et le scan reste utilisable, vérifie **AC-1**, **AC-12**, **AC-13**.

## Build plan

1. Faire évoluer les recherches exactes et par désignation pour produire des groupes par article, en conservant la priorité, les alias et la normalisation, satisfait **AC-1** à **AC-6**.
2. Calculer les désignations, codes barres, localisations et totaux depuis toutes les positions autorisées du groupe, sans total partiel, satisfait **AC-7** à **AC-10**.
3. Remplacer les cartes par un tableau paginé et accessible, puis préserver les états, les permissions, le scan et l’usage sur téléphone, satisfait **AC-11** à **AC-13**.
4. Vérifier les recherches exactes, les regroupements, les données manquantes, les résultats après vingt articles, les permissions et les erreurs, satisfait **AC-1** à **AC-13**.

## Consequences

**Positive**:
- Les personnes peuvent chercher un article sans connaître son code exact.
- Les articles s’affichent une fois, avec leur stock total et toutes leurs localisations.
- Aucun nouveau service ni changement du modèle Firestore n’est requis.

**Negative / tradeoffs**:
- Une recherche de désignation peut lire toutes les positions autorisées.
- Les performances dépendent du volume et de la mémoire disponibles dans le navigateur.
- Le tableau ne montre plus la quantité initiale ni la date d’inventaire. Les localisations multiples et les désignations incomplètes peuvent rendre certaines cellules longues.
- L’affichage des adresses seules peut être ambigu si plusieurs magasins utilisent le même code d’adresse.

**Neutral**:
- Les noms de champs historiques restent pris en charge.
- Une indexation dédiée pourra être proposée si des mesures montrent un besoin.

## Follow-up

- [ ] Mesurer les lectures et le temps de recherche sur le volume réel avant d’envisager un service d’indexation.
