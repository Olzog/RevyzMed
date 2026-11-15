# RevyzMed

Site de révision : fiches de cours remises au propre et questions interactives, par appareil, SEPI et leçon.

## Mise en ligne sur GitHub Pages
1. Glisser **tout le contenu de ce dossier** à la racine du dépôt (`index.html` doit être à la racine).
2. *Settings → Pages* → *Deploy from a branch* → branche `main`, dossier `/ (root)`.
3. Le site est en ligne après 1 à 2 minutes à l'adresse `https://<pseudo>.github.io/<dépôt>/`.

Le site marche aussi en ouvrant simplement `index.html` sur l'ordinateur.

## Contenu
- `index.html`, `assets/` : interface (style, logique, bandeaux photo)
- `data/revyz.js` : fiches et questions
- `lessons/img/` : figures des leçons · `lessons/q/` : schémas à légender · `lessons/pages/` : pages des PDF (extraits affichés dans les corrections)

## Fonctions
- Fiche de cours par leçon (sommaire, figures zoomables), recherche dans les fiches et les questions
- 7 types de questions : QCM, QCU, remise en ordre, classement, relier, texte à trous, schéma à légender (glisser-déposer ou toucher)
- Correction : vert plein = coché et juste, rouge plein = coché mais faux, contour vert pointillé = juste oublié, contour rouge = faux non coché ; justifications et capture de la leçon
- Entraînement (reprise où on s'est arrêté, accès direct à n'importe quelle question), test aléatoire (chrono optionnel), « Revoir mes erreurs », statistiques
- Mode jour / nuit et 8 couleurs ; progression enregistrée dans le navigateur

Photos des bandeaux : Unsplash (licence Unsplash, usage libre).
