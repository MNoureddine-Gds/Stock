# 0001. Exporter les articles regroupés dans Excel

**Date**: 2026-11-04
**Status**: Proposed

## Summary

L’export Excel lit les positions accessibles au compte connecté et crée un fichier `.xlsx` daté, sans modifier Firestore. Les positions ayant le même code article exact sont regroupées sur une ligne avec un stock total et toutes leurs localisations. Une position sans code article garde sa propre ligne.

## Context

L’application est une page web en HTML, CSS et JavaScript. Elle utilise Firebase Authentication et Cloud Firestore, et lit déjà la collection `stockPositions` pour la recherche et l’affichage des codes barres. Les fonctionnalités existantes doivent rester disponibles.

Les personnes autorisées ont besoin d’un relevé complet, pas seulement des résultats d’une recherche. La lecture doit donc parcourir plusieurs pages et continuer au delà de 8 000 positions, tout en respectant les règles Firestore du compte connecté. Le projet ne contient pas de service serveur dédié à la génération de fichiers. (basis: `docs/scope/scope.md`, objectif et critères initiaux de l’export)

## Requirements

**User stories**:
* En tant que personne autorisée à consulter le stock, je veux télécharger la liste des articles dans un fichier Excel afin de travailler sur leurs quantités totales et leurs localisations.

**Acceptance criteria**:
* **AC-1**: Après connexion, un bouton « Exporter la liste des articles » est visible près des commandes de recherche. Il n’est pas accessible avant connexion.
* **AC-2**: L’action lit la collection `stockPositions` entière, indépendamment de la recherche en cours, par pages ordonnées selon l’identifiant du document. La lecture continue jusqu’à la fin, sans limite applicative de 8 000 documents. Une requête complète doit être autorisée par les règles Firestore; si elle est refusée, l’export s’arrête selon AC-9 plutôt que de contourner les règles ou d’afficher un sous ensemble comme complet.
* **AC-3**: Les positions dont le champ `articlecode` a la même valeur exacte produisent une seule ligne. Les documents sans `articlecode` produisent chacun leur propre ligne. Les lignes sont ordonnées par code article, puis par identifiant de document pour les lignes sans code. Les positions ne sont jamais supprimées parce qu’un autre champ est absent.
* **AC-4**: Les colonnes sont présentes dans cet ordre : « Code article », « Désignation », « Code-barres », « Localisations », « Quantité disponible », « Date d’extraction ». L’identifiant du document Firestore n’est pas une colonne. Les codes restent du texte afin de garder les zéros initiaux. Un total complet reste numérique. Si une position d’un groupe a une quantité absente, négative ou invalide, la cellule contient le texte « Incomplet » et aucun total partiel. Une vraie quantité zéro reste zéro. Les quantités valides gardent au plus deux décimales. (basis: préserver les identifiants comme texte)
* **AC-5**: Les valeurs sont lues selon les priorités indiquées dans « Value sourcing ». La désignation est la première valeur non vide du premier document par identifiant. Les codes barres distincts sont réunis dans une cellule, séparés par une virgule, et les astérisques Code 39 sont retirés. Les localisations distinctes sont réunies sous la forme « magasin / division / adresse », chaque combinaison séparée par un point virgule. Les champs absents, `null`, les chaînes vides et les chaînes composées uniquement d’espaces sont traités comme absents. Dans les colonnes de texte, les chaînes sont conservées, les nombres et booléens deviennent du texte, les horodatages Firestore deviennent ISO 8601 et les tableaux ou objets deviennent du JSON compact. Une valeur non représentable fait échouer l’export plutôt que d’être omise.
* **AC-6**: La date locale du navigateur est capturée au début de l’action. Le même jour est utilisé dans le nom `Export_Stock_YYYY-MM-DD.xlsx` et dans la colonne de date, sous forme de vraie date Excel affichée en `YYYY-MM-DD`.
* **AC-7**: Le classeur contient une feuille « Stock ». Si une feuille atteint 1 048 576 lignes, en comptant son en tête, les lignes suivantes continuent dans des feuilles « Stock 2 », « Stock 3 », et ainsi de suite. Chaque feuille reprend les en têtes. (basis: limite Excel de 1 048 576 lignes par feuille)
* **AC-8**: Pendant la lecture, le bouton d’export est désactivé et une zone d’état dédiée annonce le nombre de positions lues. À la fin, elle annonce le nombre d’articles exportés. Les messages n’écrasent pas l’état de recherche.
* **AC-9**: Si une lecture Firestore, la création du classeur ou le chargement de la bibliothèque Excel échoue, ou si le compte change ou se déconnecte, aucun classeur partiel n’est téléchargé. Un message clair est affiché pour les erreurs que le navigateur peut intercepter. Une nouvelle tentative est déclenchée par l’utilisateur après le message, sans reprise automatique.
* **AC-10**: Si aucune position n’est accessible, un classeur valide ne contenant que les en têtes est téléchargé et le message d’état indique zéro article.
* **AC-11**: Les valeurs de Firestore sont traitées comme des données. Les chaînes ne deviennent jamais des formules Excel. L’export ne modifie aucun document ni aucune collection.
* **AC-12**: Les pages sont lues au moment de leur requête. Si les données changent durant l’export, le fichier reflète les pages telles qu’elles ont été lues, sans prétendre être une photographie atomique de la collection.
* **AC-13**: La recherche par code article et la lecture par caméra restent utilisables et leur comportement actuel n’est pas supprimé ou remplacé.
* **AC-14**: Le fichier généré s’ouvre comme classeur `.xlsx` valide. Le nombre de lignes de données correspond aux groupes construits à partir de toutes les positions lues. Les tests incluent plus de 8 000 positions, des articles répartis sur plusieurs positions et des erreurs de lecture.

## Options considered

### Option 1: Regrouper et générer avec SheetJS dans le navigateur

La page lit les positions autorisées par pages, regroupe les lignes par code article, puis écrit un vrai fichier Excel dans le navigateur. (basis: l’application statique et les lectures Firestore de `index.html`)

**Pros**:
* S’intègre à l’application statique et à son accès Firebase existant.
* Ne demande ni serveur de génération ni nouvelle identité privilégiée.
* Peut créer plusieurs feuilles et conserver les types de cellule.

**Cons**:
* La génération et les données restent en mémoire dans le navigateur.
* Le chargement de la bibliothèque et l’export dépendent du CDN et du réseau.

### Option 2: Générer un CSV regroupé

La page regroupe les positions dans le navigateur et construit un fichier texte délimité plutôt qu’un classeur Excel. (basis: exigence d’un vrai fichier `.xlsx` dans `docs/scope/scope.md`)

**Pros**:
* Mise en œuvre plus légère et format lisible par de nombreux tableurs.
* Le regroupement des quantités et localisations reste possible.

**Cons**:
* Ce n’est pas un vrai fichier `.xlsx`.
* Les types, dates et valeurs textuelles sont moins fiables entre tableurs.

### Option 3: Regrouper et générer le classeur dans un service serveur

Un service dédié lit les données autorisées et génère le fichier hors du navigateur. (basis: absence de service serveur dans `AGENTS.md`)

**Pros**:
* Peut mieux convenir à de très grands exports et à un traitement prolongé.
* La génération ne dépend pas de la mémoire disponible dans le navigateur.

**Cons**:
* Ajoute un service, son déploiement, son suivi et une nouvelle surface d’autorisation.
* Risque d’introduire des privilèges de serveur qui ne correspondent pas aux droits Firestore du compte.

## Decision

**Chosen option**: Option 1: Générer le classeur regroupé avec SheetJS dans le navigateur.

La page lit toutes les positions autorisées, les regroupe par code article exact, puis crée le classeur dans le navigateur. Les quantités actuelles sont additionnées, les localisations distinctes sont réunies et aucune donnée Firestore n’est modifiée. (basis: `AGENTS.md`, `index.html`, spécification 0005)

## Rationale

La page actuelle est statique et lit déjà Firestore avec l’identité Firebase courante. Regrouper dans le navigateur permet de conserver ces permissions et d’éviter un service ou une migration de données. SheetJS reste adapté parce que le besoin demande un vrai classeur avec types de cellule, feuilles multiples et date Excel. Les imports et les mouvements limitent déjà les quantités à deux décimales. Le regroupement peut dépasser les ressources mémoire du navigateur sur un très grand stock, et doit alors échouer sans télécharger un fichier partiel. (basis: `AGENTS.md`, `index.html`, spécifications 0004, 0005 et 0006)

L’export ne pourra jamais élargir les droits du compte. Firestore demeure la source d’autorisation, et une lecture refusée arrête toute l’opération. La pagination par identifiant de document permet de continuer au delà de la taille d’une seule requête, mais ne fige pas les données pendant tout le parcours. (basis: règles de sécurité Firestore, pagination par curseur)

## Feature design

**Data model sketch**:

| Entity | Key | Fields used | Relationships and constraints |
|---|---|---|---|
| Position Firestore | `stockPositions/{documentId}` | Alias d’article, désignation, code barre, magasin, division, adresse et quantité actuelle | Un document représente une position. Plusieurs documents peuvent partager un code article. Aucun document ni champ Firestore nouveau. |
| Ligne Excel | Code article exact, ou identifiant de document si le code manque | Les six colonnes définies par AC-4 | Une ligne regroupe toutes les positions autorisées ayant le même code. Une position sans code garde sa propre ligne. L’agrégation est temporaire et n’est pas écrite dans Firestore. |

Les champs peuvent être absents, `null`, vides ou composés d’espaces. Une quantité zéro reste une valeur présente. Les désignations sont prises selon l’ordre d’alias existant et la première position par identifiant. Les codes barres sont réunis sans doublon. Les localisations sont réunies comme combinaisons distinctes magasin, division et adresse. Les quantités actuelles de toutes les positions d’un article sont additionnées. Une valeur de quantité doit être finie, non négative et avoir au plus deux décimales. Pour une quantité textuelle, retirer les espaces de bord, puis accepter seulement le format `^-?\\d+(\\.\\d{1,2})?$` et au plus 15 chiffres significatifs. Une quantité absente ou invalide dans un groupe produit « Incomplet », plutôt qu’un total partiel. Les autres valeurs textuelles conservent les conversions existantes. L’identifiant du document sert à paginer et à départager les positions sans code; il n’est pas exporté.

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
| Former un groupe | Code d’article partagé par plusieurs positions | Valeur exacte de `articlecode`; si elle manque, identifiant du document source |
| Remplir « Code article » | Code article | `articlecode`, sinon `name`; la valeur reste du texte |
| Remplir « Désignation » | Première désignation non vide du groupe | Positions ordonnées par identifiant, puis premier champ parmi `designation`, `name`, `articleName`, `description` |
| Remplir « Code-barres » | Codes barres distincts du groupe | `barcodes` si présent, sinon `barcode`, puis `codebarre`; parcourir les positions par identifiant et préserver l’ordre des tableaux, retirer les doublons et les astérisques Code 39 |
| Remplir « Localisations » | Combinaisons distinctes magasin, division et adresse | Positions par identifiant Firestore, puis premier champ disponible parmi `storename`, `storecode`, `magasin`; `divisionname`, `divisioncode`, `division`; `address`, `emplacement`, `location`; afficher chaque combinaison sous la forme « magasin / division / adresse » et préserver l’ordre de première apparition |
| Remplir « Quantité disponible » | Stock actuel total | Somme des quantités de toutes les positions du groupe, priorité `currentqy`, `currentqty`, `currentQuantity`, `quantity`, `stockactuel`; zéro reste zéro. Une valeur absente, négative ou invalide rend le total « Incomplet ». Pour une chaîne, retirer les espaces de bord, accepter le format `^-?\\d+(\\.\\d{1,2})?$` si le nombre est fini, non négatif et compte au plus 15 chiffres significatifs; limiter le total à deux décimales. |
| Remplir les colonnes textuelles | Valeur source sans perte silencieuse | Conserver les chaînes, traiter les chaînes uniquement composées d’espaces comme absentes, convertir nombres et booléens en texte, horodatages Firestore en ISO 8601, tableaux et objets en JSON compact; faire échouer l’export si une valeur ne peut pas être représentée |
| Nommer le fichier et remplir la date | Jour d’extraction | Année, mois et jour locaux capturés au premier clic; calcul du numéro de série Excel depuis ces composants locaux, affiché en `yyyy-mm-dd`, format ISO identique pour le nom |
| Afficher la progression | Nombre lu et nombre exporté | Compteur de documents reçus par les pages, sans compter les pages échouées |
| Créer les feuilles | Capacité par feuille et nom | Limite Excel de 1 048 576 lignes par feuille, une ligne réservée aux en têtes; noms `Stock`, `Stock 2`, puis numéro croissant |

**Key invariants**:
* Chaque position autorisée contribue à une ligne d’article. Les positions sans code article restent des lignes séparées.
* Aucune position n’est exclue pour un champ absent. Les positions d’un groupe sont toutes incluses dans le total et les localisations.
* Une quantité invalide ne devient jamais zéro et aucun total partiel n’est présenté comme complet.
* Les lectures utilisent toujours l’utilisateur Firebase courant et les règles Firestore.
* Un échec ou une session modifiée n’entraîne jamais le téléchargement d’un fichier incomplet.
* Les données du classeur ne sont jamais interprétées comme formules et ne sont jamais écrites dans Firestore.
* La date du fichier et celle du classeur proviennent du même jour local de démarrage. Sa représentation Excel ne dépend pas d’une conversion de fuseau horaire.

**Security model**:

Seuls les utilisateurs connectés peuvent démarrer l’export. La lecture utilise l’instance Firestore initialisée dans l’application et reste soumise aux règles configurées pour le compte courant. L’export ne contourne pas un refus et n’ajoute aucun accès privilégié. Si la session change pendant la pagination, l’opération s’arrête. Les valeurs texte Firestore sont écrites comme texte littéral. Aucun secret serveur, jeton ou nouvelle clé n’est requis.

**Critical test scenarios**:
* Parcours complet : exporter plusieurs pages autorisées, ouvrir le fichier `.xlsx`, vérifier les en têtes, la date, les lignes regroupées et quelques valeurs comparées à Firestore, vérifier le nombre exact de lignes, vérifier AC-2 à AC-8 et AC-14.
* Volume : exporter plus de 8 000 positions et vérifier l’absence de troncature; vérifier la distribution sur plusieurs feuilles à la limite Excel, vérifier AC-2 et AC-7.
* Regroupement : exporter un article présent dans plusieurs positions et vérifier une seule ligne, la somme, les localisations distinctes, les codes barres réunis et la désignation choisie selon l’ordre défini. Vérifier qu’un article sans code garde sa ligne, vérifier AC-3 à AC-5.
* Données : vérifier les codes avec zéros initiaux, les champs `null`, vides et composés d’espaces, le code barre sous forme de texte et de tableau, une quantité numérique zéro, un groupe avec une quantité valide et une autre absente ou invalide, une quantité texte décimale avec point, une quantité avec virgule décimale, une quantité négative et une chaîne trop précise. Vérifier AC-4 à AC-6 et AC-11.
* Liste vide : télécharger un classeur valide avec les en têtes et confirmer zéro article exporté, vérifier AC-10.
* Refus et échec : refuser une lecture complète, couper le réseau ou rendre SheetJS indisponible; confirmer un message clair et l’absence de fichier partiel, vérifier AC-9.
* Session, règles et changements : vérifier que les règles déployées autorisent ou refusent la requête complète pour le compte prévu; confirmer qu’un refus arrête l’export, vérifier AC-2 et AC-9. Changer ou fermer la session pendant la pagination et confirmer l’arrêt sans téléchargement, vérifier AC-9. Modifier des documents entre deux pages et confirmer que l’export ne prétend pas être une photographie atomique, vérifier AC-12.
* Texte littéral : exporter une désignation commençant par `=` et confirmer qu’elle reste du texte dans Excel, vérifier AC-11.
* Non régression : effectuer une recherche par code article puis une lecture par caméra après le changement, vérifier AC-13.

## Build plan

1. Conserver la lecture authentifiée et paginée de toutes les positions, en gardant l’arrêt sur erreur, satisfaisant **AC-1**, **AC-2**, **AC-9** et **AC-12**.
2. Regrouper les positions autorisées par code article exact, calculer les colonnes d’article, de localisation et de quantité, puis créer le classeur téléchargeable, satisfaisant **AC-3**, **AC-4**, **AC-5** et **AC-11**.
3. Préserver la date locale, les types de cellule, les feuilles successives, le cas vide, le contrôle de session et l’absence de fichier partiel, satisfaisant **AC-6** à **AC-10**.
4. Vérifier l’ouverture réelle du classeur, les regroupements et les totaux, le volume supérieur à 8 000 positions, les permissions et la recherche et le scan, satisfaisant **AC-1**, **AC-13** et **AC-14**.

## Consequences

**Positive**:
* Les utilisateurs obtiennent une ligne par article avec un total de stock et les localisations détaillées, sans service serveur supplémentaire.
* Les droits du compte et les données Firestore sont préservés.
* La pagination dépasse la limite de 8 000 et les limites de lignes par feuille sont traitées sans troncature silencieuse.

**Negative / tradeoffs**:
* Le navigateur conserve les pages et le classeur en mémoire. L’application n’ajoute pas de plafond fixe et doit dépasser 8 000 positions, mais aucun navigateur ne peut garantir un volume illimité. Une erreur interceptable arrête le téléchargement; un arrêt forcé du navigateur peut interrompre l’opération sans message.
* Le chargement de SheetJS dépend du CDN et d’Internet. La version doit être fixée, et un échec de chargement bloque l’export.
* Le fichier n’est pas une photographie atomique de toute la collection. Les documents peuvent évoluer entre deux pages.
* Le fichier ne montre plus les quantités séparées par position. Une désignation différente sur une position autre que la première n’apparaît pas dans la ligne regroupée.

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
* Les spécifications 0004, 0005 et 0006, validation et précision des quantités.

**Practices & standards**:
* Pagination Firestore par curseur pour parcourir les grandes collections.
* Respect des règles d’accès Firestore côté serveur.
* Préservation des identifiants comme texte pour garder les zéros initiaux.
* Limite Excel de 1 048 576 lignes par feuille.
