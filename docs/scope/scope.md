# Périmètre : Gestion de stock industriel

Application web de consultation du stock pour les personnes autorisées. Elle utilise déjà Firebase Authentication et Cloud Firestore.

**Build approach:** Tracer Bullet (livrer un parcours complet et réel de l’interface jusqu’aux données).
**Workflow:** Beta (après le développement, vérification puis tests).

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Accès avec authentification | Déjà en place | existing |
| 2 | Recherche et consultation des positions de stock | Déjà en place | existing |
| 3 | Lecture des codes barres par caméra | Déjà en place | existing |
| 4 | Exporter les articles en fichier Excel | Slice 1 | done |
| 5 | Synchroniser automatiquement le stock depuis OneDrive | Slice 2 | in-progress |

## Déjà en place

### 1. Accès avec authentification · existing
La connexion Firebase permet aux personnes autorisées d’ouvrir l’application. Les résultats restent masqués avant la connexion.
Code dans `index.html`.

### 2. Recherche et consultation des positions de stock · existing
La recherche par code article ou code barre lit les positions dans `stockPositions` et affiche les informations de chaque position.
Code dans `index.html`.

### 3. Lecture des codes barres par caméra · existing
La caméra peut lire un code barre et lancer la recherche correspondante.
Code dans `index.html`.

## Slice 1 : Export des articles

### 4. Exporter les articles en fichier Excel · done
Ajouter à la page principale un export des positions de stock accessibles à la personne connectée, sans modifier les données ni remplacer la recherche et la lecture des codes barres.
**Done when:** le fichier `.xlsx` daté contient une ligne par position autorisée, les colonnes demandées et les valeurs nulles ou absentes correctement distinguées; toutes les pages sont parcourues même au delà de 8 000 articles; les erreurs sont signalées clairement et les fonctions existantes restent utilisables.
- [x] Concevoir la fonctionnalité : `/architect export stock`
- [x] Construire : `/develop export stock`
  - [x] Vérifier les règles Firestore et la source SheetJS (AC-2, AC-9)
  - [x] Ajouter le bouton et le premier téléchargement réel (AC-1, AC-4, AC-5, AC-8)
  - [x] Paginer toutes les positions et créer les feuilles Excel (AC-2, AC-3, AC-6, AC-7)
  - [x] Gérer les erreurs, les sessions et les valeurs manquantes (AC-5, AC-9, AC-10, AC-11, AC-12)
  - [x] Vérifier le volume et préserver recherche et scan (AC-13, AC-14)
- [x] Vérifier : `/check verify export stock`
- [ ] Tester : `/test export stock`
  - Tests automatisés non exécutés, acceptés par l’utilisateur.
Spec [0001](../specs/0001-export-stock-excel.md)

## Slice 2 : Synchronisation automatique

### 5. Synchroniser automatiquement le stock depuis OneDrive · needs a decision
Quand le classeur de stock change sur OneDrive, transmettre automatiquement ses données vers Google Sheets puis Firebase, afin d’éviter la mise à jour manuelle. Le classeur contient plusieurs feuilles et des formules; ses colonnes et règles de synchronisation restent à examiner avec le fichier accessible.
**Done when:** un changement de classeur déclenche le flux vers Google Sheets puis Firebase; les positions existantes sont mises à jour et les nouvelles ajoutées sans doublons; les erreurs sont signalées sans présenter une synchronisation incomplète comme réussie.
- [x] Concevoir la fonctionnalité : `/architect synchronisation automatique OneDrive Google Sheets Firebase`
- [ ] Construire : `/develop synchronisation stock`
  - [ ] Confirmer le classeur, ses colonnes, ses formules et le mapping Firestore
  - [ ] Choisir et configurer le déclenchement et le backend de synchronisation
  - [ ] Mettre en place le staging Google Sheets et les mises à jour Firestore
  - [ ] Vérifier les doublons, les erreurs, les reprises et les volumes
- [ ] Vérifier : `/check verify synchronisation stock`
- [ ] Tester : `/test synchronisation stock`
Spec [0002](../specs/0002-synchronisation-automatique-onedrive-google-sheets-firebase.md)

## Legend

`existing` signifie que la fonctionnalité était déjà présente avant ce périmètre. `planned` signifie qu’elle reste à concevoir et à réaliser. `in-progress` signifie qu’elle a été conçue et attend sa construction et ses vérifications. `done` signifie que la fonctionnalité a été livrée et vérifiée; tout test automatisé non exécuté est indiqué explicitement.
