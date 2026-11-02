# 0004. Importer le stock initial depuis Excel

**Date**: 2026-11-02
**Status**: In Progress

## Summary

Cette fonctionnalité permet aux responsables de charger le stock de départ depuis des fichiers Excel, par lots vérifiés. Le navigateur lit le fichier, montre les lignes valides et les erreurs, puis écrit seulement les nouvelles positions dans Firebase après confirmation. L’import sert uniquement à l’initialisation, il ne remplace jamais une position déjà présente.

## Context

La base de stock se construit progressivement à partir des informations préparées dans Excel. L’application existante est une page web qui utilise Firebase Authentication, Firestore et SheetJS. Elle attend un document par position, et non un total regroupé par article.

L’import doit rester un outil temporaire de démarrage. Après la constitution de la base, l’administrateur retire les responsables de la liste d’autorisation, puis les articles et les mouvements sont gérés dans l’application. La synchronisation automatique avec OneDrive et Google Sheets ne fait pas partie de cette décision.

Un import qui écrit trop tôt, qui ne trouve pas les positions existantes ou qui reprend mal après une coupure peut créer des doublons ou des quantités incorrectes. Les règles Firestore déployées ne sont pas présentes dans le dépôt. Leur vérification et leur configuration font donc partie des conditions de mise en service.

## Requirements

**User stories**:

1. En tant que responsable autorisé, je veux préparer et vérifier un classeur Excel avant l’écriture afin de construire la base initiale sans créer de doublons.
2. En tant qu’administrateur, je veux autoriser puis retirer les responsables de l’import sans supprimer les données importées.
3. En tant que responsable, je veux voir le résultat de mes lots et reprendre après une interruption sans effacer les positions déjà créées.

**Acceptance criteria**:

1. **AC-1**: Seul un utilisateur connecté dont le UID a un document dans `stockImportManagers/{uid}` peut ouvrir l’import ou consulter son historique. L’accès peut être retiré par suppression de ce document dans la console Firebase. L’import est disponible sur ordinateur et tablette. Sur téléphone, l’import est masqué ou désactivé avec un message, tandis que la recherche et le scan restent utilisables. L’export existant reste utilisable.
2. **AC-2**: L’application permet de télécharger un fichier `.xlsx` modèle avec une seule feuille et seulement les en têtes, sans ligne fictive. Les en têtes sont « Code article », « Désignation », « Magasin », « Division », « Emplacement », « Quantité initiale », « Code barre » et « Date inventaire ».
3. **AC-3**: Un seul fichier `.xlsx` est traité à la fois et reste dans le navigateur. Les en têtes obligatoires sont « Code article », « Magasin », « Division », « Emplacement » et « Quantité initiale ». Leur ordre est libre. Les espaces au début et à la fin des en têtes sont ignorés, mais la casse et les accents doivent correspondre. Les en têtes obligatoires absentes ou tout en tête reconnu répété invalident le fichier sans écriture. Les colonnes inconnues sont ignorées et signalées. Si plusieurs feuilles contiennent les en têtes obligatoires, le fichier est refusé comme ambigu. Les feuilles sans ces en têtes sont ignorées et signalées.
4. **AC-4**: Les codes et les champs d’identité doivent être des cellules texte afin de conserver les zéros initiaux. La quantité doit être numérique, égale ou supérieure à zéro, et contenir au plus deux décimales. Zéro est accepté. Une date facultative accepte une vraie date Excel ou un texte valide au format `AAAA-MM-JJ`. Une date invalide, une cellule de formule ou une valeur obligatoire invalide rejette sa ligne. Les lignes entièrement vides sont ignorées.
5. **AC-5**: Après lecture et vérification des positions existantes, l’application montre les compteurs complets, un aperçu des 20 premières lignes valides et toutes les erreurs avec leur numéro de ligne Excel. Les erreurs sont affichées par pages de 100 au plus, mais aucune erreur n’est omise. Les lignes valides peuvent être importées même si d’autres lignes sont rejetées. Aucune écriture n’a lieu avant la confirmation explicite.
6. **AC-6**: La position est identifiée par `articlecode`, `storename`, `divisionname` et `address`. Seuls les espaces au début et à la fin de ces quatre valeurs sont retirés. La casse et les accents restent significatifs. Les champs d’identité sont conservés comme texte. Le code barre facultatif est un seul texte, ses espaces de bord et ses astérisques sont retirés. La désignation est facultative.
7. **AC-7**: Les lignes entièrement vides sont ignorées. Si plusieurs lignes non vides du fichier ont la même clé de position après normalisation, toutes les lignes concernées sont rejetées. Une position déjà présente dans Firestore est ignorée et n’est jamais mise à jour. Si plusieurs documents existants correspondent à la même clé, la ligne est rejetée comme ambiguë.
8. **AC-8**: Une nouvelle position est enregistrée dans `stockPositions` avec un identifiant déterministe dérivé de la clé normalisée. La quantité importée est écrite numériquement dans `initialqy`, `currentqy` et `quantity`. Le code barre est enregistré dans `barcodes` sous forme d’un tableau contenant au plus une valeur, pour rester compatible avec la recherche actuelle. Une date fournie est écrite au format `AAAA-MM-JJ` dans `inventorydate` et `dateinventaire`. Un champ facultatif vide n’est pas écrit.
9. **AC-9**: Avant toute écriture, l’application lit toutes les positions visibles par le compte, par pages de 500 documents ordonnées par identifiant Firestore, sans limite applicative. La comparaison suit les alias existants: code article `articlecode` puis `name`, magasin `storename` puis `storecode` puis `magasin`, division `divisionname` puis `divisioncode` puis `division`, emplacement `address` puis `emplacement` puis `location`. Si la lecture complète échoue ou si les règles ne permettent pas de vérifier les positions, l’import s’arrête sans écrire.
10. **AC-10**: Les écritures ne remplacent jamais un document existant. Deux imports simultanés de la même position laissent gagner la première création. Si un groupe est refusé parce qu’une autre création a gagné, l’application relit les positions concernées, les compte comme déjà présentes et réessaie les autres lignes, au plus trois fois. Une autre erreur de permission arrête les écritures restantes. Les règles Firestore doivent interdire à l’import de modifier ou supprimer une position.
11. **AC-11**: Les positions sont écrites en groupes de 400 au plus. Chaque groupe et la mise à jour de son résumé sont atomiques. Une annulation arrête les groupes suivants, sans supprimer les groupes déjà enregistrés. Une erreur de lecture ou une perte d’autorisation arrête les écritures restantes. Le résultat explique les lignes déjà enregistrées et permet de renvoyer le fichier, les positions présentes étant ignorées. Aucun nombre maximal de lignes n’est imposé par l’application. Une limite de ressources du navigateur produit une erreur claire, jamais un import tronqué annoncé comme complet.
12. **AC-12**: Un résumé est créé seulement si au moins une position est enregistrée. Il contient l’état, `createdAt`, `expiresAt`, le nombre de lignes non vides lues, créées, ignorées et rejetées. Une ligne déjà présente est ignorée; une ligne invalide ou dupliquée est rejetée. Le résumé ne contient ni le nom du fichier, ni l’identité de la personne, ni le détail des erreurs. Les états sont `in_progress`, `completed` et `partial`. Un lot terminé reste `completed` même s’il contient des lignes rejetées. Une interruption ou une annulation après écriture devient `partial`. Si une coupure empêche d’enregistrer cet état, un lot `in_progress` dont `createdAt` date de plus de 24 heures est traité comme interrompu lors de la consultation de l’historique.
13. **AC-13**: L’historique est réservé aux responsables autorisés, affiche 20 résumés par page du plus récent au plus ancien et permet de parcourir les pages suivantes. Les résumés expirent après un an au moyen de l’expiration automatique Firebase. Le retard éventuel de suppression par Firebase est affiché comme une limite de conservation approximative.
14. **AC-14**: Le fichier Excel n’est jamais envoyé ni conservé dans Firebase. Si l’analyse échoue, si l’utilisateur annule avant la première écriture ou si l’accès Firestore est refusé avant les écritures, aucune donnée de stock n’est modifiée.

## Options considered

### Option 1: Lire dans le navigateur et écrire avec le SDK Firebase

Le navigateur utilise le fichier local, l’instance Firebase déjà initialisée et les règles Firestore du compte connecté.

**Pros**:

1. Aucun service serveur ni identifiant privilégié à créer.
2. Le fichier ne quitte pas l’ordinateur.
3. Les écritures restent soumises aux règles Firebase.

**Cons**:

1. Le navigateur garde les lignes nécessaires en mémoire.
2. La sécurité dépend de règles Firestore correctement configurées et vérifiées.
3. Une interruption peut laisser les groupes déjà enregistrés, qui ne sont pas annulés.

### Option 2: Importer d’abord dans une collection temporaire

Le navigateur ou un service copie chaque ligne dans une zone temporaire, puis un second parcours valide et applique le lot.

**Pros**:

1. Le contenu d’un lot pourrait être conservé pour une reprise détaillée.
2. La validation et l’application seraient séparées.

**Cons**:

1. Les données du fichier seraient conservées dans Firebase, contrairement au besoin exprimé.
2. Il faudrait gérer le nettoyage, les accès et la durée de vie de chaque lot temporaire.
3. Le parcours ajoute des étapes sans supprimer le besoin de protéger les positions finales.

### Option 3: Traiter le fichier dans un service serveur

Un service reçoit le fichier, vérifie les lignes et écrit dans Firestore avec une identité serveur.

**Pros**:

1. Le traitement ne dépendrait pas autant de la mémoire du navigateur.
2. La logique d’import serait centralisée côté serveur.

**Cons**:

1. Le projet n’a pas actuellement de service serveur pour cette tâche.
2. Il faudrait déployer et surveiller un nouveau service.
3. Une identité serveur pourrait avoir plus de droits que la personne qui lance l’import.

## Decision

**Chosen option**: Option 1: Lire dans le navigateur et écrire avec le SDK Firebase.

Le fichier sera analysé localement avec la version de SheetJS déjà chargée par l’application, puis les créations seront réalisées avec le SDK Firebase existant et protégées par les règles Firestore. Aucune synchronisation externe, aucun stockage du fichier et aucune mise à jour de position existante ne sont prévus.

## Rationale

L’import est une opération d’initialisation faite par des responsables déjà connectés à l’application. Le parcours existant fournit Firebase Authentication, Firestore et SheetJS, et le volume attendu est de 1 000 à 10 000 lignes par fichier. Le traitement dans le navigateur évite un serveur privilégié et garde le fichier local.

Une collection temporaire ou un serveur ajouterait des données et des opérations à gérer alors que le besoin est d’ajouter des positions validées une seule fois. Le coût accepté est la mémoire du navigateur et une reprise par nouveau fichier après interruption. Les groupes déjà validés restent en base et le fichier renvoyé ignore ces positions.

L’UID dans `stockImportManagers` constitue le seul droit d’import. Les règles Firestore déployées doivent autoriser les lectures nécessaires et les créations prévues, sans permettre à ce parcours de modifier ou supprimer une position. Si les règles ne satisfont pas ces conditions, l’import ne démarre pas.

## Feature design

**Data model sketch**:

| Entity | Key | Fields | Relationships and constraints |
|---|---|---|---|
| Position | `stockPositions/{positionId}` | Chaînes requises: `articlecode`, `storename`, `divisionname`, `address`, `importBatchId`. Nombres requis: `initialqy`, `currentqy`, `quantity`. Chaînes facultatives: `designation`, `inventorydate`, `dateinventaire`. Tableau facultatif: `barcodes`, zéro ou une chaîne. | Une position par clé normalisée. `positionId` est le SHA-256 des octets UTF-8 de la représentation JSON ordonnée des quatre champs normalisés. |
| Résumé d’import | `stockImportRuns/{runId}` | Texte requis: `status`. Horodatages requis: `createdAt`, `expiresAt`. Entiers requis: `rowsRead`, `createdCount`, `skippedCount`, `rejectedCount`. | Un résumé peut être lié à plusieurs positions par `importBatchId`. Pas de nom de fichier, UID ou erreurs détaillées. Pas de champ `updatedAt`. |
| Responsable | `stockImportManagers/{uid}` | La présence du document donne le droit d’importer et de lire l’historique. Aucun champ obligatoire. | Les documents sont ajoutés et supprimés par l’administrateur dans la console Firebase. Le client ne peut pas gérer cette liste. |

`createdAt` est un horodatage créé par Firebase. `expiresAt` est calculé à un an de la création et sert à l’expiration automatique. Comme le modèle ne contient pas `updatedAt`, un résumé `in_progress` vieux de plus de 24 heures est considéré interrompu. Les créations suivantes utilisent un nouveau `runId`.

**State transitions**:

`in_progress` → `completed` lorsque toutes les lignes valides ont été traitées.

`in_progress` → `partial` si le responsable arrête l’opération, si une erreur interrompt les groupes suivants, ou si le résumé a plus de 24 heures.

Un état final ne revient pas à `in_progress`. Un nouvel essai crée un nouveau résumé. Une erreur technique peut empêcher la mise à jour de l’état; dans ce cas le résumé reste `in_progress` jusqu’à sa détection après 24 heures.

**API surface**:

| Action | Type | Entrées principales | Résultat principal | Authentification | Erreurs importantes |
|---|---|---|---|---|---|
| Télécharger le modèle | Action locale de l’interface | Aucune | Fichier `.xlsx` avec les en têtes | Responsable connecté | SheetJS indisponible, création du fichier impossible |
| Analyser le fichier | Action locale avec File API et SheetJS | Un fichier `.xlsx` local | En têtes, lignes valides, compteurs, erreurs et aperçu | Responsable connecté | Mauvais format, feuille absente ou ambiguë, en tête invalide, mémoire insuffisante |
| Vérifier les positions | Lectures Firestore paginées | Clés du fichier et session courante | Lignes existantes, ignorées ou ambiguës | Responsable autorisé par les règles Firestore | Lecture refusée, réseau interrompu, résultat incomplet |
| Confirmer l’import | Action locale avec le SDK Firestore | Lignes confirmées, identifiant de lot | Compteurs, progression et état du lot | Responsable autorisé par les règles Firestore | Création refusée, conflit, perte d’accès, réseau interrompu |
| Arrêter l’import | Action locale de l’interface | Import courant | Arrêt après le groupe en cours, état partiel si des lignes ont été enregistrées | Responsable courant | État non enregistrable si le réseau est perdu |
| Lire l’historique | Lecture Firestore paginée | Curseur de page facultatif | Jusqu’à 20 résumés triés par `createdAt` | Responsable autorisé par les règles Firestore | Lecture refusée ou erreur réseau |

**Value sourcing**:

| Action | Valeur produite ou affichée | Source |
|---|---|---|
| Autoriser l’interface | UID et rôle du responsable | `auth.currentUser.uid` et existence de `stockImportManagers/{uid}` |
| Créer le modèle | En têtes Excel | Liste exacte définie dans AC-2 |
| Lire le classeur | Cellules, formules, feuille et numéros de ligne | Fichier local choisi par le responsable et données de feuille SheetJS |
| Valider une ligne | Code article, magasin, division, emplacement | Colonnes requises, cellules texte, espaces de bord retirés |
| Valider la quantité | Nombre initial | Cellule numérique « Quantité initiale », zéro permis, deux décimales au plus |
| Valider les champs facultatifs | Désignation, code barre et date | Colonnes facultatives du fichier; date Excel ou texte `AAAA-MM-JJ` |
| Détecter un doublon du fichier | Clé de position normalisée | `articlecode`, `storename`, `divisionname` et `address` de la ligne |
| Détecter une position existante | Positions pertinentes | Toutes les pages autorisées de `stockPositions`, par groupes de 500, ordonnées par identifiant Firestore. Pour chaque valeur, choisir le premier alias non vide dans l’ordre spécifié par AC-9. |
| Créer une position | Identifiant stable et champs Firestore | SHA-256 de la représentation JSON ordonnée de la clé; autres valeurs validées du fichier |
| Écrire la quantité | `initialqy`, `currentqy`, `quantity` | Valeur numérique de « Quantité initiale » |
| Écrire le code barre | `barcodes` | Valeur facultative nettoyée, tableau d’une seule chaîne au plus |
| Écrire la date | `inventorydate`, `dateinventaire` | Date facultative validée, format `AAAA-MM-JJ` |
| Afficher la progression | Lignes lues, créées, ignorées et rejetées | Résultats de l’analyse et des groupes Firestore confirmés |
| Créer un résumé | État et compteurs du lot | Résultats d’import; dates Firebase; expiration calculée à un an |
| Lire l’historique | Résumés et page suivante | `stockImportRuns`, tri par `createdAt` décroissant et curseur Firestore |

**Key invariants**:

1. Le fichier et ses données détaillées restent dans le navigateur.
2. L’import ne met jamais à jour ni ne supprime une position existante.
3. Une clé de position identique produit le même identifiant déterministe.
4. Une ligne en double dans le fichier ne crée aucune des lignes ayant cette clé.
5. Une lecture complète refusée ou incomplète empêche toute écriture.
6. Chaque groupe de positions et son compteur sont enregistrés atomiquement.
7. Un échec après un groupe ne supprime pas les groupes déjà écrits.
8. Un lot terminé reste terminé même si certaines lignes ont été rejetées.
9. La suppression d’un responsable retire le droit d’import, sans toucher aux données.

**Security model**:

Toutes les actions exigent une session Firebase. L’application vérifie le document `stockImportManagers/{uid}`. Les règles Firestore doivent limiter la lecture de cette liste au document de l’utilisateur, empêcher le client de modifier les autorisations, et réserver la lecture et l’écriture des résumés aux responsables autorisés.

Avant le développement, les règles déployées doivent être vérifiées. Elles doivent autoriser au responsable la lecture complète de `stockPositions` nécessaire au contrôle des doublons et les créations prévues, tout en empêchant ce parcours de modifier ou supprimer les positions. Un refus ou une lecture incomplète arrête l’import. Aucun accès privilégié côté serveur ne contourne ces règles.

**Critical test scenarios**:

1. Parcours nominal: un responsable télécharge le modèle, importe un fichier valide, vérifie l’aperçu, confirme et retrouve les positions et le résumé dans Firestore. Vérifie **AC-1**, **AC-2**, **AC-5**, **AC-8**, **AC-12**.
2. Validation: les en têtes manquantes, une quantité négative, une formule, une date invalide et des clés en double sont signalées avec leurs numéros de ligne; les lignes valides restent importables. Vérifie **AC-3** à **AC-7**.
3. Reprise et concurrence: deux imports tentent de créer la même position; une seule création est conservée, le second essai ne l’écrase pas, et un nouvel envoi après interruption ignore les positions déjà créées. Vérifie **AC-7**, **AC-10**, **AC-11**, **AC-12**.
4. Accès: un compte connecté sans document responsable ne voit ni l’import ni l’historique et ne peut pas appeler leurs écritures. Vérifie **AC-1**, **AC-13**.
5. Échec avant écriture: un refus de lecture complète, une erreur d’analyse ou une annulation avant le premier groupe ne modifie aucune position. Vérifie **AC-9**, **AC-14**.
6. Conservation et fonctions existantes: l’historique est paginé, expire après un an selon la politique Firebase, et recherche, scan et export continuent de fonctionner. Vérifie **AC-1**, **AC-13**.

## Build plan

1. Ajouter le contrôle du responsable et un premier parcours vertical dans la page existante, de la sélection du classeur à la création d’une position réelle avec le modèle confirmé. Vérifie les règles Firestore avant toute écriture. Satisfait **AC-1**, **AC-3**, **AC-8**, **AC-9**, **AC-10**, **AC-14**.
2. [x] Ajouter le modèle Excel, l’analyse locale, la normalisation des valeurs et les validations par ligne, puis l’aperçu, les compteurs et l’affichage complet des erreurs par pages de 100 au plus avant confirmation. Satisfait **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**.
3. Ajouter la lecture paginée des positions existantes, la détection des alias et des ambiguïtés, les identifiants déterministes et les écritures par groupes de 400 au plus avec règles de création seulement. Satisfait **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**.
4. Ajouter la progression, l’arrêt, le résumé atomique des lots, la reprise par nouvel envoi, l’historique paginé et l’expiration. Satisfait **AC-11**, **AC-12**, **AC-13**.
5. Vérifier les règles Firebase déployées et la politique d’expiration, puis valider le volume attendu, les échecs et la préservation de la recherche, du scan et de l’export. Satisfait **AC-1**, **AC-9**, **AC-10**, **AC-11**, **AC-13**, **AC-14**.

## Consequences

**Positive**:

1. Le responsable voit les erreurs avant de modifier le stock.
2. Le fichier n’est pas envoyé vers un stockage serveur.
3. Les positions déjà présentes et leur historique ne sont pas remplacés.
4. Les groupes confirmés restent disponibles après une interruption.

**Negative / tradeoffs**:

1. L’analyse et les données de travail utilisent la mémoire du navigateur.
2. Une interruption après écriture laisse un lot partiel, qui doit être repris avec le fichier.
3. L’application dépend de règles Firestore et d’une politique d’expiration configurées dans Firebase.
4. Sans `updatedAt`, la détection automatique d’une interruption peut attendre 24 heures.

**Neutral**:

1. Les données déjà présentes qui utilisent des alias historiques doivent être prises en compte pendant la vérification.
2. Le retrait des responsables après l’initialisation est une action administrative dans la console Firebase.

## Follow-up

1. Avant le développement, vérifier les règles Firestore réelles et confirmer qu’elles permettent la lecture complète nécessaire, la création par les responsables et la protection contre les mises à jour par ce parcours.
2. Configurer l’expiration automatique Firebase sur `stockImportRuns.expiresAt`.
3. Après la construction de la base initiale, retirer les documents responsables de `stockImportManagers`.
