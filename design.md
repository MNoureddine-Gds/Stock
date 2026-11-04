---
name: stock-design-system
source: extracted-from-code
character: "Une interface claire et pratique pour le suivi du stock industriel. La hiérarchie s’appuie sur un bleu profond, des actions bleues bien visibles et des cartes blanches sur un fond bleu gris très léger."
tokens: "Les valeurs réelles sont dans les styles de index.html, ne pas les recopier ici."
contrast: "Contrastes mesurés : texte courant 15.01:1, titre sur en-tête 11.37:1, texte sur action principale 5.77:1, texte secondaire 5.82:1, bordure de champ 3.84:1."
---

## Build mandate

Chaque écran doit sembler complet et cohérent avec l’application. Utiliser des titres précis, une hiérarchie claire, des cartes utiles, et des états visibles pour le chargement, les erreurs et les listes vides.

## Character & direction

Le produit privilégie la lisibilité et la confiance plutôt que la décoration. L’en-tête bleu foncé identifie l’application, les actions principales ressortent en bleu, et les informations sont regroupées dans des cartes simples.

## Composition patterns

L’application utilise un en-tête commun et une colonne de contenu centrée. Les formulaires et résultats sont présentés dans des cartes. Les détails d’une position utilisent une grille qui se replie selon la largeur disponible. Les listes larges restent parcourables sur téléphone.

## Component & usage rules

Réserver le bouton bleu aux actions principales. Utiliser les boutons clairs pour les actions secondaires et le rouge pâle pour les actions dangereuses. Garder les cartes blanches avec des coins arrondis et une ombre discrète. Grouper les champs avec leurs libellés, puis afficher les erreurs et confirmations à proximité sous forme de statut.

## Responsive & accessibility direction

Conserver une colonne lisible sur ordinateur et empiler les contenus sur téléphone. Les commandes restent assez grandes pour être touchées. Utiliser des libellés persistants, des titres ordonnés et des messages de statut accessibles. L’interface existante ne définit pas de thème sombre.
