---
description: Audite le dépôt et met à jour AGENTS.md avec des faits vérifiés
argument-hint: (aucun argument)
---

# /audit — Audit du dépôt

Objectif : garder `AGENTS.md` court, factuel et à jour, pour que tous les agents
travaillent avec le bon contexte.

## Lecture obligatoire

1. `AGENTS.md`, `CLAUDE.md`, `design.md`.
2. `docs/scope/scope.md` et la liste de `docs/specs/`.
3. `git log --oneline -15`, `git status --short`, la liste des fichiers réels.
4. Le code concerné par les affirmations de `AGENTS.md` (`index.html`,
   `firebase-config.js`, `stock-import.js`, `stock-movements.js`, `firestore.rules`).

## Étapes

1. Comparer chaque affirmation de `AGENTS.md` au code et à l’historique Git.
2. Corriger ce qui est faux ou obsolète, ajouter ce qui est vérifié et utile.
3. Conserver les sections existantes : Stack, Build approach, Git, Project map,
   Known data conventions, Rules for work in this repo, Commands and local checks,
   Skills, Context files.
4. Documenter uniquement :
   - la stack et les fichiers réellement présents ;
   - les conventions de données observées dans le code ;
   - les règles de travail et de sécurité déjà appliquées ;
   - les commandes de vérification qui fonctionnent réellement.
5. Ne pas inventer d’architecture, de script ou de dépendance.
6. Ne pas supprimer une règle existante sans preuve qu’elle est fausse.
7. Aucun secret, token ou clé privée dans le fichier.
8. Rédiger en français, au présent, en phrases courtes.
9. Terminer le fichier par `Drafted by: /audit`.

## Interdits

- Modifier le code applicatif : `/audit` ne touche que la documentation.
- Déduire une convention depuis un seul cas isolé.
- Recopier de longs extraits de code dans `AGENTS.md`.

## Sortie

- Liste des sections modifiées et de la raison.
- Points restés incertains ou à trancher par une décision.
