---
description: Écrit et exécute les tests d’une fonctionnalité, dérivés des AC
argument-hint: <feature>
---

# /test — Tests

Objectif : prouver le comportement attendu par des tests ou des scénarios
reproductibles, sans affaiblir les exigences. `$ARGUMENTS` désigne la
fonctionnalité.

## Porte d’entrée

1. Lire la spec et ses AC, puis `docs/specs/**/verify.md` s’il existe.
2. Lire `test-preferences.json` et les tests existants du dépôt.
3. Sans spec : s’arrêter et demander `/architect <feature>`.

## Choix de l’outillage

1. Ce dépôt n’a ni build ni framework de test installé : ne pas en ajouter sans
   décision explicite.
2. Si un runner existe déjà, l’utiliser et suivre ses conventions.
3. Sinon, dériver des scénarios exécutables depuis les AC et les consigner dans
   le fichier de vérification, avec les données et le résultat attendu.
4. Un besoin de test automatisé nouveau se tranche dans une spec, pas dans
   `/test`.

## Contenu d’un test

1. Un test par comportement d’AC, nommé par le comportement observé.
2. Couvrir les cas limites réels de la spec : quantité invalide (`#N/A`, texte,
   négatif, décimales), alias de champs, permissions refusées, pagination
   au-delà d’une page, transfert, concurrence, absence de résultat.
3. Tester la non-régression de la connexion, de la recherche, du scan et de
   l’export.
4. Aucune assertion affaiblie, aucun test ignoré pour faire passer la suite.
5. Aucune écriture sur des données de production : utiliser un compte et des
   positions de test approuvés, ou rester en lecture seule.

## Exécution

1. Lancer la suite ou les scénarios concernés, conserver le code de sortie et
   les messages d’échec complets.
2. En cas d’échec, corriger la cause dans le code, puis relancer uniquement le
   test concerné.
3. Consigner honnêtement les tests non exécutables (droits, réseau, compte).

## Mise à jour du périmètre

- Cocher `Tester` dans `docs/scope/scope.md` seulement si les tests des AC ont
  été exécutés avec succès.
- Sinon, lister précisément ce qui reste à exécuter.

## Sortie

- Tests ajoutés, modifiés ou exécutés.
- Résultats, codes de sortie et échecs.
- Couverture des AC et limites.
