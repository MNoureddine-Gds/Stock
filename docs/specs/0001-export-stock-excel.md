# 0001. Exporter les positions de stock dans Excel

**Date**: 2026-10-28
**Status**: Proposed

## Summary

Cette décision ajoute un export Excel à l’application de stock existante. Le navigateur lit les positions accessibles au compte connecté et crée un fichier `.xlsx` daté, sans modifier Firestore. Chaque position garde sa propre ligne, y compris si sa quantité est zéro ou si certains champs sont absents.

## Context

L’application est une page web en HTML, CSS et JavaScript. Elle utilise Firebase Authentication et Cloud Firestore, et lit déjà la collection `stockPositions` pour la recherche et l’affichage des codes barres. Les fonctionnalités existantes doivent rester disponibles.

Les personnes autorisées ont besoin d’un relevé complet, pas seulement des résultats d’une recherche. La lecture doit donc parcourir plusieurs pages et continuer au delà de 8 000 positions, tout en respectant les règles Firestore du compte connecté. Le projet ne contient pas de service serveur dédié à la génération de fichiers. (basis: `docs/scope/scope.md`, objectif et critères initiaux de l’export)

## Requirements

**User stories**:
* En tant que personne autorisée à consulter le stock, je veux télécharger la liste des positions dans un fichier Excel afin de travailler sur les articles, quantités et emplacements.

**Acceptance criteria**:
* **AC-1**: Après connexion, un bouton « Exporter la liste des articles » est visible près des commandes de recherche. Il n’est pas accessible avant connexion.
* **AC-2**: L’action lit la collection `stockPositions` entière, indépendamment de la recherche en cours, par pages ordonnées selon l’identifiant du document. La lecture continue jusqu’à la fin, sans limite applicative de 8 000 documents. Une requête complète doit être autorisée par les règles Firestore; si elle est refusée, l’export s’arrête selon AC-9 plutôt que de contourner les règles ou d’afficher un sous ensemble comme complet.
* **AC-3**: Chaque document autorisé produit une ligne indépendante. Les positions du même article ne sont pas regroupées et leurs quantités ne sont pas additionnées. Une quantité numérique égale à zéro est conservée. Une valeur absente reste vide et n’est pas convertie en zéro. Une position n’est pas supprimée parce qu’un autre champ est absent.
* **AC-4**: Les colonnes sont présentes dans cet ordre : « Code article », « Désignation », « Code-barres », « Magasin », « Division », « Emplacement », « Quantité disponible », « Date d’extraction ». L’identifiant du document Firestore n’est pas une colonne. Les codes et identifiants sont écrits comme texte. Les quantités numériques restent numériques. Les chaînes de quantité sont converties seulement si elles contiennent un nombre décimal non ambigu avec un point, au plus 15 chiffres significatifs et une valeur finie. Les autres chaînes restent du texte.
* **AC-5**: Les valeurs sont lues selon les priorités indiquées dans « Value sourcing ». Les champs absents, `null`, les chaînes vides et les chaînes composées uniquement d’espaces produisent une cellule vide. Les codes barres multiples sont réunis dans une cellule, séparés par une virgule, et les astérisques de délimitation Code 39 sont retirés. Dans les autres colonnes de texte, les chaînes sont conservées, les nombres et booléens sont convertis en texte, les horodatages Firestore sont convertis en ISO 8601 et les tableaux ou objets sont convertis en JSON compact. Une valeur non représentable fait échouer l’export plutôt que d’être omise.
* **AC-6**: La date locale du navigateur est capturée au début de l’action. Le même jour est utilisé dans le nom `Export_Stock_YYYY-MM-DD.xlsx` et dans la colonne de date, sous forme de vraie date Excel affichée en `YYYY-MM-DD`.
* **AC-7**: Le classeur contient une feuille « Stock ». Si une feuille atteint 1 048 576 lignes, en comptant son en tête, les lignes suivantes continuent dans des feuilles « Stock 2 », « Stock 3 », et ainsi de suite. Chaque feuille reprend les en têtes. (basis: limite Excel de 1 048 576 lignes par feuille)
* **AC-8**: Pendant la lecture, le bouton d’export est désactivé et une zone d’état dédiée annonce la progression avec le nombre de positions lues. À la fin, elle annonce le nombre exporté. Les messages n’écrasent pas l’état de recherche.
* **AC-9**: Si une lecture Firestore, la création du classeur ou le chargement de la bibliothèque Excel échoue, ou si le compte change ou se déconnecte, aucun classeur partiel n’est téléchargé. Un message clair est affiché pour les erreurs que le navigateur peut intercepter. Une nouvelle tentative est déclenchée par l’utilisateur après le message, sans reprise automatique.
* **AC-10**: Si aucune position n’est accessible, un classeur valide ne contenant que les en têtes est téléchargé et le message d’état indique zéro position.
* **AC-11**: Les valeurs de Firestore sont traitées comme des données. Les chaînes ne deviennent jamais des formules Excel. L’export ne modifie aucun document ni aucune collection.
* **AC-12**: Les pages sont lues au moment de leur requête. Si les données changent durant l’export, le fichier reflète les pages telles qu’elles ont été lues, sans prétendre être une photographie atomique de la collection.
* **AC-13**: La recherche par code article et la lecture par caméra restent utilisables et leur comportement actuel n’est pas supprimé ou remplacé.
* **AC-14**: Le fichier généré s’ouvre comme classeur `.xlsx` valide. Le nombre de lignes de données correspond au nombre de positions lues. Les tests incluent plus de 8 000 positions et des erreurs de lecture.

## Options considered

### Option 1: Générer le classeur avec SheetJS dans le navigateur

La page utilise une bibliothèque JavaScript pour écrire un vrai fichier Excel côté navigateur, à partir des lectures Firestore autorisées. (basis: l’application actuelle charge déjà Firebase et JsBarcode comme scripts navigateur dans `index.html`)

**Pros**:
* S’intègre à l’application statique et à son accès Firebase existant.
* Ne demande ni serveur de génération ni nouvelle identité privilégiée.
* Peut créer plusieurs feuilles et conserver les types de cellule.

**Cons**:
* La génération et les données restent en mémoire dans le navigateur.
* Le chargement de la bibliothèque et l’export dépendent du CDN et du réseau.

### Option 2: Générer un CSV compatible avec les tableurs

La page construit un fichier texte délimité plutôt qu’un classeur Excel. (basis: exigence du périmètre pour un vrai fichier `.xlsx`)

**Pros**:
* Mise en œuvre plus légère et format lisible par de nombreux tableurs.
* Peut réduire le coût de génération d’un classeur complexe.

**Cons**:
* Ce n’est pas un vrai fichier `.xlsx`.
* Les types, dates et valeurs textuelles sont moins fiables entre tableurs.

### Option 3: Générer le classeur dans un service serveur

Un service dédié lit les données et génère le fichier hors du navigateur. (basis: pratique de génération serveur pour les exports qui dépassent les ressources du navigateur)

**Pros**:
* Peut mieux convenir à de très grands exports et à un traitement prolongé.
* La génération ne dépend pas de la mémoire disponible dans le navigateur.

**Cons**:
* Ajoute un service, son déploiement, son suivi et une nouvelle surface d’autorisation.
* Risque d’introduire des privilèges de serveur qui ne correspondent pas aux droits Firestore du compte.

## Decision

**Chosen option**: Option 1: Générer le classeur avec SheetJS dans le navigateur.

La page chargera une version fixe de la distribution navigateur officielle SheetJS et réutilisera l’instance Firebase déjà initialisée. Le développement vérifiera la version et l’adresse auprès de la documentation officielle, évitera une adresse flottante et utilisera une empreinte d’intégrité si la distribution la fournit. Aucune recherche web n’a été autorisée pendant cette conception. (basis: l’architecture existante dans `AGENTS.md` et `index.html`, dépendances navigateur déjà chargées par script)

**Implementation skills**: aucune skill communautaire n’a été utilisée.

## Rationale

La page actuelle est statique et lit déjà Firestore avec l’identité Firebase courante. Une génération dans le navigateur répond au besoin sans nouveau service ni nouvelle clé. SheetJS est choisi plutôt que CSV parce que le besoin demande un vrai classeur avec types de cellule, feuilles multiples et date Excel. (basis: `AGENTS.md`, `index.html`, exigences du périmètre)

L’export ne pourra jamais élargir les droits du compte. Firestore demeure la source d’autorisation, et une lecture refusée arrête toute l’opération. La pagination par identifiant de document permet de continuer au delà de la taille d’une seule requête, mais ne fige pas les données pendant tout le parcours. (basis: règles de sécurité Firestore, pagination par curseur)

## Feature design

**Data model sketch**:

| Entity | Key | Fields used | Relationships and constraints |
|---|---|---|---|
| Position Firestore | `stockPositions/{documentId}` | `articlecode`, `name`, `designation`, `articleName`, `description`, `barcodes`, `barcode`, `codebarre`, `storename`, `storecode`, `magasin`, `divisionname`, `divisioncode`, `division`, `address`, `emplacement`, `location`, `currentqy`, `currentqty`, `currentQuantity`, `quantity`, `stockactuel` | Un document représente une position. Plusieurs documents peuvent partager un code article. Aucun document ni champ Firestore nouveau. |
| Ligne Excel | Identifiant temporaire du document source, non exporté | Les huit colonnes définies par AC-4 | Une ligne par document lu, sans agrégation ni persistance. |

Les champs d’article, désignation, magasin, division, emplacement, code barre et quantité peuvent être absents. `null`, une chaîne vide ou une chaîne d’espaces est traitée comme absente. La quantité zéro est une valeur présente. Les codes barres sous forme de tableau sont réunis dans une cellule. Les priorités d’alias reprennent l’ordre déjà utilisé dans l’interface, y compris `name` comme solution de repli pour le code article et la désignation. Pour une quantité textuelle, retirer les espaces au début et à la fin, puis convertir seulement une chaîne qui correspond à `^-?\\d+(\\.\\d+)?$`, reste finie et ne dépasse pas 15 chiffres significatifs. Les autres chaînes restent du texte. Les autres valeurs de quantité déjà numériques restent numériques. Les chaînes de texte sont conservées telles quelles sauf si elles ne contiennent que des espaces. Les nombres et booléens des colonnes textuelles deviennent du texte, les horodatages Firestore deviennent des chaînes ISO 8601, et les tableaux et objets deviennent du JSON compact. Une valeur impossible à représenter fait échouer l’export. L’identifiant du document sert au curseur de pagination mais n’est pas exporté.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| Aucun endpoint serveur | Aucun | Aucun | Aucun | Aucun | Aucun |
| Bouton « Exporter la liste des articles » et fonction navigateur `exportStock()` | Action locale de l’interface | Session Firebase courante, date locale au clic | Téléchargement `.xlsx`, progression, compte final | Authentification Firebase requise, règles Firestore du compte courant | Accès Firestore refusé, session modifiée, échec réseau, SheetJS indisponible, erreur de création du classeur |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Démarrer l’export | Identité et autorisation | `auth.currentUser` et règles Firestore appliquées à la lecture de `stockPositions` |
| Paginer les positions | Document et ordre de parcours | `stockPositions`, identifiant Firestore, pages ordonnées par `firebase.firestore.FieldPath.documentId()` avec une limite de 500 documents |
| Remplir « Code article » | Code de la position | Premier champ disponible parmi `articlecode`, puis `name` |
| Remplir « Désignation » | Texte descriptif | Premier champ disponible parmi `designation`, `name`, `articleName`, puis `description` |
| Remplir « Code-barres » | Un ou plusieurs codes | `barcodes` si présent, sinon premier champ disponible parmi `barcode`, puis `codebarre`; tableaux réunis, astérisques Code 39 retirés |
| Remplir « Magasin » | Nom ou code du magasin | Premier champ disponible parmi `storename`, `storecode`, puis `magasin` |
| Remplir « Division » | Nom ou code de division | Premier champ disponible parmi `divisionname`, `divisioncode`, puis `division` |
| Remplir « Emplacement » | Adresse ou emplacement | Premier champ disponible parmi `address`, `emplacement`, puis `location` |
| Remplir « Quantité disponible » | Quantité de cette position | Premier champ disponible parmi `currentqy`, `currentqty`, `currentQuantity`, `quantity`, puis `stockactuel`; zéro reste zéro, champ absent reste vide; retirer les espaces autour d’une chaîne et convertir seulement le format `^-?\\d+(\\.\\d+)?$` si le nombre est fini et compte au plus 15 chiffres significatifs; garder les autres chaînes comme texte |
| Remplir les colonnes textuelles | Valeur source sans perte silencieuse | Conserver les chaînes, traiter les chaînes uniquement composées d’espaces comme absentes, convertir nombres et booléens en texte, horodatages Firestore en ISO 8601, tableaux et objets en JSON compact; faire échouer l’export si une valeur ne peut pas être représentée |
| Nommer le fichier et remplir la date | Jour d’extraction | Année, mois et jour locaux capturés au premier clic; calcul du numéro de série Excel depuis ces composants locaux, affiché en `yyyy-mm-dd`, format ISO identique pour le nom |
| Afficher la progression | Nombre lu et nombre exporté | Compteur de documents reçus par les pages, sans compter les pages échouées |
| Créer les feuilles | Capacité par feuille et nom | Limite Excel de 1 048 576 lignes par feuille, une ligne réservée aux en têtes; noms `Stock`, `Stock 2`, puis numéro croissant |

**Key invariants**:
* Une position source autorisée correspond à exactement une ligne de données.
* Aucune position n’est exclue pour un champ absent, et aucune quantité n’est agrégée.
* Les lectures utilisent toujours l’utilisateur Firebase courant et les règles Firestore.
* Un échec ou une session modifiée n’entraîne jamais le téléchargement d’un fichier incomplet.
* Les données du classeur ne sont jamais interprétées comme formules et ne sont jamais écrites dans Firestore.
* La date du fichier et celle du classeur proviennent du même jour local de démarrage. Sa représentation Excel ne dépend pas d’une conversion de fuseau horaire.

**Security model**:

Seuls les utilisateurs connectés peuvent démarrer l’export. La lecture utilise l’instance Firestore initialisée dans l’application et reste soumise aux règles configurées pour le compte courant. L’export ne contourne pas un refus et n’ajoute aucun accès privilégié. Si la session change pendant la pagination, l’opération s’arrête. Les valeurs texte Firestore sont écrites comme texte littéral. Aucun secret serveur, jeton ou nouvelle clé n’est requis.

**Critical test scenarios**:
* Parcours complet : exporter plusieurs pages autorisées, ouvrir le fichier `.xlsx`, vérifier les en têtes, la date et quelques valeurs comparées à Firestore, vérifier le nombre exact de lignes, vérifier AC-2 à AC-8 et AC-14.
* Volume : exporter plus de 8 000 positions et vérifier l’absence de troncature; vérifier la distribution sur plusieurs feuilles à la limite Excel, vérifier AC-2 et AC-7.
* Données : vérifier les codes avec zéros initiaux, les champs `null`, vides et composés d’espaces, le code barre sous forme de texte et de tableau, une quantité numérique zéro, une quantité absente, une quantité texte décimale avec point, une quantité avec virgule décimale et une chaîne trop précise, vérifier AC-3 à AC-6 et AC-11.
* Liste vide : télécharger un classeur valide avec les en têtes et confirmer zéro position, vérifier AC-10.
* Refus et échec : refuser une lecture complète, couper le réseau ou rendre SheetJS indisponible; confirmer un message clair et l’absence de fichier partiel, vérifier AC-9.
* Session, règles et changements : vérifier que les règles déployées autorisent ou refusent la requête complète pour le compte prévu; confirmer qu’un refus arrête l’export, vérifier AC-2 et AC-9. Changer ou fermer la session pendant la pagination et confirmer l’arrêt sans téléchargement, vérifier AC-9. Modifier des documents entre deux pages et confirmer que l’export ne prétend pas être une photographie atomique, vérifier AC-12.
* Texte littéral : exporter une désignation commençant par `=` et confirmer qu’elle reste du texte dans Excel, vérifier AC-11.
* Non régression : effectuer une recherche par code article puis une lecture par caméra après le changement, vérifier AC-13.

## Build plan

1. Vérifier avec le compte prévu que les règles Firestore autorisent la requête complète de `stockPositions`; arrêter la conception du développement si elle est refusée, satisfaisant **AC-2** et **AC-9**.
2. Ajouter le bouton authentifié, une zone d’état propre à l’export et le chargement du script SheetJS avec une version fixe; relier une lecture Firestore réelle à un premier classeur téléchargeable, satisfaisant **AC-1**, **AC-4**, **AC-5** et **AC-8**.
3. Étendre le parcours de bout en bout avec pagination ordonnée par identifiant, correspondance des champs, typage des cellules, date locale et création de feuilles successives, satisfaisant **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6** et **AC-7**.
4. Ajouter le contrôle de session, les états d’erreur, l’arrêt sans résultat partiel et le cas vide, puis vérifier que les chaînes restent du texte et que Firestore n’est jamais modifié, satisfaisant **AC-9**, **AC-10**, **AC-11** et **AC-12**.
5. Tester l’ouverture réelle du classeur, les données de Firestore, le volume supérieur à 8 000, l’accès au bouton et la recherche et le scan existants, satisfaisant **AC-1**, **AC-13** et **AC-14**.

## Consequences

**Positive**:
* Les utilisateurs obtiennent le classeur demandé sans service serveur supplémentaire.
* Les quantités par emplacement et les droits du compte sont préservés.
* La pagination dépasse la limite de 8 000 et les limites de lignes par feuille sont traitées sans troncature silencieuse.

**Negative / tradeoffs**:
* Le navigateur conserve les pages et le classeur en mémoire. L’application n’ajoute pas de plafond fixe et doit dépasser 8 000 positions, mais aucun navigateur ne peut garantir un volume illimité. Une erreur interceptable arrête le téléchargement; un arrêt forcé du navigateur peut interrompre l’opération sans message.
* Le chargement de SheetJS dépend du CDN et d’Internet. La version doit être fixée, et un échec de chargement bloque l’export.
* Le fichier n’est pas une photographie atomique de toute la collection. Les documents peuvent évoluer entre deux pages.

**Neutral**:
* Aucune migration Firestore, aucun endpoint et aucune donnée persistante ne sont ajoutés.
* La collection locale ne contient pas les règles Firestore. Le comportement réel d’un export complet devra être vérifié avec un compte autorisé dans Firebase.

## Follow-up

* [ ] Avant le développement, vérifier les règles Firestore déployées avec le compte prévu. Si la requête complète est refusée, arrêter et décider séparément comment les droits doivent être ajustés, sans utiliser de privilèges serveur.
* [ ] Vérifier la version stable actuelle, l’adresse officielle et une éventuelle empreinte d’intégrité de SheetJS avant de fixer le script.
* [ ] La recherche de ressources pour SheetJS a été reportée. Une recherche de skill pourrait fournir les pratiques de génération de classeurs dans le navigateur. Un serveur MCP est facultatif et n’est pas requis pour cette fonctionnalité.
* [ ] Le contexte `AGENTS.md` indique un fichier de configuration Firebase séparé, tandis que `index.html` initialise aussi Firebase avec sa configuration. Demander à `/sync` de réconcilier ce contexte sans exposer de valeur de configuration.

## References

**Project sources**:
* `AGENTS.md`, stack, règles du projet et collection utilisée.
* `index.html`, initialisation Firebase, recherche, correspondance des champs et affichage des codes barres.
* `docs/scope/scope.md`, objectif et critères initiaux de l’export.

**Practices & standards**:
* Pagination Firestore par curseur pour parcourir les grandes collections.
* Respect des règles d’accès Firestore côté serveur.
* Préservation des identifiants comme texte pour garder les zéros initiaux.
* Limite Excel de 1 048 576 lignes par feuille.
