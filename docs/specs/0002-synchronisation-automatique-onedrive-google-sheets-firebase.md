# 0002. Synchroniser automatiquement le stock depuis OneDrive vers Google Sheets puis Firebase

**Date**: 2026-10-28
**Status**: Proposed

## Summary

Cette décision ajoute une synchronisation automatique du stock sans re-saisir manuellement les données. Le fichier OneDrive devient la source de mise à jour, une feuille Google Sheets agit comme zone de staging, et une commande backend lit cette feuille pour mettre à jour la collection Firestore `stockPositions` de façon sûre et idempotente.

Le flux garde les données existantes lorsque le classeur ne contient plus une position, refusera les doublons ambigus, et n’écrira pas dans Firestore si le mapping ou les règles de validation ne sont pas cohérents. La préparation finale du mapping exact des colonnes du classeur doit être confirmée une fois le fichier réellement accessible.

## Context

L’application existante est une page web statique en HTML, CSS et JavaScript, avec Firebase Authentication et Cloud Firestore. Elle lit déjà la collection `stockPositions` pour les recherches et le scan par code barre. La base contient une ligne par position de stock, avec des champs comme `articlecode`, `storename`, `divisionname`, `address`, `quantity`, `currentqy`, `barcode` ou `barcodes`, et la logique d’interface dépend de cette structure.

Le besoin métier est d’éviter la mise à jour manuelle depuis un classeur Excel partagé par OneDrive. Le classeur peut contenir plusieurs feuilles et des formules. Le projet ne dispose pas de backend applicatif dédié, donc le bon point d’intégration est un flux de synchronisation externe qui lit le classeur, le transforme, puis applique les mises à jour dans Firestore avec une clé stable.

La décision clé est de conserver le flux à sens unique. OneDrive est la source d’entrée, Google Sheets est un miroir de staging, et Firebase est la base de vérité de l’application. Cela évite d’écrire dans le classeur depuis l’application, tout en gardant un journal de données exploitable pour valider ou déboguer les changements.

## Requirements

**User stories**:
- En tant que gestionnaire de stock, je veux synchroniser automatiquement les mises à jour du classeur OneDrive vers Firebase afin d’éviter les saisies manuelles et les écarts de données.
- En tant qu’utilisateur autorisé, je veux que les positions du stock restent cohérentes dans l’application sans risque de doublons ou de suppression accidentelle.
- En tant qu’administrateur, je veux recevoir un signal clair lorsque la synchronisation échoue ou que le fichier source est ambigu.

**Acceptance criteria**:
- **AC-1**: le flux de synchronisation est déclenché lorsqu’une modification du classeur OneDrive est détectée, ou par un contrôle planifié équivalent si le déclenchement direct n’est pas possible.
- **AC-2**: les valeurs calculées du classeur sont importées au résultat calculé, pas au texte de la formule, et la structure du mapping est documentée.
- **AC-3**: Google Sheets agit comme zone de staging et conserve une copie exploitable des valeurs envoyées depuis OneDrive pour validation et reprise.
- **AC-4**: chaque position de stock est identifiée par la clé de mise à jour suivante, dans l’ordre de priorité : `articlecode + storename + divisionname + address`, avec la division traitée comme un identifiant de position lorsque la donnée est présente.
- **AC-5**: le processus de synchronisation refuse les doublons ambigus sur cette clé et ne publie pas de mauvaise mise à jour dans Firestore.
- **AC-6**: lorsque le classeur ne contient plus une position existante dans Firebase, la synchronisation ne la supprime ni ne la désactive par défaut ; elle garde la position existante et traite l’absence comme un changement non impactant.
- **AC-7**: les lignes avec quantité nulle sont exclues de la synchronisation par défaut, pour distinguer `0` d’une donnée absente et éviter de créer des positions artificielles.
- **AC-8**: les mises à jour Firebase sont idempotentes et ne créent pas de doublons si le même lot est relancé.
- **AC-9**: les erreurs de mapping, de validation, de lecture Google Sheets ou de Firestore sont consignées et remontées à un mécanisme de signalement clair.
- **AC-10**: la synchronisation garde les données déjà présentes dans Firestore tant que le flux source n’est pas valide, et ne présente pas une synchronisation partielle comme réussie.

## Options considered

### Option 1: OneDrive direct vers Firebase

Dans cette option, le classeur OneDrive est lu directement par un job backend qui transforme les lignes et les envoie vers Firestore sans passer par Google Sheets.

**Pros**:
- moins d’étapes dans le flux
- plus simple à raisonner au début

**Cons**:
- le transfert direct depuis OneDrive est plus fragile pour la validation, le journal de données et le contrôle de version
- les formules et les feuilles multiples sont plus difficiles à traiter sans une couche de staging
- on perd la possibilité de valider le contenu avant l’écriture dans Firestore

### Option 2: OneDrive vers Google Sheets puis Firebase, architecture recommandée

Dans cette option, le classeur est copié ou transformé vers une feuille Google Sheets. La feuille devient une zone de staging de validation, puis un job Firebase lit cette feuille et applique les mises à jour à `stockPositions`.

**Pros**:
- la feuille sert de tampon de vérification et de journal
- le mapping et les erreurs sont plus faciles à diagnostiquer
- le flux reste à sens unique et sécurisé
- on peut gérer les doublons, les absences et les volumes importants plus proprement

**Cons**:
- l’architecture a un peu plus d’étapes
- il faut gérer les permissions Google Sheets et le déclenchement de mise à jour
- il faut prévoir un mécanisme de contrôle d’erreurs et de reprise

### Option 3: Écrire directement dans Firestore depuis le fichier Excel dans le navigateur

Dans cette option, l’application web lit le fichier Excel au navigateur et écrit directement dans Firebase.

**Pros**:
- très simple du point de vue de l’interface
- aucun service backend supplémentaire

**Cons**:
- la logique de sécurité, les règles d’authentification et les autorisations de publication doivent être gérées côté client
- les secrets et les identifiants ne doivent pas être exposés dans le navigateur
- l’approche est fragile pour des classeurs volumineux ou mal formés
- elle casse le principe de source unique surveillée et de validation préalable

## Decision

**Chosen option**: Option 2: OneDrive vers Google Sheets puis Firebase

Le flux doit rester à sens unique, sûr et traçable : le classeur OneDrive est la source de données, la feuille Google Sheets sert de zone de staging, et un backend Firebase lit les lignes valides pour mettre à jour `stockPositions`. Cette conception garde la logique d’écriture hors du navigateur et évite d’exposer des secrets ou des autorisations d’écriture dans le client web.

## Rationale

Le projet est une application statique avec Firebase déjà en place. Le plus faible risque de sécurité et de maintenance n’est pas d’ajouter une écriture directe depuis le navigateur, mais d’isoler l’intégration de données dans un flux dédié. Google Sheets sert de point de contrôle parce qu’il permet de stocker une copie lisible des valeurs du classeur, de valider les colonnes et les formules calculées, et de faciliter les reprises après un échec.

Le choix de la clé `articlecode + storename + divisionname + address` suit la règle métier déjà définie dans le projet : une position de stock doit être distinguée par son lieu, son magasin et son emplacement, pas seulement par un article. La clé de mise à jour doit rester stable pour éviter les doublons et pour ne pas mélanger plusieurs emplacements d’un même article.

Les décisions de conservation des lignes absentes et d’exclusion des quantités nulles sont importantes. Le flux ne doit pas effacer des données existantes simplement parce qu’un classeur n’a plus une ligne, et il ne faut pas confondre une quantité nulle avec un champ absent. Cela évite les suppressions accidentelles de stock et les fausses créations de positions.

## Feature design

**Data model sketch**:
- `stockPositions` est la collection cible dans Firestore ; une ligne représente une position de stock, pas un article agrégé.
- Champs importants déjà utilisés par l’application : `articlecode`, `storename`, `divisionname`, `address`, `quantity`, `currentqy`, `dateinventaire`, `inventorydate`, `barcodes` et éventuellement `barcode`.
- La clé stable de synchronisation est composée de `articlecode`, `storename`, `divisionname` et `address`.
- Une ligne de staging Google Sheets contient au moins : `articlecode`, `storename`, `divisionname`, `address`, `quantity`, `dateinventaire`, `source_row_id`, `sync_status` et le marquage d’erreur.
- Un mapping de colonnes doit relier les colonnes du classeur source aux champs de la collection cible, avec une validation appliquée avant le write dans Firestore.
- Les doublons identiques sur la clé stable déclenchent une erreur de synchronisation et bloquent le lot concerné.

**State transitions**:
- `pending import` → `validated` → `ready for Firestore` → `updated` ou `rejected`
- `rejected` lorsqu’un doublon ambigue, un mapping invalide, un mauvais type de donnée ou une règle métier non respectée est détecté.

**API surface**:
| Endpoint / Job | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| OneDrive change trigger | event | workbook metadata, changed sheet range | sheet change event | service account / trigger auth | 401, 404, no change |
| Google Sheets staging sync | scheduled or trigger | sheet rows, mapping configuration | staged rows, validation report | Google service account | invalid headers, parse error |
| Firestore upsert job | batch write | validated rows, match key, normalized values | updated counts, rejected rows | Firebase Admin SDK | duplicate key, write failed, timeout |
| Error report | callback / notification | failed batch, row IDs, reasons | logs, alert payload | admin identity or service account | missing alert channel |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| OneDrive change detection | changed row list | OneDrive change event or polling job |
| Google Sheets staging | imported values | mapped sheet columns from workbook |
| Firestore matching | unique position key | `articlecode + storename + divisionname + address` |
| Stock update in Firestore | `quantity` | computed cell result from the workbook, not formula text |
| Rejection signal | reason for failure | validation rules and duplicate detection |
| Audit log | last sync timestamp | sync job execution time |

**Key invariants**:
- Aucune écriture dans Firestore ne doit être faite sans un mapping de colonnes validé.
- Le même identifiant de position ne peut pas apparaître deux fois dans un même lot de synchronisation.
- Une ligne avec quantité nulle est exclue de la synchronisation, sauf si une règle explicite de source la remplace.
- Une position absente du classeur n’est pas supprimée par défaut.
- La synchronisation ne peut pas présenter une mise à jour partielle comme réussie.

**Security model**:
- Les identifiants OneDrive, Google et Firebase sont gérés via comptes de service ou secrets de runtime, jamais dans le code du client web.
- Les utilisateurs du site gardent leur accès de lecture existant à Firestore ; la synchronisation backend s’exécute avec des permissions d’administration dédiées et ne dépend pas du compte navigateur de l’utilisateur.
- La feuille Google Sheets sert uniquement de zone de staging et n’est pas exposée à des utilisateurs finaux non autorisés.
- Les rules Firestore existantes doivent être respectées et le backend ne doit écrire que sur les données autorisées par le service d’intégration.

**Configuration required**:
- `ONE_DRIVE_WEBHOOK_URL`: endpoint déclenché lorsqu’un classeur est modifié, ou l’URL de polling planifié si le webhook n’est pas disponible.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: identifiant de service pour accéder à Google Sheets et à Google Drive.
- `GOOGLE_SHEET_ID`: identifiant de la feuille de staging utilisée pour le mirroring du classeur.
- `FIREBASE_PROJECT_ID`: identifiant du projet Firebase cible.
- `SYNC_MAP_CONFIG`: configuration du mapping exact des colonnes du classeur vers le schéma Firestore.
- `SYNC_ALERT_WEBHOOK`: canal de signalement pour les erreurs de lot ou les doublons.

**Critical test scenarios**:
- Happy path: un changement du classeur OneDrive déclenche le mirroring dans Google Sheets, puis le job Firestore met à jour les positions concernées, vérifie **AC-1**, **AC-3**, **AC-4**.
- Failure case: un doublon ambigue sur la clé de position bloque le lot et remet un message clair, vérifie **AC-5**, **AC-9**.
- Missing data case: une position présente dans Firebase mais absent du classeur n’est ni supprimée ni désactivée, vérifie **AC-6**.
- Zero quantity case: une ligne avec quantité nulle n’est pas importée dans Firestore, vérifie **AC-7**.
- Retry case: relancer le même lot ne crée pas de doublons ni de mises à jour incohérentes, vérifie **AC-8**, **AC-10**.

## Build plan

1. Créer le schéma de mapping du classeur source vers les champs `stockPositions` et documenter les règles de validation, satisfait **AC-2**, **AC-4**, **AC-7**.
2. Mettre en place le déclenchement OneDrive ou la synchronisation planifiée vers la feuille Google Sheets, satisfait **AC-1**, **AC-3**.
3. Construire la feuille de staging Google Sheets avec les colonnes de validation, le statut et le journal d’erreurs, satisfait **AC-3**, **AC-9**.
4. Implémenter le job backend de lecture Google Sheets, normalisation des valeurs et détection des doublons, satisfait **AC-4**, **AC-5**, **AC-8**, **AC-10**.
5. Implémenter les upserts Firestore avec une logique de gardien de données, sans suppression implicite, satisfait **AC-6**, **AC-8**, **AC-10**.
6. Ajouter des logs, alertes et messages de reprise pour les lots rejetés, satisfait **AC-9**.
7. Vérifier le volume de données, le relancement et les cas limites de stock nul et de positions manquantes, satisfait **AC-7**, **AC-10**.

## Consequences

**Positive**:
- la mise à jour du stock devient fiable et moins manuelle
- le flux garde un journal de staging pour vérifier les valeurs avant leur écriture
- les doublons et les données ambiguës sont refusés avant d’atteindre Firestore

**Negative / tradeoffs**:
- la solution demande un service backend ou un job de synchronisation externe
- le mapping des colonnes du classeur doit être maintenu en fonction du fichier source
- le flux est plus compliqué qu’une simple import depuis le navigateur

**Neutral**:
- le projet conserve son architecture statique actuelle et ajoute une intégration de données concentrée autour de Firebase et de Google Sheets
- l’interface web reste lisible et n’est pas modifiée pour écrire directement dans la base

## Follow-up

- [ ] Recevoir le classeur OneDrive ou un export téléchargeable pour confirmer le mapping réel des colonnes et les feuilles à lire.
- [ ] Valider la feuille de staging Google Sheets et les permissions de compte de service.
- [ ] Choisir l’outil de déclenchement automatique exact : webhook OneDrive, planification Google, ou un job de polling.
- [ ] Préparer le plan de notification des erreurs et des lots rejetés pour les opérations de production.

## References

- `AGENTS.md` (projet web statique, Firebase Authentication, Firestore et collection `stockPositions`)
- `docs/scope/scope.md` (périmètre d’export et de synchronisation de stock)
- `index.html` (lecture des données de `stockPositions` et usage actuel des champs)
- fichier OneDrive fourni par l’utilisateur, non accessible dans cet environnement, donc la confirmation finale du mapping exige le classeur réel ou un export téléchargeable
