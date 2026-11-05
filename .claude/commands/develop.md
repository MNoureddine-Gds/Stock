---
description: Implémente une fonctionnalité déjà spécifiée, en Tracer Bullet
argument-hint: <feature>
---

# /develop — Construction

Objectif : livrer un parcours réel et complet de l’interface jusqu’aux données,
conforme à la spec. `$ARGUMENTS` désigne la fonctionnalité.

## Porte d’entrée

1. Lire la spec liée depuis `docs/scope/scope.md` et ses AC.
2. Sans spec : s’arrêter et demander `/architect <feature>`.
3. Relire `AGENTS.md` et `design.md` avant de toucher l’interface.

## Méthode

1. Tracer Bullet : relier d’abord le parcours le plus court de bout en bout
   (écran → lecture/écriture Firestore autorisée → affichage du résultat réel).
2. Élargir ensuite aux cas limites de la spec, dans l’ordre du `Build plan`.
3. Implémenter uniquement les AC de la spec. Ne pas ajouter de fonctionnalité,
   de dépendance ou de refonte non demandée.
4. Conserver le style existant : HTML/CSS/JS sans build, cartes, en-tête,
   boutons principaux bleus, états de chargement, vide et erreur visibles.

## Contraintes du dépôt

1. La connexion, la recherche et le scan caméra doivent continuer de fonctionner.
2. Aucune écriture Firestore dans un parcours de lecture (export, recherche).
3. Les lectures complètes se font par pages ou par lots, sans troncature
   silencieuse.
4. Respecter `firestore.rules` et les permissions du compte connecté.
5. Aucun secret, token ou clé privée dans le code, les logs ou les fichiers.
6. Toute évolution des règles Firestore ou des index est signalée : elle devra
   être déployée et vérifiée avant d’être considérée comme active.

## Vérification minimale

1. `git diff --check`.
2. Servir le dossier localement et exercer le parcours avec un compte autorisé.
3. Vérifier les AC touchés et la non-régression de la connexion, de la recherche
   et du scan.
4. Ne jamais présenter un contrôle non exécuté comme réussi ; dire ce qui reste
   manuel ou bloqué.

## Mise à jour du périmètre

- Cocher les sous-étapes `Construire` réellement livrées, avec leurs AC.
- Cocher `Construire` seulement quand tous les AC de construction sont livrés.
- Ne pas cocher `Vérifier` ni `Tester` : ce sont `/check verify` et `/test`.

## Sortie

- Fichiers modifiés et comportement ajouté.
- AC couverts, AC restants.
- Contrôles exécutés, résultats et limites.
