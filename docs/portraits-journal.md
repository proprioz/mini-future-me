# Journal des portraits

Mémoire de la boucle d'amélioration du scan (skill `.claude/skills/portraits`) : à relire avant chaque
essai, pour ne pas retenter une piste qui a déjà échoué. Le détail de chaque passe (personne par
personne, mesures comprises) est dans `.playwright-mcp/`, qui n'est pas versionné.

## Leçons

Ce que les essais ont appris, valable au-delà d'une seule personne.

- Le score ne voit que les champs de la vérité terrain (coupe, couvre-chef, couleur des cheveux, lunettes,
  barbe, moustache, couleur du haut) : la tenue, la couleur de la barbe et des montures, le teint et la
  ressemblance générale ne se jugent qu'à l'œil, sur les images.
- Une vérité terrain qui accepte plusieurs coupes (ou `'any'` sous un couvre-chef) laisse passer des
  rendus visiblement faux : relire aussi les personnes en ✓.
- L'analyse est déterministe (deux passes de suite donnent le même résultat) : tout changement de score
  vient du code.
- Diagnostiquer sur les **mesures** (`measures` dans `resultats.json`) avant de toucher un seuil : la couleur
  du haut était bien mesurée, c'est le choix dans la palette qui se trompait.
- Tester une idée de réglage **hors ligne** sur les mesures des 40 personnes (petit script qui rejoue la
  fonction de choix) avant de l'écrire dans le code : plusieurs variantes en une seconde.
- Les couvre-chefs (turban, casquette, foulard) sont segmentés « accessoire », comme une monture, et
  descendent sur les tempes : une mesure de lunettes doit regarder là où un couvre-chef ne va jamais (le pont
  du nez).
- Une règle de barbe ou de moustache basée sur « plus foncé que la peau » ne voit pas le blanc ni le gris
  clair : penser au cas clair chaque fois.
- La luminosité seule ne sépare pas une barbe grise courte d'un menton sans barbe (0,09–0,10 contre jusqu'à
  0,16 chez un enfant ou une femme) : ne pas baisser ce seuil.
- Le jeu n'a que des options courantes et des couleurs principales (CLAUDE.md) : un trait rare sur une photo
  s'attend comme l'option la plus proche, ce n'est pas un écart à corriger en ajoutant une option.
- Avec une palette courte, une couleur mesurée doit prendre la **plus proche** : vraisemblance rapportée à la
  couleur la plus proche, sinon tout tombe au plancher et la plus fréquente (noir) gagne.
- D'autres sessions travaillent en même temps dans `src/` : annuler un essai par un Edit inverse, jamais en
  recopiant la sauvegarde (elle écraserait leurs changements), et prévenir les sessions concernées.

## Problèmes ouverts

| Problème | Personnes | Piste | Statut |
|---|---|---|---|
| Pull prune foncé lu noir | 31 | trop sombre (L 0,2) pour que sa teinte compte | ouvert |
| ~~Haut sombre coloré lu noir, chemise en jean lue marine~~ | 18, 26, 29, 37 | asymétrie clair/foncé de l'essai 1, après avoir écarté les plis du foulard (8) | **résolu** (options simplifiées) |
| ~~Barbe grise claire non vue~~ | 2, 24, 37 | saturation perdue sur le menton et la mâchoire | **résolu** (essai 4) |
| ~~Locs grises lues noires~~ | 37 | pas de gris ni de blanc pour les peaux foncées (`population.ts`) | **résolu** (essai 5) |
| ~~Noir lu brun~~ | 25, 31 | clarté prise en compte dans la frontière noir / brun | **résolu** (essai 6) |
| Personne 10 : reflets bruns visibles, mesure nettement brune, vérité « noir » | 10 | accepter `noir` ou `brun` | à trancher (utilisateur) |
| Personne 34 : « Boucles et dégradé » refusée par la vérité, le scan ne la distingue pas de « Boucles » | 34 | accepter `curlyFade` | à trancher (utilisateur) |
| Auburn lu châtain | 32 | seuil du roux 0,065 → 0,055 (32 : 0,061 ; châtains ≤ 0,044) | ouvert |
| Carré lu long (profil juste au-dessus du seuil), boucles courtes serrées lues carré (contour lisse), boucles blondes très claires lues queue (mal segmentées) | 23, 26, 38 | forme du carré de profil ; texture à l'intérieur des cheveux | ouvert |
| Montures transparentes rendues noires | 23, 29, 31, 38, 39 | couleur de la monture (`glasses.color`) | ouvert |
| « Boucles et dégradé » : bande de peau nette sur les profils et le dos | 10, 12, 22, 25, 31, 35, 40 | rendu de la coupe (`hair.ts`) | ouvert |
| Personne 20 : vérité « rasé ou court », l'autre session voit « Boucles et dégradé » | 20 | à trancher | à trancher (utilisateur) |
| Barbe de profil : pointe qui dépasse sous le menton, bord avant net ; une barbe courte qui suit la mâchoire paraît longue | 16, 20 | remonter un peu la pointe (`beard.ts`) | à trancher (utilisateur) |
| Personne 12 : « Boucles et dégradé » acceptée par la vérité, rendue avec une nuque rasée absente de la photo | 12 | retirer `curlyFade` de sa vérité | à trancher (utilisateur) |
| Cheveux ras clairs sous une casquette : calotte plate avec une bande claire à la nuque | 18, 28 | rendu de `buzz` sous un couvre-chef (`hair.ts`) | ouvert |
| Tenue et boucles d'oreilles non vérifiées par le score | — | les ajouter à la vérité terrain (les fiches `fiche.md` les donnent) | à trancher (utilisateur) |
| Yeux clairs (bleus, verts, noisette) lus marron : iris mesuré sombre et terne | 2, 3, 6, 11, 12, 14, 24, 32, 38, 40 | zone de l'iris (reflet, paupière) ou seuil 0,08 de `colorLikelihood` ; tester hors ligne sur les 40 iris | ouvert |
| Teint resserré vers le 4ᵉ (`#e2ae86`) : peaux claires trop foncées, peaux foncées trop claires (11/40 comme la fiche) | 3, 6, 11, 14, 16, 20, 26, 32, 40… | étirer les extrêmes ; la clarté des joues ne suit les fiches qu'en gros (6 et 29 même mesure) | ouvert |
| Forme des yeux : fiches « en amande » 38/40, scan « ronds » 36/40 ; l'ouverture (0,26–0,39) ne sépare pas | toutes | vérité terrain pour les yeux de chibi, ou laisser la fréquence décider | à trancher (utilisateur) |
| Taches de rousseur pas mesurées | 32, 35, 38 | la fréquence décide | ouvert |
| Bouc ou barbe : le scan ne sait pas les séparer | 16, 25 | côtés de la mâchoire et bas des joues essayés : non discriminants ; la fréquence décide | ouvert |
| ~~Haut vert sapin lu noir ou gris~~ | 12, 22, 30 | vert de la palette réglé sur les photos (asymétrie clair/foncé) | **résolu** (options simplifiées) |
| ~~Lunettes en trop sous un turban~~ | 18, 28 | pont du nez | **résolu** (essai 3) |
| ~~Montures fines ou transparentes manquées~~ | 31, 36 | pont du nez | **résolu** (essai 3) |
| ~~Moustache blanche non vue~~ | 18, 28 | règle de la barbe blanche | **résolu** (essai 2) |

## Passes

Les plus récentes en haut. Une entrée par essai : ce qui a été changé et pourquoi, le score avant → après,
les personnes qui ont changé, et la décision (gardé ou annulé).

### 2026-10-28 — passage du code à TypeScript (sans effet sur le scan)

- **Changement** : tout le code passe de JavaScript à TypeScript strict (commit `04f6d4b`), types seulement.
  Les commandes sont les mêmes (`pnpm portraits`, `pnpm apercu`) ; les noms de fichiers de ce journal ont
  été mis à jour en `.ts`.
- **Score** : 33/40 → **33/40**, mêmes écarts personne par personne. Rendu inchangé à l'œil (10, 23).

### 2026-10-24 — essais 4 à 6 : barbes grises, gris des peaux foncées, noir ou brun (gardés)

- **Essai 4, barbes grises** : une barbe grise ou poivre et sel n'est presque pas plus foncée que la peau,
  mais plus terne. Nouvelle mesure `grey` (`frontFeatures.ts`) : saturation (chroma / clarté) perdue par
  rapport aux joues, sur la lèvre, le menton et la mâchoire (une ombre assombrit sans ternir). Menton +
  mâchoire : sans barbe ≤ 0,02, barbes grises 0,10–0,23 ; seuil 0,06 (`classify.ts`, `greyBeard`), menton
  seul ≥ 0,035 = barbe plutôt que 3 jours, lèvre ≥ 0,04 = moustache grise. Une barbe trouvée ainsi ne prend
  pas de couleur chaude (la barbe de 3 jours de 2 sortait blonde). Mesure `speckle` (dispersion de la
  clarté) ajoutée aussi : ne sépare pas, gardée pour la suite.
- **Essai 5** : `population.ts` donnait 0 % de cheveux gris ou blancs aux peaux foncées, même chez les
  seniors : 30 et 8 comme pour les peaux mates. `pnpm profils` : tableau inchangé.
- **Essai 6** : frontière noir / brun sur chroma + 0,05 × (L − 0,25), seuil 0,0145 (noirs ≤ 0,0132, bruns
  ≥ 0,0155). Testé hors ligne sur les 21 cheveux noirs ou bruns.
- **Score** : 29 → 31 (2, 24) → 32 (37) → **33/40** (25, 31 cheveux). Aucune régression.

### 2026-10-24 — coupe « Boule à zéro », foulard refait, cheveux sans fente (gardé)

- **Demandes de l'utilisateur** : une coupe très courte, l'équivalent de la barbe de 3 jours pour les
  cheveux ; un foulard plus réaliste, contrôlé sur les photos ; plus de « raie » sur le dessus des coupes ;
  une queue de cheval moins pointue.
- **Changement** : `shaved` (« Boule à zéro », `m`) peinte sur une couche collée au crâne (`hair.ts`) ; le scan
  ne la distingue pas d'un crâne chauve (même vraisemblance, la fréquence décide : ados → boule à zéro,
  adultes et seniors → chauve) ; fréquences prises sur `buzz` et `bald` (`population.ts`) ; vérité terrain
  de 15 et 24 élargie, fiche de 15 → `shaved`. Foulard (`accessories.ts`) comparé à 8 et 27 sous les 4 angles :
  ouverture ovale en pointe douce sur le front, sous-foulard foncé, deux plis autour du cou, pan qui tombe de
  l'arrière de la tête sur les épaules.
- **Score** : 29/40 → 29/40, aucun changement (15 et 24 restent `bald`, accepté).

### 2026-10-24 — barbe refaite (rendu, gardé)

- **Demande de l'utilisateur** : la barbe était laide. Défauts : rebord plat sur les joues (effet masque),
  boule rapportée sous le menton qui ne se raccordait pas, coupe verticale sous l'oreille, poils blancs sous
  la tête (triangles étirés au pôle de la coque).
- **Changement** (`beard.ts`) : une seule coque, mince sur les joues, épaisse le long de la mâchoire ; le
  menton (pas la gorge) poussé vers le bas et l'avant en U ; limite des joues en diagonale des coins de la
  bouche aux favoris, estompée sur une bande ; bord arrière qui suit l'angle de la mâchoire ; arrêt avant le
  cou ; pas de reflet (il éclairait les poils isolés en blanc). Comparé aux photos 15, 18, 20, 34 sous les
  4 angles et dans « Crée ton perso ».
- **Score** : inchangé (rendu seul).

### 2026-10-24 — options simplifiées, une seule moustache et une seule barbe (gardé)

- **Demande de l'utilisateur** : peu d'options, seulement des traits courants en Suisse ; une seule
  moustache ; une seule barbe, entre courte et longue ; bouc = moustache + tour de la bouche + menton ;
  « Boucles et dégradé » très courante chez les ados ; jamais de mélange de genres (sauf « Au hasard ») ;
  seulement les couleurs principales, la mesure prend la plus proche.
- **Retiré** : turban, vitiligo, locks courtes, moustache fine, barbe longue, et les couleurs jean, bleu
  canard, vert sapin, bordeaux, rouille (12 couleurs au lieu de 17). Gardés : nattes, bouc, gilet, pendants,
  taches de rousseur.
- **Scan** : couleur du haut rapportée à la plus proche, une photo assombrit et ternit (écart moitié moins
  cher dans ce sens, teinte à 20°) — testé hors ligne sur les 40 mesures (35/38) ; beige réglé sur les beiges
  photographiés ; plis du foulard écartés du haut (`clothes.ts`, distance 0,12 → 0,2) ; genre inconnu : pris
  dans les options du look (`lookGender`), plus aucun mélange.
- **Outil** : `pnpm apercu` dessine le look de chaque `fiche.md` à côté des photos ; le score compte un
  look mélangé comme écart (`genre`).
- **Score** : 28 → 27 (vérité ramenée aux options restantes) → **29/40**. Corrigés : 4, 18, 22, 29, 30
  (couleurs), 8 (foulard). Aucune régression.

### 2026-10-24 — nouveaux traits des 40 portraits (gardé, puis simplifié)

- **Demande de l'utilisateur** : ajouter au jeu les traits des portraits qui n'y étaient pas (fiches
  `public/portraits/Personne_NN/fiche.md`) : nattes, locks courtes, bouc, barbe longue, moustache fine,
  turban, gilet, pendants, taches de rousseur, vitiligo, vert sapin, rouille, violet.
- **Scan** (`classify.ts`) : nattes = mèches très étroites de profil (< 0,22) tombant devant les épaules ;
  turban = couvre aussi une partie des côtés (0,21–0,26, casquette 0) avec un plancher bas pour le
  couvre-chef ; moustache fine ou épaisse selon l'assombrissement rapporté au teint (seuil 0,45) ; taches
  de rousseur décidées après la couleur des cheveux. Bouc et barbe longue : pas de mesure, la fréquence
  décide (mesure des côtés de la mâchoire essayée puis retirée).
- **Vérité terrain** : nouvelles options acceptées là où elles décrivent la photo (turban 18 et 28,
  nattes 21 et 33, vert sapin, rouille, violet, bouc et moustache fine 16 et 25).
- **Score** : 25 → **28/40**. Changent : 12, 22, 30 (vert sapin), 28 et 18 (turban), 21 et 33 (nattes).
  Aucune régression.

### 2026-10-24 — essai 3 : lunettes = pont du nez + monture (gardé)

- **Hypothèse** : toute monture traverse le nez entre les yeux ; un couvre-chef qui descend sur les tempes,
  jamais. Mesure `bridge` (pixels accessoire entre les coins internes des yeux) : 0,12–0,39 pour les 13
  montures, 0 pour les turbans et la casquette.
- **Changement** : `frontFeatures.ts` (mesure `bridge`), `classify.ts` (`present` = quantité ≥ 0,04 **et** pont
  ≥ 0,06, au lieu de quantité ≥ 0,06).
- **Score** : 23 → **25/40**. Changent : 18 (lunettes en trop), 28 (✓), 31 (monture transparente trouvée),
  36 (✓, rondes). Aucune régression.

### 2026-10-24 — essai 2 : moustache blanche (gardé)

- **Hypothèse** : une moustache blanche n'est pas plus foncée que la peau mais plus grise ; on la cherche comme
  la barbe blanche, seulement quand une barbe blanche est vue.
- **Changement** : `classify.ts`, `facialHairLikelihood` (`whiteLip`).
- **Score** : 23 → 23/40 (18 et 28 gardaient les lunettes en trop) ; moustache trouvée chez 18 et 28, rendu
  vérifié à l'œil. Aucune régression.

### 2026-10-24 — essai 1 : couleur des hauts sombres (annulé)

- **Hypothèse** : une photo assombrit et ternit un vêtement, jamais l'inverse : être plus foncé ou plus terne
  que la couleur de la palette doit moins coûter quand la teinte est nette. Hors ligne : 30 → 33 bons.
- **Score** : 23 → 22/40. 26 et 37 corrigés, mais **8 régresse** (haut noir mêlé au foulard mauve → bordeaux).
- **Décision** : annulé (Edit inverse), score revenu à 23. À reprendre après avoir écarté le foulard des
  pixels du haut.

### 2026-10-24 — 20 nouvelles personnes

- Personnes 21 à 40 ajoutées (par l'utilisateur), vérité terrain écrite d'après les photos (`portraits.ts`).
- **Score** : 23/40 (16/20 sur les 20 premières, inchangé).

### 2026-10-24 — point de départ

- **Score** : 16/20 conformes (écarts : 2, 10, 12, 18).
- **Changement** : aucun, première passe de référence avec `pnpm portraits`.
