---
description: Crée ou met à jour le périmètre produit dans docs/scope/scope.md
argument-hint: <feature ou changement de périmètre>
---

# /scope — Périmètre produit

Objectif : tenir `docs/scope/scope.md` comme la source unique des fonctionnalités,
de leur statut et de leur avancement.

## Lecture obligatoire

1. `AGENTS.md` (stack, build approach, règles).
2. `docs/scope/scope.md` existant et `docs/specs/` (numéros et titres).
3. `git log --oneline -10` et le code concerné si la demande touche l’existant.
4. `design.md` pour le vocabulaire d’interface.

## Structure à conserver

1. Titre `# Périmètre : <produit>` + résumé en deux phrases.
2. `**Build approach:**` et `**Workflow:**` repris de `AGENTS.md`.
3. `## At a glance` : tableau `| # | Feature | Phase | Status |`.
4. Une section par slice (`## Slice N : ...`) avec les fonctionnalités.
5. `## Hors périmètre` pour les fonctionnalités abandonnées.
6. `## Legend` avec le vocabulaire des statuts.

## Statuts autorisés

`existing`, `planned`, `in-progress`, `needs a decision`, `dropped`, `done`.

## Bloc d’une fonctionnalité

```markdown
### 7. Titre de la fonctionnalité · status
Une ou deux phrases sur le besoin et le résultat attendu.
**Done when:** critère observable et complet.
- [ ] Concevoir (spec) : `/architect <feature>`
- [ ] Construire : `/develop <feature>`
  - [ ] Sous-étape livrable (AC-1, AC-2)
- [ ] Vérifier : `/check verify <feature>`
- [ ] Tester : `/test <feature>`
Spec [NNNN](../specs/NNNN-slug.md)
Code dans [`index.html`](../../index.html).
```

## Règles

1. Numéroter les fonctionnalités de façon stable : ne jamais renuméroter un
   identifiant déjà utilisé.
2. `[x]` seulement pour un travail réellement fait dans le code ou la spec.
   `Concevoir` passe à `[x]` quand la spec existe, `Construire` seulement quand
   le code est livré, `Vérifier` et `Tester` seulement quand ils ont été exécutés.
3. Ne jamais supprimer une fonctionnalité `done` : la déplacer ou la marquer
   `dropped` avec la raison.
4. Une fonctionnalité sortie du périmètre va dans `## Hors périmètre` avec une
   phrase d’explication.
5. Ne pas inventer de décision d’architecture. Si un choix est nécessaire, mettre
   `needs a decision` et écrire la question à trancher.
6. Garder le tableau `At a glance` cohérent avec les sections.
7. Rédiger en français.

## Sortie

- Diff résumé de `docs/scope/scope.md`.
- Fonctionnalités ajoutées, retirées ou changées de statut.
- Décisions ouvertes, s’il y en a.
