# 0003. Stock sync OneDrive Google Firebase

**Date**: 2026-10-29
**Status**: Proposed

## Summary

Cette décision remplace la conception initiale de la synchronisation automatique en gardant la logique simple et sûre. Le flux lit le classeur OneDrive en planifié toutes les 15 minutes, le recopie dans Google Sheets comme zone de staging, puis applique uniquement les lignes valides de `STOCK_ACTUEL` dans `stockPositions` de Firebase.

Le système garde la dernière copie validée dans Google Sheets, conserve un journal d’exécution sur 90 jours, et bloque tout lot si le mapping ou le calcul n’est pas fiable. Cela évite les mises à jour partielles, la perte de données et les écritures dans Firestore sans validation.

## Context

L’application est une page statique en HTML, CSS et JavaScript avec Firebase Authentication et Firestore. Elle lit déjà la collection `stockPositions` et attend une ligne par position de stock, avec des champs comme `articlecode`, `storename`, `divisionname`, `address`, `currentqy`, `quantity`, `inventorydate`, `dateinventaire`, `barcodes` et `barcode`.

Le classeur OneDrive `suivi de stock acgsim 2026.xlsx` contient cinq feuilles, dont `STOCK_ACTUEL` est la feuille de calcul du stock courant. Les formules de cette feuille dépendent de `STOCK_INITIAL`, `ARTICLES` et `MOUVEMENTS`, et elle est la source de vérité métier pour les quantités de stock à envoyer dans Firebase.

Le besoin est de conserver un flux à sens unique et fiable. OneDrive est la source de données, Google Sheets est la zone de staging a posteriori, et Firebase est la base de vérité de l’application. Le site web ne doit pas écrire directement dans Firestore, et le code de synchronisation ne doit pas dépendre d’un navigateur ni exposer des secrets dans l’application.

Le principal risque est de traduire les formules Excel vers Google Sheets sans conservation de leur calcul, ou de publier une mise à jour partielle dans Firebase. Pour cela, le flux choisi recopie toutes les feuilles sélectionnées dans Google Sheets, valide le lot complet, puis n’écrit que les lignes de `STOCK_ACTUEL` dont le calcul est fiable et où la clé de position est complète.

## Requirements

**User stories**:
- En tant que gestionnaire de stock, je veux qu’un changement de classeur soit repris automatiquement toutes les 15 minutes afin d’éviter de corriger manuellement les quantités.
- En tant qu’utilisateur autorisé, je veux que les positions dans l’application restent cohérentes, sans doublons ni écriture partielle.
- En tant qu’administrateur, je veux un journal clair et une conservation fiable des exécutions réussies et échouées.

**Acceptance criteria**:
- **AC-1**: le flux se déclenche automatiquement toutes les 15 minutes et compare le classeur OneDrive avec la dernière version connue avant d’écrire dans Firebase.
- **AC-2**: le lot est validé avant l’écriture Firestore et ne publie pas de mise à jour partielle si une colonne, un calcul ou une clé sont invalides.
- **AC-3**: Google Sheets garde la dernière copie validée des feuilles sélectionnées et conserve un journal d’exécution séparé sur 90 jours.
- **AC-4**: les feuilles `STOCK_INITIAL`, `ARTICLES`, `MOUVEMENTS` et `STOCK_ACTUEL` sont recopiées dans Google Sheets avec leur structure d’origine, et les formules sont écrites afin de rester calculables dans Sheets.
- **AC-5**: le calcul de `STOCK_ACTUEL` est valorisé à partir du résultat calculé dans Google Sheets, pas à partir du texte brut de la formule Excel.
- **AC-6**: les lignes de `STOCK_ACTUEL` sont lues comme la source de données vers Firestore, et les autres feuilles ne sont pas écrites directement dans `stockPositions`.
- **AC-7**: la clé de position est `articlecode + storename + divisionname + address`, avec normalisation des espaces de bord seulement et conservation de la casse et des accents.
- **AC-8**: si une ligne a une clé incomplète, le lot entier est rejeté et aucun document n’est écrit dans Firestore.
- **AC-9**: si un lot contient deux lignes ayant exactement la même clé de position dans `STOCK_ACTUEL`, le lot est rejeté et aucun document n’est écrit.
- **AC-10**: le code article dans `ARTICLES` est vérifié pour l’unicité, sans bloquer un même article présent dans plusieurs magasins ou divisions.
- **AC-11**: une valeur de quantité décimale est acceptée, y compris zéro, et écrite dans `currentqy` et `quantity` pour préserver la compatibilité avec le code existant.
- **AC-12**: si le calcul de `STOCK_ACTUEL` n’est pas disponible ou s’il est invalide après la traduction des formules, le lot est rejeté et la dernière copie validée dans Sheets est conservée.
- **AC-13**: un code barre absent ne bloque pas la synchronisation et n’écrase pas un code déjà présent ; le champ `barcodes` est normalisé sans astérisques.
- **AC-14**: une position absente du classeur n’est pas supprimée dans Firestore ; la synchronisation garde la dernière donnée valide.
- **AC-15**: si plusieurs documents Firestore correspondent à la même clé de position, le lot est rejeté pour éviter l’écriture sur le mauvais document.
- **AC-16**: les journaux d’exécution restent conservés pendant 90 jours et ne remplacent pas la dernière copie validée de Google Sheets.

## Options considered

### Option 1: Lire directement le classeur OneDrive et écrire dans Firestore

Cette option mettrait directement le code backend en contact avec le fichier OneDrive et injecterait les lignes directement dans Firestore.

**Pros**:
- plus court à concevoir au départ
- moins d’étapes de transport

**Cons**:
- plus fragile pour le contrôle de validation
- plus difficile de préserver les formules et les dépendances de calcul
- plus délicat pour la reprise après échec
- moins de visibilité sur les lignes qui seront écrites

### Option 2: OneDrive vers Google Sheets puis Firebase, architecture recommandée

Cette option recopie les feuilles sélectionnées dans Google Sheets, laisse les formules dans leur environnement d’origine, et envoie uniquement les lignes validées de `STOCK_ACTUEL` vers Firestore.

**Pros**:
- la feuille de staging garde une vue lisible et exploitable du dernier jeu validé
- le lot peut être validé avant l’écriture dans Firebase
- le runtime côté serveur garde les secrets hors du navigateur
- la reprise après échec est plus claire car la dernière version valide reste disponible

**Cons**:
- ajoute une étape de staging et un journal d’exécution
- demande une traduction ou une validation des formules pour Google Sheets
- exige un contrôle plus strict sur le mapping et les conditions de rejet

### Option 3: Déclencher le lot via Microsoft Graph webhook

Cette option place un webhook Graph devant la fonction Firebase pour détecter le changement plus rapidement qu’un contrôle planifié.

**Pros**:
- plus rapide dans la détection du changement
- plus conforme à un flux d’événements en direct

**Cons**:
- besoin d’un point d’entrée public HTTPS, d’un renouvellement d’abonnement et d’un signal de reprise
- plus de pièces mobiles et plus de points de défaillance
- pas nécessaire pour le délai visé de 15 minutes

## Decision

**Chosen option**: Option 2: OneDrive vers Google Sheets puis Firebase

Le flux utilisera une fonction Firebase planifiée toutes les 15 minutes, qui lit le classeur OneDrive avec Microsoft Graph delta, recopie les feuilles sélectionnées dans Google Sheets, puis applique uniquement les lignes validées de `STOCK_ACTUEL` dans `stockPositions` sans écriture partielle.

**Implementation skills**: none

## Rationale

Le projet est déjà une application statique avec Firebase et un backend absent. Le choix le plus sûr est donc un traitement serveur dédié à Firebase Functions, avec des secrets stockés dans Secret Manager et un accès OneDrive accordé une fois au compte de service ou au compte utilisateur autorisé. Cela évite d’exposer des identifiants dans le navigateur et garde la logique fonctionnelle dans un runtime que l’équipe contrôle.

Le fait de garder la dernière copie validée dans Google Sheets est un point clé. Les formules Excel ne sont pas directement compatibles avec Google Sheets, et il vaut mieux conserver les feuilles dans leur état calculable, puis lire `STOCK_ACTUEL` à partir d’une version stable et validée. Le lot ne doit être publié dans Firestore que si les colonnes clés, les formules traduites et la clé de position sont cohérentes.

La règle de rejet est explicitement stricte. Une clé incomplète, une ligne dupliquée sur la même clé, un document Firestore ambigu ou un résultat calculé indisponible doivent bloquer le lot. Cela évite de publier une donnée périmée ou de choisir de manière silencieuse le mauvais document de Firestore. Les quantités nulles restent expédiées comme zéro lorsqu’elles sont calculées, car la règle métier du projet demande de préserver la quantité zéro et de ne pas confondre un zéro avec une donnée absente.

## Feature design

**Data model sketch**:
- `stockPositions` est la collection cible dans Firestore et contient une position de stock par document.
- La clé métier est `articlecode + storename + divisionname + address`, avec normalisation des espaces de bord seulement.
- La quantité est basée sur le calcul de `STOCK_ACTUEL` et écrite dans `currentqy` et `quantity`.
- Le code barre est pris dans `STOCK_INITIAL`, sans astérisques, et enregistré dans `barcodes` sous forme de chaîne unique.
- Les champs non mappés restent inchangés et ne sont pas écrasés.
- L’état technique du flux est conservé dans une collection Firestore privée, séparée de `stockPositions`, pour suivre le curseur Microsoft Graph, le `run_id` et le statut du dernier traitement.

**State transitions**:
- `idle` → `polling` → `downloaded` → `staged` → `validated` → `applied` ou `rejected`
- `rejected` si un calcul est indisponible, si une clé est incomplète, si la même position est dupliquée dans un lot, ou si plusieurs documents Firebase répondent à la même clé.

**API surface**:
| Endpoint / Job | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| Microsoft Graph delta poll | scheduled job | folder id, token refresh, workbook metadata | changed workbook state | delegated OAuth with refresh token | 401, 403, 404, throttling |
| Google Sheets staging sync | scheduled job | selected sheets, workbook id, spreadsheet id | staged workbook mirror, validation report | Google service account | 400, 403, invalid sheet mapping |
| Firestore apply batch | scheduled job | validated rows, mapping, batch limits | updated docs, rejected rows | Firebase Admin SDK | duplicate key, partial write, timeout |
| execution log | write | run id, status, counts, summary | run journal row | Firebase Admin SDK | storage error |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| OneDrive change detection | changed workbook signal | Microsoft Graph delta response |
| Sheet mirror | workbook values and formulas | selected worksheets copied from OneDrive |
| Firebase key | `articlecode + storename + divisionname + address` | `STOCK_ACTUEL` mapped cells, trimmed only |
| Quantity update | `currentqy` and `quantity` | calculated result from `STOCK_ACTUEL` in Google Sheets |
| Barcode update | `barcodes` | `STOCK_INITIAL` code barre cleaned of `*` |
| Run log | last execution summary | scheduled job metadata and validation report |

**Key invariants**:
- Aucune écriture dans Firestore ne doit avoir lieu sans un lot validé.
- Une clé de position complète est obligatoire pour chaque ligne de `STOCK_ACTUEL`.
- Deux lignes du même lot ne peuvent pas viser la même clé de position.
- Le code barre ne remplace pas un code existant et ne peut pas bloquer un traitement valide.
- Une position absente du classeur ne doit pas être supprimée dans Firestore.
- La dernière copie validée dans Sheets reste en place lorsqu’un lot est rejeté.

**Security model**:
- Les autorisations Microsoft et Google sont gérées côté serveur via OAuth ou service account, sans clé privée dans le dépôt.
- La synchronisation s’exécute dansFirebase Functions avec des permissions d’administration dédiées.
- La collection de suivi technique est séparée de `stockPositions` pour garder l’état de synchronisation hors du périmètre de l’application utilisateur.
- Les règles Firestore existantes restent la limite de sécurité pour les données visibles côté client, tandis que l’écriture du backend est faite via l’Admin SDK.

**Configuration required**:
- `ONE_DRIVE_CLIENT_ID`: identifiant client OAuth Microsoft Graph pour la lecture du fichier autorisé.
- `ONE_DRIVE_CLIENT_SECRET`: secret OAuth stocké dans Secret Manager et non dans le dépôt.
- `ONE_DRIVE_REFRESH_TOKEN`: jeton de renouvellement conservé dans Secret Manager.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: identité de service partagée avec le classeur.
- `GOOGLE_SHEET_ID`: identifiant du classeur de staging partagé avec le service.
- `FIREBASE_PROJECT_ID`: identifiant du projet Firebase pour la fonction et les écritures Admin.
- `SYNC_STATE_COLLECTION`: nom de la collection privée contenant le curseur et l’état du dernier traitement.

**Critical test scenarios**:
- Happy path: un changement de classeur est détecté, les quatre feuilles sont recopiées dans Google Sheets, les lignes valides de `STOCK_ACTUEL` sont écrites dans Firestore, et le journal contient un succès, verifies **AC-1**, **AC-3**, **AC-6**, **AC-11**.
- Failure case: une clé incomplète, une ligne en double ou un calcul indisponible fait tomber le lot entier sans aucune écriture Firestore, verifies **AC-2**, **AC-8**, **AC-9**, **AC-12**.
- Auth and permission: un compte Microsoft ou Google invalide ou révoqué dans Secret Manager bloque la synchronisation et conserve la dernière version valide, verifies **AC-1**, **AC-3**, **AC-16**.

## Build plan

1. Créer le module de synchronisation planifiée Firebase Functions, avec le polling Microsoft Graph delta toutes les 15 minutes et la persistance du curseur de reprise, satisfies **AC-1**, **AC-16**.
2. Configurer la sécurité côté secrets, le rôle de service Google et le partage du classeur de staging, satisfies **AC-3**, **AC-4**, **AC-16**.
3. Définir le mapping source vers destination et la normalisation des clés, y compris la règle de quantité zéro, satisfies **AC-5**, **AC-7**, **AC-8**, **AC-11**, **AC-14**.
4. Lire les feuilles de staging et convertir le résultat calculé de `STOCK_ACTUEL` en lignes de validation avant l’écriture Firestore, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-12**.
5. Ajouter le batch de validation Firestore, le test de doublons de document, le rejet de lot et la journalisation du run id, satisfies **AC-2**, **AC-9**, **AC-10**, **AC-13**, **AC-15**.
6. Vérifier le volume du lot, la dernière copie valide en Sheets et le comportement sur code barre absent ou quantité manquante, satisfies **AC-2**, **AC-11**, **AC-13**, **AC-14**.

## Consequences

**Positive**:
- les données restent cohérentes et la synchronisation est séquencée et vérifiable
- le site ne dépend pas d’une écriture directe depuis le navigateur
- le dernier état valide du classeur est conservé pour les reprises et le diagnostic

**Negative / tradeoffs**:
- le flux ajoute un backend, des secrets et un journal d’exécution
- le temps de traitement est plus long qu’un webhook direct
- les formules Excel doivent être testées une par une pour leur compatibilité Google Sheets

**Neutral**:
- un lot rejeté ne modifie pas la base et laisse la dernière version valide en place
- la persistance du curseur et du run id ajoute un peu de structure technique privée à Firestore

## Follow-up

- [ ] Créer la configuration Firebase Functions, Secret Manager, Google service account et partage du classeur de staging.
- [ ] Préparer le mapping final exact des colonnes du classeur et la traduction des formules dans Google Sheets.
- [ ] Vérifier le coût et la limite de 500 positions par lot avant activation en production.

## References

- Microsoft Graph change notifications and subscriptions documentation, official docs, checked 2026-10-29: https://learn.microsoft.com/en-us/graph/api/resources/change-notifications-api-overview?view=graph-rest-1.0
- Microsoft Graph subscription resource, official docs, checked 2026-10-29: https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0
- Microsoft Graph driveItem delta, official docs, checked 2026-10-29: https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0
- Google Sheets values API, official docs, checked 2026-10-29: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate
- Google Sheets value render options, official docs, checked 2026-10-29: https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueRenderOption
- Firebase scheduled functions, official docs, checked 2026-10-29: https://firebase.google.com/docs/functions/schedule-functions
- Firebase functions secrets, official docs, checked 2026-10-29: https://firebase.google.com/docs/functions/config-env?gen=2nd
- Firebase Admin SDK setup, official docs, checked 2026-10-29: https://firebase.google.com/docs/admin/setup
