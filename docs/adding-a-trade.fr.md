# Ajouter une filière

[English version](adding-a-trade.md)

Le jeu fait des démos courtes et simples : quelques gestes d'un métier, dans une seule pièce, en 5 minutes
environ. Choisis ce qui peut se passer dans une pièce (un bureau, un atelier, une réception, un cabinet…) et
qui est amusant à faire au doigt ; le reste trouve sa place dans le chapitre « Le métier ».

Une filière, c'est ce que le visiteur découvre pendant une partie : les commandes du client jouées au
bureau, les domaines du métier qu'elles exercent, les postes de travail, et l'objet que l'avatar tient sur
l'affiche finale. Tout le reste (accueil, scan des photos, création du perso, pièce du bureau, studio
d'affiche, export, mode borne) est commun à toutes les filières.

La filière médiamatique, **Mini Future Me Médiamaticien·ne** (`src/trades/mediamatique/`), est l'exemple complet : reprends sa
structure.

**Avec un assistant IA** : indique-lui le skill [`new-trade`](../.agents/skills/new-trade/SKILL.md). Il contient
la marche à suivre (recherche, concept, points de validation) et l'ADN du jeu (direction artistique, façon
dont se joue un mini-jeu, rédaction du contenu du métier), pour que la nouvelle filière ressemble aux autres.
La plupart des assistants le trouvent d'eux-mêmes dans `.agents/skills/` (le skill est en anglais).

**Tu préfères confier ce travail ?** Le créateur du jeu peut développer la filière avec ton école, sur devis :
ouvre une [demande « Nouvelle filière »](https://github.com/proprioz/mini-future-me/issues/new?template=nouvelle-filiere.yml).

## 1. Déclarer la filière

Dans `src/trades/index.ts`, ajoute une entrée à `TRADES` :

```ts
{
  id: 'cuisine',                      // nom du dossier, et valeur de VITE_TRADES / ?filiere
  job: 'cuisinier·ère',               // le métier, inclusif, en minuscules : la filière s'appelle « Mini Future Me Cuisinier·ère »
  icon: 'cooking-pot',                // pictogramme (voir « Pictogrammes » plus bas)
  pitch: 'Recettes, dressage, service', // une ligne sur la carte du choix de la filière
  load: () => import('./cuisine/index.ts'),
},
```

Essaie-la avec http://localhost:5173/?filiere=cuisine, et sur le stand avec `VITE_TRADES=cuisine` (ou
`VITE_TRADES=mediamatique,cuisine` pour proposer les deux sur l'accueil).

## 2. Le module de la filière

`src/trades/<id>/index.ts` exporte par défaut un objet avec ces champs, typés par `TradeModule` dans
`src/trades/types.ts` : termine-le par `} satisfies TradeModule;` (voir `mediamatique/index.ts`), et ton
éditeur et `pnpm typecheck` signalent un champ manquant ou un nom de pictogramme erroné.

| Champ | Ce que c'est |
|---|---|
| `scan` | `false` pour se passer du scan des photos dans cette filière (l'avatar se crée à la main) ; activé par défaut, sauf si le stand le coupe avec `VITE_SCAN=false` |
| `welcome.highlight` | `[icône, texte]`, la case du milieu de l'accueil (« Un métier créatif ») |
| `tasks` | les commandes du client, dans l'ordre (voir 3) |
| `skills` | les domaines du métier, chacun `{ id, label, icon, tint, tasks: [ids des tâches] }` ; gagné quand toutes ses tâches sont faites |
| `finalSkill` | id du domaine gagné avec toute la commande (montré sur le dernier écran de victoire) |
| `buildStations(ctx)` | construit les postes de travail dans le bureau (voir 4) |
| `creation` | l'objet que l'avatar tient sur l'affiche (voir 5) |
| `studio` | `decors`, `poses`, `unlocks`, `titles`, et si besoin `defaultDecor` (voir 6) |
| `poster.caption` | la ligne sous le prénom sur l'affiche |
| `about.chapter` | le chapitre « Le métier » de « Dans les coulisses », de même forme que les chapitres communs de `src/ui/AboutPanel.ts` |
| `phone.fact` | un mot sur le métier sur la page téléphone de l'affiche, après le nom du métier |

Importe le CSS de la filière depuis `index.ts` (`import './style.css'`) : il se charge avec la filière.

## 3. Les tâches : les mini-jeux

Chaque tâche est `{ id, item, where, icon, title, Game, brief, win, fact }` (voir `mediamatique/tasks.ts`) :

- `item` : id du poste où elle se joue ; plusieurs tâches peuvent partager un poste.
- `where` : où elle se joue, pour le tableau de liège (« sur le laptop »).
- `brief` : la demande du client, en une ligne ; `win` : le titre de l'écran de victoire ; `fact` : la chose
  à retenir sur le métier.
- `Game` : une classe qui étend `src/minigames/MiniGame.ts`. Construis le jeu dans `play(el)` et appelle
  `this.end(true)` quand il est gagné, ou `this.end(false, 'ce qu’il faut corriger')`. Les helpers `loop`,
  `after`, `listen`, `canvasPoint` et `feedback` font leur propre ménage.
- Un jeu qui fabrique quelque chose le met dans `this.result` ; le jeu le garde dans `results[task.id]`, que
  reçoivent les tâches suivantes (`this.results`).

Les règles du jeu, d'après PLAN.fr.md : de 30 à 60 secondes par tâche, pas d'échec bloquant ni de chrono, le
strict minimum de texte (une ligne de demande, une phrase courte par consigne), et ça doit marcher au doigt
comme à la souris.

## 4. Les postes du bureau

`buildStations(ctx)` ajoute le mobilier de la filière à la pièce commune (`src/game/Room.ts`). `ctx` contient
le `group` où ajouter les objets et la grille de déplacement `grid`. Utilise les helpers exportés par `Room.ts` :

- `makeInteractable(ctx, objet, { id, label, icon, useTile, focus, hitbox })` déclare un poste : `id` est
  l'`item` de ses tâches, `useTile` la case où se place l'avatar pour l'utiliser, `focus` le point qu'il
  regarde (la pastille flotte au-dessus), `hitbox` une boîte invisible qui élargit la cible du doigt.
- `ctx.grid.block([x, z], …)` marque les cases occupées par le mobilier.
- `addTo`, `canvasTexture`, et les matériaux de `src/render/materials.ts` (`box`, `cylinder`, `toon`…).

La pièce fait 7 × 5 cases. Libres pour les postes : le mur du fond à partir de x = 1 (une plante occupe le
coin), le mur de gauche à partir de z = 3 (le tableau de liège et son buffet sont en z = 1–2), et le sol à
l'écart du tapis (vers 3,4 ; 2,9) et du pouf (case 1, 4). Garde des postes gros : chacun doit se lire d'un
coup d'œil.

## 5. L'objet tenu par l'avatar

`creation` a trois champs :

- `from(results)` : ce que le visiteur a fabriqué, d'après les résultats des tâches, ou `null` s'il ne l'a pas
  encore fait (les poses ne tiennent alors rien, et « Fier·ère » n'est pas proposée).
- `mesh(data)` : construit l'objet, un `THREE.Object3D` centré sur son milieu, avec
  `userData.size = { w, h, d }` en unités du monde (les jambes de l'avatar mesurent environ 0,4). Il est
  rappelé à chaque reconstruction de l'objet : garde en cache ce qui est coûteux à dessiner.
- `holds` : par id de pose, ce qui remplace la façon dont cette pose tient l'objet (`hand`, `grip`, `depth`,
  `lean`, `turn`, `tilt` ; voir `hold()` dans `src/character/poses.ts`). Les poses communes sont faites pour
  une feuille tenue par le bord : un objet volumineux (un gâteau, une chaise) voudra ses propres prises, par
  exemple `proud: { grip: [0, -1, 0] }` pour le poser sur les mains.

## 6. Le studio d'affiche

- `decors` et `poses` : listes, dans l'ordre, d'ids des décors et poses communs (`src/poster/decors.ts` :
  lagoon, party, city, premiere ; `src/character/poses.ts` : proud, wave, cheer, hero) ou d'objets propres
  à la filière, au même format (la médiamatique ajoute un décor « Studio photo » et une pose « Photographe »).
- `unlocks` : par id de décor ou de pose, l'id du domaine à gagner d'abord ; les autres sont libres.
- `titles` : les titres au-dessus de l'avatar, `{ id, lines: [ligne 1, ligne 2] }` ; le premier est celui par défaut.
- `defaultDecor` : id du décor montré d'abord (sinon le premier).

## Pictogrammes

Les icônes sont des noms Phosphor listés dans `tools/build-icons.ts` : ajoute ceux de ta filière, puis lance
`pnpm icons`.

## À vérifier

- [ ] Entrée dans `src/trades/index.ts`, module dans `src/trades/<id>/`
- [ ] Chaque tâche se gagne en 30 à 60 s, à la souris et au doigt
- [ ] Postes lisibles d'un coup d'œil, rien qui bloque les chemins entre eux
- [ ] L'objet tenu rend bien dans chaque pose (avec et sans lui)
- [ ] Chapitre du métier relu d'après le plan de formation officiel, sans nom de marque
- [ ] Vérifié en 1280×620, 1920×1080 et 3440×1440, sans erreur dans la console
- [ ] `pnpm check` passe : les tests vérifient chaque filière d'eux-mêmes (identifiants qui correspondent, un domaine pour chaque tâche, postes atteignables, une visite complète hors-ligne)
- [ ] README (les deux langues) : la filière dans le tableau des filières
