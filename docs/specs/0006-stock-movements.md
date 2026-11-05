# 0006. Enregistrer les mouvements de stock

**Date**: 2026-11-02
**Status**: In Progress

## Summary

Cette proposition ajoute une page pour enregistrer les entrées, sorties et transferts de stock. Chaque opération garde une trace permanente et change les quantités ensemble dans Firebase, sans effacer l’historique. Seuls les comptes admin peuvent enregistrer des mouvements ou consulter leur historique.

## Context

L’application utilise une page web en HTML, CSS et JavaScript, Firebase Authentication et Cloud Firestore. Le stock est enregistré par position dans `stockPositions`. Les positions existantes contiennent des formats de quantité hétérogènes, et certaines peuvent avoir une quantité actuelle invalide.

Les règles Firestore actuelles protègent les positions contre les modifications depuis le client. Les mouvements doivent donc ajouter un historique traçable et autoriser une mise à jour très limitée de `currentqy`, sans permettre de modifier les autres champs d’une position ni de supprimer son historique.

Cette fonctionnalité touche deux décisions indépendantes mais liées à l’usage quotidien du stock. La recherche par désignation est spécifiée séparément dans [0005](0005-search-by-designation/index.md) et sera réutilisée pour trouver les positions.

## Requirements

**User stories**:
- En tant qu’admin, je veux enregistrer une entrée, une sortie ou un transfert afin que le stock actuel reflète le mouvement réel.
- En tant qu’admin, je veux consulter l’historique et corriger une opération sans effacer sa trace.
- En tant qu’utilisateur connecté sans rôle admin, je veux continuer à consulter le stock sans pouvoir modifier les quantités.

**Acceptance criteria**:
- **AC-1**: Un onglet Mouvements est disponible uniquement à un utilisateur connecté dont `authorizedUsers/{UID}.role` vaut `admin`. Les comptes sans ce rôle ne voient pas l’onglet. Les règles Firestore appliquent la même autorisation indépendamment de l’interface.
- **AC-2**: L’onglet contient une vue Nouvelle opération et une vue Historique. Il est utilisable sur ordinateur, tablette et téléphone, dans le style existant.
- **AC-3**: Une nouvelle opération est une entrée, une sortie ou un transfert. Le formulaire permet de chercher une position par code article, code barre ou désignation, et réutilise le scan caméra existant pour saisir un code barre.
- **AC-4**: Une entrée porte sur une position existante. Une sortie porte sur une position existante. Un transfert porte sur deux positions existantes du même article et ne peut pas cibler la même position.
- **AC-5**: La quantité saisie est un nombre positif, fini, avec au plus deux décimales. Une quantité zéro ou négative est refusée. Une note facultative est limitée à 500 caractères.
- **AC-6**: Avant écriture, l’application montre un résumé de l’opération, les positions concernées, la quantité, les quantités avant et après calculées, et la note. Aucune écriture n’a lieu avant confirmation explicite.
- **AC-7**: Une position ne peut être utilisée que si `currentqy` existe et est un nombre valide, ou une chaîne décimale convertible (point ou virgule, au plus deux décimales, au plus quinze chiffres significatifs). Une chaîne convertible est transformée en nombre avant le calcul, et le premier mouvement l’enregistre comme nombre. Une valeur texte non numérique telle que `#N/A` bloque l’opération et demande une correction administrative. Aucune quantité n’est devinée depuis `initialqy`.
- **AC-8**: Une confirmation crée un document dans `stockMovements` et met à jour les `currentqy` concernés ainsi que leur `lastMovementId` dans une seule transaction Firestore. Pour chaque position modifiée, `lastMovementId` correspond à l’identifiant du nouveau mouvement. Une entrée augmente le stock, une sortie le diminue, et un transfert diminue la source et augmente la destination. `initialqy` et les autres champs de position restent inchangés.
- **AC-9**: Une sortie ou un transfert qui ferait passer la position source sous zéro est refusé avec la quantité disponible. Aucune partie de l’opération n’est enregistrée.
- **AC-10**: Une opération concurrente est recalculée par la transaction avec les valeurs actuelles. La transaction échoue clairement si la nouvelle quantité ne permet plus l’opération. Une opération non confirmée par le serveur n’est pas mise en attente hors connexion.
- **AC-11**: Un mouvement conserve le type, la quantité, les identifiants des positions, une copie de leurs données d’identité, les quantités avant et après, l’UID et l’adresse e mail disponible de l’auteur, la date Firebase et la note facultative. Le transfert tient dans un seul document. Les documents ne sont jamais modifiés ou supprimés.
- **AC-12**: Une correction est une opération inverse complète liée au mouvement d’origine. Un mouvement d’origine ne peut être inversé qu’une fois. Si l’inverse ferait passer une quantité sous zéro, l’application le bloque et demande une vérification admin.
- **AC-13**: L’historique est visible uniquement aux admins, trié du plus récent au plus ancien et parcourable par pages de 20. Il propose des filtres par type, période, code article exact, code barre exact et fragment de désignation sans distinction de casse ou d’accents. Un fragment de désignation exige une période. Les jours de début et de fin sont interprétés dans le fuseau local du navigateur.
- **AC-14**: L’historique est conservé sans expiration automatique. Toute erreur de permission ou de réseau est montrée clairement. Après un résultat réseau incertain, l’application demande de vérifier l’historique avant de réessayer.
- **AC-15**: Les règles Firestore refusent toute mise à jour de `currentqy` sans création, dans la même transaction, d’un nouveau mouvement dont l’identifiant est celui de `lastMovementId`. Elles refusent aussi la création d’un mouvement sans mise à jour de toutes ses positions. Elles vérifient le type, les positions et les quantités avant et après. Une correction doit inverser exactement le mouvement d’origine et garder son identifiant déterministe. Les règles refusent un marqueur absent ou incorrect, la modification d’autres champs de position, et la modification ou la suppression d’un mouvement existant.

## Options considered

### Option 1: Ajouter un registre immuable et mettre à jour le stock dans une transaction

Chaque opération crée un mouvement permanent et met à jour `currentqy` en même temps.

**Pros**:
- Chaque changement reste consultable et attribuable.
- Le transfert peut changer deux positions atomiquement.
- Une correction inverse l’opération sans réécrire l’historique.

**Cons**:
- Les règles Firestore et les transactions sont plus exigeantes.
- Les quantités historiques invalides doivent être corrigées avant usage.

### Option 2: Modifier seulement les quantités

L’application met à jour la position sans créer de registre.

**Pros**:
- Moins de données et de contrôles.
- Formulaire plus rapide à construire.

**Cons**:
- L’origine d’une variation n’est pas traçable.
- Une erreur ou un transfert est difficile à auditer et corriger.

### Option 3: Recalculer le stock uniquement depuis les mouvements

L’application conserve les mouvements et calcule le stock en additionnant tout l’historique.

**Pros**:
- Le registre est la seule source du stock actuel.

**Cons**:
- Les anciennes positions n’ont pas d’historique complet.
- Chaque lecture de stock devient plus complexe et coûteuse.

### Option 4: Exécuter les mouvements dans une fonction serveur Firebase

Une fonction serveur valide le rôle et les données, puis écrit le mouvement et les positions dans une transaction. Les règles refusent les mises à jour de stock venant directement du navigateur.

**Pros**:
- La validation des opérations est centralisée côté serveur.
- Les positions n’ont pas besoin du champ `lastMovementId`.
- Les règles clientes restent plus simples, car seul le serveur peut modifier le stock.

**Cons**:
- Il faut déployer et exploiter un service serveur en plus de l’application statique.
- Le traitement, les erreurs et la surveillance du serveur deviennent nécessaires pour enregistrer un mouvement.

## Decision

**Chosen option**: Option 1: Ajouter un registre immuable et mettre à jour le stock dans une transaction.

Pour lier le registre aux quantités, chaque position modifiée reçoit aussi `lastMovementId`, l’identifiant du mouvement créé dans la même transaction. Les règles Firestore utilisent ce marqueur et les données après transaction pour vérifier que le mouvement, les positions et les soldes concordent. Les règles réservent ces écritures aux admins, sans ajouter la fonction serveur de l’option 4.

## Rationale

Le stock existe déjà par position et doit rester consultable avec les règles actuelles. Un registre permanent rend les changements compréhensibles sans remplacer les données existantes par un recalcul incomplet. Comme l’application écrit directement dans Firestore et qu’aucun serveur n’est prévu, un marqueur vérifiable par les règles relie chaque variation au mouvement de la transaction, sans ajouter de service à exploiter. Les règles n’acceptent que les changements de `currentqy` et de `lastMovementId`, et comparent les soldes avant et après au mouvement. Pour les positions héritées dont `currentqy` est une chaîne décimale, la fonction `balanceMatches` autorise la conversion en nombre lors du premier mouvement, sans vérifier l’égalité numérique de la valeur stockée puisque les règles ne savent pas convertir une virgule décimale; les mouvements suivants retrouvent la vérification numérique stricte. Les transactions empêchent de perdre un changement concurrent ou de valider un transfert partiel. Cette liaison rend les règles plus complexes qu’une fonction serveur dédiée.

## Feature design

**Data model sketch**:

| Entité | Identifiant | Champs principaux | Relations |
|---|---|---|---|
| Position existante, `stockPositions` | Identifiant du document | `currentqy` numérique, `lastMovementId` facultatif, identité et détails déjà présents | Une position peut participer à plusieurs mouvements; le marqueur désigne son mouvement le plus récent |
| Mouvement, `stockMovements` | Identifiant du document créé avant la transaction | `type`, `quantity`, `createdAt`, `actorUid`, `actorEmail`, `note`, `fromPositionId`, `toPositionId`, quantités avant et après, snapshots des positions | Entrée utilise une destination, sortie une source, transfert les deux |
| Snapshot de position | Identifiant de position conservé dans le mouvement | Code article, désignation, codes barres, magasin, division et emplacement au moment de l’opération | Un pour chaque position concernée |
| Correction | `reversesMovementId` dans le nouveau mouvement | Type inverse, quantité inverse et snapshots correspondants | Au plus une correction complète par mouvement d’origine |
| Autorisation admin existante, `authorizedUsers` | UID Firebase | `role: admin` | L’auteur est l’utilisateur connecté |

Les champs d’un mouvement sont définis ainsi:

| Champ | Type | Présence |
|---|---|---|
| `type` | Texte parmi `entry`, `exit`, `transfer`, `reversal` | Obligatoire |
| `quantity` | Nombre fini supérieur à zéro, deux décimales au plus | Obligatoire |
| `createdAt` | Horodatage Firebase côté serveur | Obligatoire |
| `actorUid` | Texte | Obligatoire |
| `actorEmail` | Texte | Facultatif si Firebase ne fournit pas d’adresse |
| `note` | Texte de 500 caractères au plus | Facultatif |
| `fromPositionId`, `fromPosition` | Texte et copie de position | Obligatoires pour `exit`, `transfer`, `reversal` d’une entrée et `reversal` d’un transfert |
| `toPositionId`, `toPosition` | Texte et copie de position | Obligatoires pour `entry`, `transfer`, `reversal` d’une sortie et `reversal` d’un transfert |
| `fromBefore`, `fromAfter` | Nombres finis non négatifs | Présents avec la position source |
| `toBefore`, `toAfter` | Nombres finis non négatifs | Présents avec la position destination |
| `reversesMovementId`, `reversesType` | Texte et type d’origine | Obligatoires seulement pour `reversal` |

Une copie de position contient `articlecode`, `storename`, `divisionname` et `address` comme textes obligatoires. `designation` est facultatif. `barcodes` est facultatif et conserve la forme texte ou tableau présente dans le document. Les champs sans objet pour le type de mouvement sont omis, pas écrits à `null`. Les champs de quantité avant et après sont numériques. L’identifiant d’une correction est `reversal_<identifiant du mouvement d’origine>`, ce qui empêche deux corrections concurrentes. `lastMovementId` est absent des positions existantes et importées jusqu’à leur premier mouvement; aucune migration des positions n’est nécessaire.

L’inverse d’une entrée est une sortie de la position d’origine. L’inverse d’une sortie est une entrée vers la position d’origine. L’inverse d’un transfert échange les positions de départ et d’arrivée.

**State transitions**:

Un mouvement confirmé est immuable. Il n’a pas d’état modifiable. Une correction crée un nouveau mouvement inverse et laisse le mouvement original intact. Une transaction non validée ne crée aucune partie du mouvement.

**API surface**:

| Action | Type | Entrées principales | Résultat principal | Authentification | Erreurs importantes |
|---|---|---|---|---|---|
| Vérifier le rôle | Lecture Firestore | UID Firebase courant | Accès admin ou refus | Compte connecté | Rôle absent ou lecture refusée |
| Chercher une position | Lectures de `stockPositions` | Code, code barre ou désignation | Positions accessibles à sélectionner | Admin connecté | Erreur de lecture ou aucun résultat |
| Scanner une position | Scan caméra existant | Code barre lu | Positions correspondantes à sélectionner | Admin connecté, navigateur compatible | Permission caméra, code non trouvé |
| Confirmer un mouvement | Transaction Firestore | Type, quantité, positions, note, identité de session | ID du mouvement et nouveaux soldes | Admin connecté | Quantité invalide, solde invalide, stock insuffisant, conflit, permission ou réseau |
| Lire l’historique | Lecture Firestore paginée | Curseur, filtres de type, période et article | Jusqu’à 20 mouvements triés par date | Admin connecté | Permission, index ou réseau |
| Annuler un mouvement | Transaction Firestore | ID du mouvement d’origine | Mouvement inverse lié et nouveaux soldes | Admin connecté | Déjà annulé, stock insuffisant, solde invalide ou conflit |

**Value sourcing**:

| Action | Valeur produite ou affichée | Source |
|---|---|---|
| Accorder l’accès | Rôle admin | `authorizedUsers/{auth.currentUser.uid}.role` |
| Identifier l’auteur | UID et adresse e mail disponible | Session Firebase courante |
| Choisir une position | Données de position affichées | `stockPositions` visible au compte |
| Lire le solde de départ | `currentqy` numérique | Document de position sélectionné |
| Valider une quantité | Nombre positif et deux décimales au plus | Champ quantité du formulaire |
| Calculer le solde après une entrée | Solde après | Solde avant plus quantité saisie |
| Calculer le solde après une sortie | Solde après | Solde avant moins quantité saisie |
| Calculer un transfert | Soldes source et destination après | Soldes avant et quantité saisie |
| Conserver l’identité de position | Copie des champs identitaires et informatifs | Document Firestore au moment de la transaction |
| Dater le mouvement | Horodatage d’enregistrement | Horodatage serveur Firebase |
| Filtrer la période | Début et fin en horodatages | Dates saisies, interprétées dans le fuseau local du navigateur |
| Filtrer par désignation | Correspondance partielle normalisée | Désignation conservée dans le snapshot et période sélectionnée |
| Identifier une correction | ID de l’opération d’origine et ID inverse stable | Mouvement sélectionné dans l’historique |

**Key invariants**:

1. Le client et les règles Firestore exigent un rôle admin pour chaque écriture de mouvement et lecture d’historique.
2. Les changements de position et l’enregistrement du mouvement sont atomiques et réciproquement liés dans la même transaction. Les règles vérifient le lien avec `lastMovementId`, les positions concernées et leurs soldes avant et après.
3. Une transaction ne modifie sur les positions que `currentqy` et `lastMovementId`; elle ne modifie jamais `initialqy`, `quantity` ou l’identité de la position.
4. Les quantités sont finies, numériques, positives pour le mouvement, et les soldes résultants ne sont jamais négatifs.
5. Une position dont `currentqy` n’est pas numérique est bloquée, sans remplacement par `initialqy`.
6. Un transfert concerne le même article et deux positions différentes.
7. Les mouvements sont immuables et ne sont jamais supprimés.
8. Une correction inverse la totalité de l’opération et ne peut être créée qu’une fois.
9. Une perte de réseau ne crée aucune reprise automatique.

**Security model**:

Les règles vérifient `authorizedUsers/{UID}.role == 'admin'`. La documentation doit confirmer que l’ID du document correspond bien au UID. Les utilisateurs connectés conservent leurs lectures autorisées du stock, mais seuls les admins peuvent lire `stockMovements`.

Les règles refusent la modification et la suppression de `stockMovements`. Pour chaque position mise à jour, elles autorisent uniquement les changements de `currentqy` et `lastMovementId`. Le marqueur doit désigner un nouveau document `stockMovements` créé dans la même transaction. À l’aide de l’état après transaction, les règles vérifient que l’auteur est l’admin connecté, que le type et les identifiants de positions correspondent, que les soldes avant concordent avec les documents existants, et que les soldes après respectent le calcul du mouvement. La création du mouvement vérifie aussi que chacune de ses positions est bien mise à jour dans la transaction et porte ce marqueur. Pour un transfert, les deux positions doivent être liées au même mouvement et leurs changements doivent être cohérents. Pour une correction, l’identifiant déterministe `reversal_<identifiant du mouvement d’origine>` interdit une seconde correction; les règles vérifient aussi que le mouvement inverse correspond exactement à l’opération d’origine. Les règles refusent tout solde négatif. Les règles d’import initial gardent leur accès de création séparé. Le marqueur peut être absent avant le premier mouvement, afin que les positions importées et existantes n’aient pas à être réécrites.

**Configuration required**:

- Une définition d’index Firestore peut être requise pour l’ordre et la période de l’historique. Le déploiement doit fournir les index signalés par Firebase avant l’activation de l’écran.
- L’identifiant du document admin doit être le UID Firebase pour la vérification des règles.

**Critical test scenarios**:

- Un admin confirme une entrée, une sortie et un transfert. Chaque mouvement, chaque solde et chaque marqueur sont enregistrés ensemble, vérifie **AC-1** à **AC-8**, **AC-11**.
- Une sortie supérieure au stock, une quantité nulle, une quantité à plus de deux décimales et un `currentqy` texte non numérique sont refusés sans écriture, vérifie **AC-5**, **AC-7**, **AC-9**.
- Deux transactions concurrentes recalculent le solde actuel et aucune quantité n’est perdue, vérifie **AC-8**, **AC-10**.
- Un compte non admin ne voit pas l’onglet et les règles refusent une écriture directe, vérifie **AC-1**, **AC-14**.
- Les règles refusent une mise à jour directe de quantité, un mouvement sans mise à jour des positions correspondantes, un marqueur absent ou incorrect, un mouvement dont les positions ou les calculs ne correspondent pas, une modification ou suppression de mouvement, et un transfert dont une seule position est liée, vérifie **AC-8**, **AC-15**.
- Un transfert vers un autre article, la même position ou une position absente est refusé, vérifie **AC-4**.
- Une correction complète est créée une fois. Une correction qui rendrait le stock négatif est refusée, vérifie **AC-12**.
- L’historique est paginé, filtrable, et garde les détails snapshots après changement des données de position, vérifie **AC-11**, **AC-13**, **AC-14**.
- Une perte de réseau ne rejoue pas le mouvement. L’historique permet de vérifier si le serveur l’a accepté, vérifie **AC-10**, **AC-14**.

## Build plan

Le projet suit une approche Tracer Bullet. Le premier parcours doit relier le formulaire, l’autorisation, la transaction et la position réelle avant d’élargir aux transferts, corrections et filtres d’historique.

1. Vérifier l’ID UID du document admin et écrire les tests de règles pour les accès permis et refusés, sans ouvrir d’écriture générale sur les positions, satisfait **AC-1**, **AC-14**, **AC-15**.
2. Ajouter le modèle de mouvement et les règles qui lient par `lastMovementId` un document immuable aux seules mises à jour permises de `currentqy` et du marqueur, satisfait **AC-8**, **AC-11**, **AC-15**.
3. Construire le parcours vertical entrée avec sélection de position, validation, aperçu, confirmation et transaction, satisfait **AC-2** à **AC-10**.
4. Ajouter sortie et transfert atomique entre positions du même article, satisfait **AC-3** à **AC-10**.
5. Ajouter l’historique paginé, ses filtres, les snapshots, les corrections complètes et le traitement des erreurs réseau, satisfait **AC-11** à **AC-14**.
6. Vérifier les fonctions existantes, le scan, les permissions, le mobile, les index et les scénarios concurrents avant publication, satisfait **AC-1** à **AC-14**.

## Consequences

**Positive**:
- Chaque variation de stock a une trace permanente, attribuée à un compte.
- Les transferts et corrections ne laissent pas un seul côté du changement enregistré.
- Les personnes sans rôle admin gardent la consultation sans droit d’écriture.

**Negative / tradeoffs**:
- Les règles et transactions doivent vérifier le marqueur et chaque quantité liée, ce qui les rend plus complexes qu’une modification directe ou qu’une fonction serveur dédiée.
- Les quantités historiques invalides doivent être corrigées par un admin avant un mouvement.
- L’historique sans expiration augmente continuellement le volume et les coûts de lecture et stockage.
- Les corrections ne peuvent être faites qu’une fois et peuvent être bloquées si le stock a changé.

**Neutral**:
- `initialqy` reste la quantité de départ et ne change pas après les mouvements.
- Les documents de mouvement conservent une copie des détails de position, même si la position change ensuite.

## Follow-up

- [ ] Vérifier que les documents `authorizedUsers` des admins ont leur UID comme ID avant de configurer les règles.
- [ ] Déployer et vérifier les règles et les index Firestore avant d’activer l’écran.
- [ ] Déterminer une politique d’archivage ou de coût si l’historique devient volumineux.

## References

**Project sources**:
- `AGENTS.md`, conventions Firebase, sécurité et données par position.
- `docs/scope/scope.md`, exigences de gestion et de mouvements du stock.
- `index.html`, recherche, scan et affichage actuels.
- `firestore.rules`, règles actuelles de lecture et d’import.
- [0005](0005-search-by-designation/index.md), recherche réutilisée pour sélectionner les positions.

**Practices & standards**:
- Registre immuable pour garder la trace des changements de stock.
- Transactions atomiques et vérification de solde lors d’opérations concurrentes.
- Moindre privilège pour les règles d’accès.
- Correction par opération inverse plutôt que réécriture de l’historique.

## Migration plan

**Strategy**: Déploiement progressif avec accès limité au rôle admin.

**Phases**:
1. Vérifier les documents admin, préparer les règles et les index Firestore, puis les valider avant d’activer l’interface. Les anciennes positions restent valides sans `lastMovementId` jusqu’à leur premier mouvement.
2. Déployer l’interface admin et tester les lectures, une entrée, une sortie et un transfert sur des positions de test autorisées.
3. Ouvrir les opérations aux admins confirmés après validation des règles et des résultats.

**Rollback**: Masquer ou retirer l’onglet et remettre les règles à un état qui refuse les nouvelles opérations. Ne pas supprimer les documents de mouvement déjà créés. Les transactions déjà confirmées restent la trace du stock et doivent être corrigées par un mouvement inverse.

**Risks**: Une règle trop permissive pourrait autoriser une variation non liée à un mouvement. Une règle trop stricte pourrait refuser les transactions valides. Une erreur d’identification du document admin pourrait bloquer les admins ou autoriser le mauvais compte. Les index manquants peuvent faire échouer certains filtres.
