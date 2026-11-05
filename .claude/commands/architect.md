---
description: Rédige la spécification d’une fonctionnalité dans docs/specs
argument-hint: <feature>
---

# /architect — Spécification d’une fonctionnalité

Objectif : produire une spec vérifiable avant toute implémentation.
`$ARGUMENTS` désigne la fonctionnalité à concevoir.

## Porte d’entrée

1. Lire `AGENTS.md`, `docs/scope/scope.md` (bloc de la fonctionnalité) et
   `docs/specs/` (numéros, titres, décisions déjà prises).
2. Lire le code concerné : `index.html`, `stock-import.js`, `stock-movements.js`,
   `firebase-config.js`, `firestore.rules`, `design.md`.
3. Si la fonctionnalité manque dans le périmètre, proposer d’abord `/scope`.
4. Si un choix structurant n’est pas tranchable sans l’utilisateur, poser la
   question avant d’écrire la spec : ne pas inventer d’architecture.

## Emplacement

- Numéro suivant : plus grand numéro de `docs/specs/` + 1, sur 4 chiffres.
- Slug court en français, kebab-case, sans accents.
- Spec simple : `docs/specs/NNNN-slug.md`.
- Spec avec options longues ou plusieurs documents : dossier
  `docs/specs/NNNN-slug/` avec `index.md` et `rationale.md`.
  `verify.md` est créé par `/check verify`, pas ici.

## Sections attendues

1. `# NNNN. Titre`, `**Date**: YYYY-MM-DD`, `**Status**: Proposed` puis
   `In Progress` quand la décision est prise.
2. `## Summary` : le comportement ajouté, sans jargon interne.
3. `## Context` : état actuel, contraintes Firebase et sécurité, specs liées.
4. `## Requirements`
   - `**User stories**:` une à trois phrases « En tant que …, je veux … afin de … ».
   - `**Acceptance criteria**:` **AC-1** à **AC-n**. Chaque AC décrit un seul
     comportement observable et testable, sans nom de fonction ni de variable
     d’implémentation.
5. `## Options considered` : deux à quatre options réelles, chacune avec
   **Pros** et **Cons**.
6. `## Decision` : option retenue et ses fondements (code, règles, specs).
7. `## Rationale` : lien vers `rationale.md` si la spec est découpée.
8. `## Feature design` : modèle de données (tableau), transitions d’état,
   surface d’API (tableau action / entrées / résultat / authentification /
   erreurs), provenance des valeurs affichées.
9. `## Out of scope` : ce que la spec ne fait pas.
10. `## Build plan` : ordre Tracer Bullet, du parcours vertical le plus court
    jusqu’aux cas limites, en citant les AC couverts.
11. `## Consequences` : positif, négatif/compromis, neutre.
12. `## Migration plan` : stratégie, phases, rollback, risques (si la donnée
    existante ou les règles Firestore changent).
13. `## Follow-up` : actions restantes, en cases à cocher.
14. `## References` : sources du projet et pratiques appliquées.

## Règles de fond

1. Une ligne par position de stock ; ne jamais agréger silencieusement.
2. Les quantités peuvent être des nombres ou des chaînes : décrire les alias
   réellement présents (`currentqy`, `quantity`, etc.) et le traitement des
   valeurs invalides.
3. Décrire explicitement : permissions Firestore, pagination/lecture complète,
   états de chargement et d’erreur, absence de résultat, non-régression de la
   connexion, de la recherche et du scan.
4. `/architect` ne modifie pas le code applicatif et ne déploie rien.
5. Aucune donnée réelle, aucun secret, aucun identifiant personnel dans la spec.

## Après la spec

- Mettre à jour `docs/scope/scope.md` : `Concevoir (spec)` à `[x]`, statut
  `in-progress`, lien vers la spec.
- Ne pas cocher `Construire`, `Vérifier` ni `Tester`.

## Sortie

- Chemin de la spec créée ou modifiée.
- Liste des AC.
- Décisions ouvertes et hypothèses faites.
