# Périmètre : Gestion de stock industriel

Application web de consultation du stock pour les personnes autorisées. Elle utilise déjà Firebase Authentication et Cloud Firestore.

**Build approach:** Tracer Bullet (livrer un parcours complet et réel de l’interface jusqu’aux données).
**Workflow:** Beta (après le développement, vérification puis tests).

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Accès avec authentification | Déjà en place | existing |
| 2 | Rechercher et afficher le stock par article | Déjà en place | in-progress |
| 3 | Lecture des codes barres par caméra | Déjà en place | existing |
| 4 | Exporter les articles en fichier Excel | Slice 1 | in-progress |
| 5 | Synchroniser automatiquement le stock depuis OneDrive | Hors périmètre | dropped |
| 6 | Importer le stock initial depuis Excel | Slice 2 | in-progress |
| 7 | Gérer les articles et positions | Slice 3 | planned |
| 8 | Enregistrer les mouvements de stock | Slice 3 | in-progress |
| 9 | Réaliser l’inventaire physique | Slice 3 | planned |

## Déjà en place

### 1. Accès avec authentification · existing
La connexion Firebase permet aux personnes autorisées d’ouvrir l’application. Les résultats restent masqués avant la connexion.
Code dans `index.html`.

### 2. Rechercher et afficher le stock par article · in-progress
La recherche par code article, code barre ou désignation affiche les résultats dans un tableau, avec une seule ligne par article et le stock total de ses positions autorisées. Les recherches exactes et le scan restent disponibles.
Code dans `index.html`.
**Done when:** chaque article trouvé apparaît sur une seule ligne avec sa désignation, ses codes barres, ses localisations et son stock total, sans résultat partiel présenté comme complet.
- [x] Concevoir la fonctionnalité : `/architect recherche et affichage du stock par article`
- [x] Construire : `/develop recherche et affichage du stock par article`
  - [x] Garder les recherches exactes, le scan et ajouter la recherche par désignation normalisée (AC-1 à AC-5, AC-13)
  - [x] Regrouper toutes les positions autorisées par code article et calculer les champs de chaque ligne (AC-6, AC-8 à AC-10)
  - [x] Afficher le tableau, ses pages et ses états, préserver les permissions et l’usage sur téléphone (AC-7, AC-11, AC-12)
- [ ] Vérifier : `/check verify recherche et affichage du stock par article`
- [ ] Tester : `/test recherche et affichage du stock par article`
Spec [0005](../specs/0005-search-by-designation/index.md)

### 3. Lecture des codes barres par caméra · existing
La caméra peut lire un code barre et lancer la recherche correspondante.
Code dans `index.html`.

## Slice 1 : Export des articles

### 4. Exporter les articles en fichier Excel · in-progress
Exporter les positions de stock accessibles au compte connecté dans un classeur `.xlsx` daté, avec une ligne par article et son stock total. L’export ne modifie pas Firestore et ne remplace ni la recherche ni le scan.
**Done when:** le classeur contient une ligne par article regroupé, ses localisations et son total complet, parcourt toutes les pages au delà de 8 000 positions, et signale clairement les erreurs sans fichier partiel.
- [x] Concevoir la fonctionnalité : `/architect export des articles regroupés`
- [ ] Construire : `/develop export des articles regroupés`
  - [ ] Conserver le bouton, lire toutes les positions autorisées par pages et arrêter sur erreur ou changement de session (AC-1, AC-2, AC-8, AC-9, AC-12)
  - [ ] Regrouper par code article et construire les colonnes, avec les quantités et localisations complètes (AC-3 à AC-5, AC-11)
  - [ ] Créer le classeur `.xlsx`, ses dates, ses feuilles et le cas vide (AC-6, AC-7, AC-10)
  - [ ] Vérifier le regroupement, le volume, les erreurs, les permissions et la non régression de la recherche et du scan (AC-13, AC-14)
- [ ] Vérifier : `/check verify export des articles regroupés`
- [ ] Tester : `/test export des articles regroupés`
Spec [0001](../specs/0001-export-stock-excel.md)

## Hors périmètre

### 5. Synchroniser automatiquement le stock depuis OneDrive · dropped
La synchronisation via OneDrive et Google Sheets est abandonnée. La saisie du stock se fera dans l’application, avec Firebase comme base de données.

## Slice 2 : Initialisation de la base

### 6. Importer le stock initial depuis Excel · in-progress
Permettre à une personne autorisée d’importer le classeur en plusieurs lots pour initialiser progressivement les positions et les quantités de départ dans Firebase. Excel sert uniquement à préparer et transmettre les lots, sans synchronisation permanente.
**Done when:** chaque lot peut être vérifié avant son import, les erreurs sont visibles et les données acceptées sont enregistrées dans Firebase pour compléter la base initiale.
- [x] Concevoir (spec) : `/architect import initial du stock depuis Excel`
- [x] Construire : `/develop import initial du stock Excel`
  - [x] Connecter les droits, le modèle et le premier enregistrement réel (AC-1, AC-2, AC-8, AC-9, AC-10)
  - [x] Valider le classeur et afficher les erreurs avant confirmation (AC-3 à AC-7)
  - [x] Enregistrer par groupes et gérer concurrence, arrêt et reprise (AC-7 à AC-12)
  - [x] Ajouter l’historique et l’expiration, préserver les fonctions existantes (AC-1, AC-13, AC-14)
- [ ] Vérifier : `/check verify import initial du stock Excel`
- [ ] Tester : `/test import initial du stock Excel`
Spec [0004](../specs/0004-import-initial-stock-excel.md)
Code dans [index.html](../../index.html) et [stock-import.js](../../stock-import.js). Règles à valider avant publication : [firestore.rules](../../firestore.rules).

## Slice 3 : Gestion du stock dans l’application

### 7. Gérer les articles et positions · needs a decision
Permettre aux personnes autorisées d’ajouter et modifier les articles et positions de stock, puis de désactiver un article sans effacer son historique.
**Done when:** un article peut être ajouté, modifié, désactivé et réactivé sans supprimer ses positions ni ses mouvements historiques.
- [ ] Concevoir la fonctionnalité : `/architect gestion des articles et positions de stock`

### 8. Enregistrer les mouvements de stock · in-progress
Permettre aux admins d’enregistrer les entrées, sorties et transferts entre positions dans l’application, avec un historique permanent. Bloquer une sortie qui ferait passer le stock sous zéro.
**Done when:** chaque mouvement et les quantités des positions sont liés dans une transaction vérifiée par les règles Firestore, y compris lors d’un transfert et d’une tentative de sortie supérieure au stock disponible.
- [x] Concevoir (spec) : `/architect mouvements entrée sortie transfert stock`
- [x] Construire : `/develop mouvements entrée sortie transfert stock`
  - [x] Vérifier le rôle admin et tester les règles reliant `lastMovementId`, le mouvement et les quantités (AC-1, AC-8, AC-11, AC-14, AC-15)
  - [x] Construire les entrées, sorties et transferts atomiques avec aperçu et validations (AC-2 à AC-10)
  - [x] Ajouter l’historique paginé, les filtres et les corrections inverses (AC-11 à AC-14)
- [ ] Vérifier : `/check verify mouvements entrée sortie transfert stock`
- [ ] Tester : `/test mouvements entrée sortie transfert stock`
Spec [0006](../specs/0006-stock-movements.md)
Code dans [index.html](../../index.html), [stock-movements.js](../../stock-movements.js), [firestore.rules](../../firestore.rules) et [design.md](../../design.md).

### 9. Réaliser l’inventaire physique · needs a decision
Permettre aux personnes autorisées de saisir une quantité comptée et de corriger l’écart entre le stock réel et le stock enregistré.
**Done when:** chaque comptage produit une correction traçable avec l’auteur et la date, et la quantité affichée correspond à la quantité comptée.
- [ ] Concevoir la fonctionnalité : `/architect inventaire physique stock`

## Legend

`existing` signifie que la fonctionnalité était déjà présente avant ce périmètre. `planned` signifie qu’elle reste à concevoir et à réaliser. `in-progress` signifie qu’elle a été conçue et attend sa construction et ses vérifications. `done` signifie que la fonctionnalité a été livrée et vérifiée; tout test automatisé non exécuté est indiqué explicitement.
