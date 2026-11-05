---
description: Vérifie une fonctionnalité contre ses critères d’acceptation
argument-hint: verify <feature>
---

# /check — Vérification

Objectif : produire et exécuter un plan de vérification dérivé des AC de la spec.
`$ARGUMENTS` commence par `verify` suivi de la fonctionnalité.

## Porte d’entrée

1. Retrouver la spec via `docs/scope/scope.md` et lire tous ses AC.
2. Lire le code livré : `index.html`, `stock-*.js`, `firestore.rules`.
3. Si la construction n’est pas terminée, l’indiquer et vérifier seulement ce
   qui est livré.

## Fichier `verify.md`

- Spec en dossier : `docs/specs/NNNN-slug/verify.md`.
- Spec en fichier unique : `docs/specs/NNNN-slug.verify.md`.
- En-tête :
  `# Verify: <feature> · spec NNNN · updated YYYY-MM-DD`
  puis `_Étapes dérivées des critères d’acceptation de la spécification NNNN._`

Sections obligatoires :

1. `## UI / manual` : une case par scénario, avec les valeurs à essayer et la
   référence `→ AC-n` en fin de ligne.
2. `## Commands` : commandes réellement exécutables (`git diff --check`,
   serveur local, etc.), une case chacune.
3. `## Acceptance-criteria coverage` : une ligne
   `AC-1: étapes 1, 2 · AC-2: étape 3 · …` couvrant tous les AC.

## Règles

1. Chaque AC de la spec doit être couvert par au moins une étape.
2. Les étapes décrivent une action observable et le résultat attendu, pas une
   fonction interne.
3. Couvrir explicitement : permissions refusées, erreurs réseau, états vides,
   pagination et volumes, données invalides, non-régression.
4. `/check` est en lecture seule : aucune écriture Firestore, aucune donnée
   réelle modifiée, aucun déploiement.
5. `/check` ne corrige pas le code : consigner l’échec, puis renvoyer vers
   `/develop` pour la correction.
6. Ne cocher une étape que si elle a réellement été exécutée avec le résultat
   attendu. Sinon laisser vide et expliquer pourquoi.
7. Ne cocher `Vérifier` dans `docs/scope/scope.md` que si tous les AC sont
   vérifiés sans échec.

## Sortie

- Chemin du fichier de vérification.
- Étapes exécutées, réussies et échouées.
- AC non couverts ou vérifications impossibles (compte, données, règles).
