# Bibliothèque de commandes

Commandes du workflow de ce dépôt. Elles suivent les conventions décrites dans
`AGENTS.md` et `docs/scope/scope.md`.

| Commande | Rôle | Sortie |
|---|---|---|
| `/audit` | Auditer le dépôt | `AGENTS.md` à jour |
| `/scope <feature>` | Cadrer le périmètre produit | `docs/scope/scope.md` |
| `/architect <feature>` | Concevoir une fonctionnalité | `docs/specs/NNNN-*` |
| `/develop <feature>` | Construire la fonctionnalité en Tracer Bullet | code + cases `Construire` |
| `/check verify <feature>` | Vérifier les critères d’acceptation | `verify.md` |
| `/test <feature>` | Tester la fonctionnalité | tests et résultats |

## Enchaînement

1. `/scope` fige le besoin et son statut.
2. `/architect` écrit la spec et ses AC.
3. `/develop` livre le parcours complet.
4. `/check verify` produit le plan de vérification.
5. `/test` prouve le comportement et clôt la fonctionnalité.

## Règles communes

- Français, phrases courtes, une ligne par position de stock.
- Aucun secret, aucune donnée réelle dans la documentation.
- Aucune écriture Firestore dans un parcours de lecture.
- Une case n’est cochée que si le travail a réellement été fait et vérifié.
