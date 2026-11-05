# Verify: recherche et affichage du stock par article · spec 0005 · updated 2026-11-04

_Étapes dérivées des critères d’acceptation de la spécification 0005._

## UI / manual

- [ ] Se connecter, chercher un code article avec une seule position et vérifier que sa quantité s’affiche directement, sans regroupement. Chercher un article avec des positions sur plusieurs adresses et vérifier une ligne avec leur somme. → AC-1, AC-2, AC-6, AC-10
- [ ] Chercher un code barre stocké comme texte, puis comme tableau. Vérifier une seule ligne par article avec toutes ses positions. Scanner ensuite un code barre et vérifier que le champ est toujours rempli et la recherche lancée. → AC-1, AC-2, AC-6, AC-8, AC-9, AC-13
- [ ] Chercher un fragment d’au moins trois caractères avec une casse et des accents différents. Essayer les champs `designation`, `name`, `articleName` et `description`, puis vérifier la priorité de l’article exact. → AC-2, AC-3, AC-4
- [ ] Trouver un article par désignation et vérifier que les positions ayant plusieurs adresses sont réunies, y compris celles dont la désignation ne correspond pas. Vérifier que les positions d’une seule adresse restent séparées, et que deux documents sans code article restent sur deux lignes. → AC-5, AC-6
- [ ] Vérifier que la désignation vient du premier document par identifiant et du premier alias non vide. Vérifier les codes barres distincts sans astérisques, les adresses distinctes dans l’ordre des documents, le séparateur « + », l’absence du magasin et de la division, et le libellé « Adresse non renseignée ». → AC-8, AC-9
- [ ] Vérifier les colonnes du tableau, l’absence de quantité initiale et de date d’inventaire, ainsi que le défilement horizontal sur téléphone. → AC-7
- [ ] Vérifier les alias de quantité actuelle avec zéro, des nombres valides à deux décimales, des chaînes valides, un nombre à plus de deux décimales, une chaîne à plus de 15 chiffres significatifs et une valeur absente. Vérifier qu’un alias invalide est ignoré si un alias suivant est valide, par exemple `currentqy: "#N/A"` et `quantity: 4`, et que « Incomplet » apparaît seulement si aucun alias n’est valide. → AC-10
- [ ] Chercher assez de positions pour obtenir plus de 500 documents lus et plus de 20 articles. Vérifier la lecture complète, les pages de 20 lignes, le tri par code article, l’ordre des lignes sans code et le nombre d’articles annoncé. → AC-5, AC-11
- [ ] Vérifier les états de chargement, aucun résultat et saisie trop courte. Provoquer un refus de lecture, y compris sur une requête de code barre, et vérifier qu’aucun résultat partiel n’est affiché. → AC-3, AC-5, AC-12
- [ ] Confirmer avec un compte autorisé que seules les positions permises par Firestore apparaissent, qu’aucune donnée n’est modifiée et que la recherche par code article, la recherche par code barre et le scan fonctionnent toujours. → AC-1, AC-12, AC-13

## Commands

- [ ] `git diff --check` → aucune erreur d’espacement dans les changements.

## Acceptance-criteria coverage

AC-1: étapes 1, 2 et 10 · AC-2: étapes 1, 2 et 3 · AC-3: étapes 3 et 9 · AC-4: étape 3 · AC-5: étapes 4, 8 et 9 · AC-6: étapes 1, 2 et 4 · AC-7: étape 6 · AC-8: étapes 2 et 5 · AC-9: étapes 2 et 5 · AC-10: étapes 1 et 7 · AC-11: étape 8 · AC-12: étapes 9 et 10 · AC-13: étapes 2 et 10
