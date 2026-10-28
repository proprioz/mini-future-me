---
name: portraits
description: Boucle d'amélioration du scan du visage — compare le perso que le scan construit (pnpm portraits) et celui que décrit chaque fiche.md (pnpm apercu) avec les photos de test de public/portraits (face, profils, dos), analyse et juge le résultat, corrige le scan ou le rendu et vérifie qu'il n'y a pas de régression, en tenant un journal. À utiliser pour « compare les persos aux portraits », « améliore le scan », après un changement de src/scan/ ou src/character/, quand le hook signale une passe pas encore analysée, quand l'utilisateur apporte de nouvelles photos de portraits, ou quand un trait vu sur les photos manque au jeu.
---

# Portraits de test

`public/portraits/Personne_NN/` contient des personnes **fictives** (générées par IA, ignorées par git : chacun·e
fournit les siennes, voir `public/portraits/README.txt`), 4 vues chacune :
`01_face.jpg`, `02_profil_gauche.jpg` (la personne regarde vers la gauche de l'image), `03_profil_droit.jpg`,
`04_dos.jpg`, en 600×800, et `fiche.md` : ce qu'on voit sur les photos (forme du visage et des yeux, coupe,
barbe, tenue, accessoires…), ramené aux options du jeu. La vérité terrain que le score vérifie est dans
`tools/playwright/portraits.ts` ; elle doit rester d'accord avec les fiches.

Le jeu n'a que des **options courantes** chez les gens en Suisse et des **couleurs principales** (AGENTS.md) :
un trait rare sur une photo (turban, vitiligo, moustache fine, barbe très longue…) n'est pas un défaut du
jeu, il s'attend comme l'option la plus proche, dans la fiche comme dans la vérité terrain.

## Lancer

```bash
pnpm portraits              # toutes les personnes, ≈ 10 s
pnpm portraits 3 7 21       # seulement celles-ci (plus rapide pendant un réglage)
pnpm portraits --vue body   # corps entier (le haut se juge mieux) ; --taille 300 pour plus de détails
```

Pas besoin du MCP Playwright ni de `pnpm dev` : le script lance son Vite et un Edge caché. Il affiche une ligne
par personne (✓, ✗ avec les champs faux, ou « pas de vérité terrain »), le score, puis **ce qui a changé depuis
la passe précédente**. Dans `.playwright-mcp/comparaisons/` : `Personne_NN.png` (les 4 photos au-dessus du perso
sous les mêmes angles, écarts en rouge), `resultats.json` (look complet de chaque personne), `index.html` (la
galerie pour l'utilisateur ; lancé depuis Claude, le script ne l'ouvre pas : ajouter `--ouvrir` s'il veut la
voir). `resultats.json` contient aussi les **mesures** brutes de chaque personne (`measures` : lunettes, barbe,
cheveux, profils, couleur du haut avant le choix dans la palette) : c'est là qu'on voit pourquoi un choix est
faux. Chaque passe s'ajoute à `.playwright-mcp/portraits-historique.jsonl`. Le script tourne sans
rechargement de Vite : une sauvegarde de fichier pendant la passe (autre session) ne l'interrompt pas.

Le score compte aussi comme écart (`genre`) un look qui mélange des options codées pour les deux genres :
le jeu ne doit jamais le faire de lui-même (seul « Au hasard » mélange).

```bash
pnpm apercu                 # le perso décrit par chaque fiche.md, à côté des 4 photos (sans scan)
pnpm apercu 16 25 --vue body
```

`pnpm apercu` juge le **rendu** seul (le jeu sait-il dessiner ce que dit la fiche, et à quel point ça
ressemble ?), `pnpm portraits` juge le **scan**. Images dans `.playwright-mcp/apercu/`. Il signale une fiche
qui cite une option ou une couleur disparue du jeu : la ramener à la plus proche.

## Analyser (après chaque passe, la sienne ou celle de l'utilisateur)

Le hook `.claude/hooks/portraits-a-analyser.js` signale une passe lancée dans un terminal et pas encore analysée.

1. Lire `docs/portraits-journal.md` (leçons, problèmes ouverts) et la sortie de la passe ; si l'utilisateur
   l'a lancée lui-même, `resultats.json` et les deux dernières lignes de l'historique donnent le score et les
   changements.
2. Lire avec Read les images des personnes en ✗ et de celles qui ont changé ; après un changement du rendu du
   perso, les lire toutes. Juger chaque angle, pas seulement la face :
   - **face** : lunettes (forme, couleur), barbe et moustache, frange, couleur des yeux et du teint ;
   - **profils** : volume et longueur des cheveux derrière, oreilles cachées ou non, nez, barbe sur la joue,
     visière de la casquette du bon côté ;
   - **dos** : longueur des cheveux (épaules, chignon, queue), couvre-chef, couleur du haut.
3. Ne pas s'arrêter au score : il ne voit que les champs de la vérité terrain. Noter aussi ce qui est faux à
   l'œil (tenue, couleur de la barbe, teint, coupe mal rendue, ressemblance générale), y compris chez les ✓.
4. **S'auto-évaluer** : pour chaque écart, dire d'où il vient — mesure du scan (`src/scan/`), choix de l'option
   (`classify.ts`), rendu du perso (`src/character/`), option absente du jeu, ou vérité terrain discutable.
5. Écrire `.playwright-mcp/portraits-analyse.md` (score, essais, écarts et leur cause probable, ce que
   l'utilisateur doit trancher, prochaine piste ; Markdown simple : titres, listes, gras), puis lancer
   `pnpm portraits --galerie` : l'analyse s'affiche en haut de la galerie de l'utilisateur, et le fichier
   marque la passe comme analysée pour le hook. Mettre à jour les problèmes ouverts du journal, et y ajouter
   une entrée si la passe suit un changement de code.
6. Résumer à l'utilisateur en quelques lignes : score, ce qui a progressé ou régressé, le problème le plus
   important et la piste proposée.

## Améliorer (quand l'utilisateur le demande : « améliore », « corrige », « lance la boucle »)

Jusqu'à 3 essais par demande, puis faire le point avec l'utilisateur.

1. Choisir dans les problèmes ouverts celui qui touche le plus de personnes ou se voit le plus, et qui n'a pas
   déjà échoué (journal). Regarder les mesures (`measures`) des personnes touchées et de celles qui vont bien,
   puis formuler une hypothèse **générale**, qu'on peut expliquer sans nommer une personne. Si c'est un réglage,
   le tester d'abord hors ligne sur les mesures de toutes les personnes (petit script dans le scratchpad).
2. Avant de modifier un fichier, le copier dans `.playwright-mcp/sauvegardes/` : l'arbre git contient du travail
   non commité de l'utilisateur, donc **jamais** `git checkout`, `git restore`, `git stash` ni `git reset` pour
   annuler un essai. D'autres sessions peuvent modifier les mêmes fichiers : annuler par un Edit inverse
   plutôt qu'en recopiant la sauvegarde, et dire aux sessions qui le demandent sur quels fichiers on travaille.
3. Faire le changement le plus petit possible, relancer **toutes** les personnes, puis analyser comme ci-dessus.
4. Garder seulement si le score ne baisse pas et qu'aucune personne ne régresse (✓ → ✗, ou nouvel écart visible
   à l'œil) ; sinon remettre les copies de sauvegarde et relancer pour vérifier qu'on est revenu au score d'avant.
5. Noter l'essai dans le journal, gardé ou annulé, avec la raison : un échec documenté évite de le refaire.
6. Ne jamais modifier la vérité terrain pour faire passer le score. Si elle semble fausse, le dire à
   l'utilisateur avec l'image à l'appui, et ne la changer qu'avec son accord.
7. Ne rien commiter sans qu'on le demande. Vérifier aussi le jeu lui-même quand le changement touche le rendu
   (AGENTS.md : MCP Playwright sur Edge).

## Un trait absent du jeu

Avant d'ajouter une option, se demander si le trait est **courant chez les gens en Suisse** et vraisemblable.
Sinon, ne rien ajouter : l'écrire dans la fiche et la vérité terrain comme l'option la plus proche. Si oui
(et si l'utilisateur est d'accord), la faire passer par toute la chaîne :

1. `options.ts` : l'option, codée `f`, `m` ou neutre (avec `alt` pour l'autre genre) ; préférer adapter une
   option existante plutôt qu'en ajouter une proche.
2. Le rendu (`src/character/`), comparé aux photos sous les 4 angles avec `pnpm apercu` après avoir écrit
   la fiche, puis vérifié dans « Crée ton perso » (MCP Playwright sur Edge).
3. `population.ts` : sa fréquence par genre et âge (source en tête du fichier), puis `pnpm profils`.
4. `classify.ts` : sa vraisemblance d'après les mesures, si le scan peut la voir ; sinon la fréquence
   décide (le dire dans le commentaire). Tester la règle hors ligne sur les mesures de `resultats.json`.
5. Vérité terrain, fiches concernées, `PLAN.fr.md` et `PLAN.md` (décision « Personnage »), puis `pnpm portraits` sans
   régression ni look mélangé.

## Améliorer la méthode

Quand l'analyse révèle un angle mort (un défaut que ni le score ni la grille ci-dessus ne repèrent), corriger
l'outil plutôt que de compter sur sa mémoire : ajouter le champ à vérifier dans `check()` et la vérité terrain
(`portraits.ts`, avec l'accord de l'utilisateur pour les nouvelles valeurs), compléter la grille d'analyse de ce
skill, ou ajouter une leçon au journal. Le dire à l'utilisateur.

## Ajouter une personne

1. Prendre le prochain numéro libre et créer `public/portraits/Personne_NN/` avec les 4 vues sous les noms
   ci-dessus. Si les photos arrivent en planche (les 4 vues côte à côte) ou dans un autre format, les découper
   et les ramener en 600×800 (portrait 3:4, tête centrée) ; `sips` suffit pour recadrer puis redimensionner :
   `sips -c <hauteur> <largeur> in.jpg --out out.jpg` (recadrage centré) puis `sips -z 800 600 out.jpg`.
   Vérifier avec `sips -g pixelWidth -g pixelHeight`.
2. Regarder les 4 photos (Read), écrire sa `fiche.md` sur le modèle des autres (un tableau avec l'option du
   jeu et son id entre accents graves pour chaque trait, puis les observations), puis ajouter la ligne de
   la personne dans `PEOPLE` et `PRESENTATION` de
   `tools/playwright/portraits.ts`, avec un commentaire court si une valeur demande d'interpréter la photo :
   - ids des options de `src/character/options.ts` (`hairStyle`, `glasses`, `beard`, `mustache`, `headwear`) ;
   - couleurs (`hair`, `top`) avec les noms de `HAIR_NAMES` / `CLOTH_NAMES` de `src/scan/classify.ts`, au
     singulier ou en dernier mot (`'noir'`, `'châtain'`, `'marine'`) ;
   - une liste quand plusieurs options sont acceptables (photo ambiguë pour nos coupes chibi, option rare
     absente du jeu : voir l'en-tête de `portraits.ts`), `'any'` pour une coupe cachée, `'-'` pour une
     couleur invisible ;
   - `PRESENTATION` : `'F'` ou `'M'` selon ce que montre la photo (sert à vérifier l'estimation du genre apparent).
3. Optionnel : la refaire à la main dans `PEOPLE` de `tools/playwright/people.ts` (même ordre que les dossiers),
   pour vérifier que le jeu sait la reproduire.
4. Mettre à jour le nombre de personnes dans `public/portraits/README.txt`.
5. Lancer `pnpm apercu NN` (le jeu sait-il la dessiner ?), puis `pnpm portraits NN`, puis toutes les
   personnes pour donner le nouveau score global.

Uniquement des visages générés ou de personnes qui ont donné leur accord, **jamais** de photos prises sur
le stand : aucune image de visiteur ne doit être stockée (AGENTS.md).
