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
| 5 | Synchroniser automatiquement le stock depuis OneDrive | Hors périmètre | dropped |
| 6 | Importer le stock initial depuis Excel | Slice 2 | in-progress |
| 7 | Gérer les articles et positions | Slice 3 | planned |
| 8 | Enregistrer les mouvements de stock | Slice 3 | planned |
| 9 | Réaliser l’inventaire physique | Slice 3 | planned |

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

## Hors périmètre

### 5. Synchroniser automatiquement le stock depuis OneDrive · dropped
La synchronisation via OneDrive et Google Sheets est abandonnée. La saisie du stock se fera dans l’application, avec Firebase comme base de données.

## Slice 2 : Initialisation de la base

### 6. Importer le stock initial depuis Excel · in-progress
Permettre à une personne autorisée d’importer le classeur en plusieurs lots pour initialiser progressivement les positions et les quantités de départ dans Firebase. Excel sert uniquement à préparer et transmettre les lots, sans synchronisation permanente.
**Done when:** chaque lot peut être vérifié avant son import, les erreurs sont visibles et les données acceptées sont enregistrées dans Firebase pour compléter la base initiale.
- [x] Concevoir (spec) : `/architect import initial du stock depuis Excel`
- [ ] Construire : `/develop import initial du stock Excel`
  - [ ] Connecter les droits, le modèle et le premier enregistrement réel (AC-1, AC-2, AC-8, AC-9, AC-10)
  - [x] Valider le classeur et afficher les erreurs avant confirmation (AC-3 à AC-7)
  - [ ] Enregistrer par groupes et gérer concurrence, arrêt et reprise (AC-7 à AC-12)
  - [ ] Ajouter l’historique et l’expiration, préserver les fonctions existantes (AC-1, AC-13, AC-14)
- [ ] Vérifier : `/check verify import initial du stock Excel`
- [ ] Tester : `/test import initial du stock Excel`
Spec [0004](../specs/0004-import-initial-stock-excel.md)
Code dans [index.html](../../index.html) et [stock-import.js](../../stock-import.js). Règles à valider avant publication : [firestore.rules](../../firestore.rules).

## Slice 3 : Gestion du stock dans l’application

### 7. Gérer les articles et positions · needs a decision
Permettre aux personnes autorisées d’ajouter et modifier les articles et positions de stock, puis de désactiver un article sans effacer son historique.
**Done when:** un article peut être ajouté, modifié, désactivé et réactivé sans supprimer ses positions ni ses mouvements historiques.
- [ ] Concevoir la fonctionnalité : `/architect gestion des articles et positions de stock`

### 8. Enregistrer les mouvements de stock · needs a decision
Permettre aux personnes autorisées d’enregistrer les entrées, sorties et transferts entre positions dans l’application. Bloquer une sortie qui ferait passer le stock sous zéro.
**Done when:** chaque mouvement est enregistré et les quantités des positions restent cohérentes, y compris lors d’un transfert et d’une tentative de sortie supérieure au stock disponible.
- [ ] Concevoir la fonctionnalité : `/architect mouvements entrée sortie transfert stock`

### 9. Réaliser l’inventaire physique · needs a decision
Permettre aux personnes autorisées de saisir une quantité comptée et de corriger l’écart entre le stock réel et le stock enregistré.
**Done when:** chaque comptage produit une correction traçable avec l’auteur et la date, et la quantité affichée correspond à la quantité comptée.
- [ ] Concevoir la fonctionnalité : `/architect inventaire physique stock`

## Legend

`existing` signifie que la fonctionnalité était déjà présente avant ce périmètre. `planned` signifie qu’elle reste à concevoir et à réaliser. `in-progress` signifie qu’elle a été conçue et attend sa construction et ses vérifications. `done` signifie que la fonctionnalité a été livrée et vérifiée; tout test automatisé non exécuté est indiqué explicitement.
