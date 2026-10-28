# Mini Future Me

[English version](README.md)

Un jeu 3D pour les stands des salons des métiers. Chaque visiteur ou visiteuse devient un petit avatar
(créé à partir de ses photos ou à la main), réalise quelques tâches d'un métier dans une pièce en 3D
isométrique (un bureau, un atelier, une réception…), puis repart avec une affiche de son avatar, imprimée ou sur son téléphone par QR code.
Une partie dure environ 5 minutes ; on joue à la souris ou au doigt.

Le jeu est pensé pour plusieurs **filières**. Chacune apporte ses tâches, ses domaines du métier, ses
postes de travail et l'objet que l'avatar tient sur l'affiche. Une seule existe pour l'instant :

| Filière | Nom dans le jeu | Ce qu'on fait |
|---|---|---|
| Médiamatique (médiamaticien·ne CFC) | **Mini Future Me Médiamaticien·ne** | une campagne pour la limonade « Pétille » : shooting produit, retouche, mise en page, publication, impression ; l'avatar tient l'affiche qu'il a composée |

Le jeu sert à des **démos courtes et simples** : en quelques minutes, le visiteur essaie quelques gestes d'un
métier, sans chercher à tout montrer. Il convient particulièrement aux métiers qui se pratiquent à l'intérieur,
ou dont une partie tient dans une seule pièce. Mais la vraie limite, c'est l'imagination.

L'interface du jeu est en français (Suisse romande). Tout tourne hors-ligne sur un seul PC : le jeu ne
stocke aucune image du visage et n'en envoie aucune hors du PC, et l'équipe du stand efface les photos
après chaque visiteur (voir [Photos des visiteurs](#photos-des-visiteurs)).

![Le bureau de Mini Future Me Médiamaticien·ne](docs/screenshot.png)

## Ta filière dans le jeu ?

Le jeu est fait pour accueillir d'autres métiers. Certains s'y prêtent particulièrement bien :

- **les métiers de bureau** : commerce, administration, logistique, réception ;
- **les métiers de l'informatique** : développement, réseaux, support ;
- **les métiers d'atelier** : technique, électronique, mécanique de précision, artisanat ;
- **les métiers créatifs** : médias, graphisme, design, mode ;
- **les métiers d'accueil, de soin et de service** qui se pratiquent dans une pièce : un cabinet, un
  laboratoire, une cuisine, un salon.

Et bien d'autres : un métier qui se pratique dehors ou sur un chantier a souvent un coin d'atelier, des outils
ou une préparation à montrer. Chaque filière garde la même ambiance et le même déroulement, avec sa pièce, ses
propres épreuves, son décor et l'objet que l'avatar tient sur son affiche.

- **La développer toi-même** : suis le guide [Ajouter une filière](docs/adding-a-trade.fr.md). Si tu travailles
  avec un assistant IA, le skill [`new-trade`](.agents/skills/new-trade/SKILL.md) lui donne la direction
  artistique et les règles du jeu : la nouvelle filière ressemble aux autres sans repartir de zéro.
- **La confier** : si ton école préfère ne pas s'en charger, le créateur du jeu peut développer la filière
  avec vous, sur devis. Décris ton projet dans une [demande « Nouvelle filière »](https://github.com/proprioz/mini-future-me/issues/new?template=nouvelle-filiere.yml) ou écris-lui depuis
  [son profil GitHub](https://github.com/proprioz).

## Lancer le jeu

Il faut [Node.js](https://nodejs.org) 22.18 ou plus récent et [pnpm](https://pnpm.io) (tu n'as que npm ?
`npm install -g pnpm` une fois). Pour travailler sur le code, commence par [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md).

Sur le stand :

```bash
pnpm install
cp .env.example .env.local    # puis règle tes filières et ton école (voir Configuration)
WIFI_NAME="Mini-Future-Me" pnpm start
```

Puis ouvrir http://localhost:3000 sur le PC. `pnpm start` construit le jeu et lance le serveur du stand
(`server/index.ts`), qui sert le jeu et reçoit les affiches. Le QR code de chaque affiche pointe vers
`http://<IP du PC>:3000/p/<id>` : le téléphone doit être sur le même Wi-Fi (un routeur dédié au stand,
sans Internet, suffit).

- Les affiches restent **en mémoire uniquement** (rien n'est écrit sur le disque) et sont effacées
  après 30 minutes, ou à l'arrêt du serveur.
- Depuis le Wi-Fi, les téléphones n'ont accès qu'à leur affiche (`/p/<id>`). Le jeu et l'envoi des
  affiches ne répondent qu'au PC lui-même (`localhost`).
- Au premier lancement, le pare-feu (Windows ou macOS) demande d'autoriser Node : accepter pour le
  **réseau privé**, sinon les téléphones ne peuvent pas joindre le PC.
- Sous Windows (PowerShell) : `$env:WIFI_NAME="Mini-Future-Me"; pnpm start`.
- Variables du serveur : `PORT` (3000), `WIFI_NAME` (affiché à côté du QR code), `PUBLIC_HOST` (adresse à mettre
  dans le QR code si la détection automatique de l'IP se trompe), `POSTER_TTL_MINUTES` (30).

`pnpm install` copie aussi le runtime WASM de MediaPipe et le petit modèle âge/genre dans `public/` ; les modèles
`public/mediapipe/*.task|.tflite` sont versionnés. L'analyse des photos fonctionne donc sans Internet.

## Configuration

Les réglages de chaque stand vont dans `.env.local` (ignoré par git ; modèle dans `.env.example`) :

| Variable | Rôle |
|---|---|
| `VITE_TRADES` | filières proposées sur l'accueil, dans l'ordre (ids de `src/trades/index.ts`, séparés par des virgules). Vide : toutes. Avec une seule filière, l'accueil ne propose pas de choix. |
| `VITE_SCAN` | `false` : pas de scan des photos, l'avatar se crée à la main (sans carte de consentement). Activé par défaut ; une filière peut aussi le couper pour elle seule (`scan: false`). |
| `VITE_SCHOOL_NAME`, `VITE_SCHOOL_SITE`, `VITE_SCHOOL_URL` | ton école, dans le pied de chaque affiche et de « Dans les coulisses » imprimé (nom, site affiché, lien du QR code). Sans URL, il n'y a pas de bloc école. |

Le logo de l'école va dans `public/school/logo.svg` (ignoré par git) ; s'il manque, son nom est écrit à la place.
En développement, `?filiere=<id>` dans l'URL force une filière.

## Mode borne

Pour le stand, ouvrir le jeu dans le navigateur en plein écran, sans barre d'adresse, par exemple :

```bash
msedge --kiosk http://localhost:3000 --edge-kiosk-type=fullscreen --no-first-run
```

- **Accueil** : un avatar au hasard fait coucou jusqu'à ce qu'on touche l'écran. Avec plusieurs filières,
  une carte propose de choisir un métier. Ensuite, si le scan est activé, une carte explique ce qu'on fait des
  photos (« Avec mes photos » ou « Sans photos, à la main ») ; sinon, on passe directement à « Crée ton perso ».
- **Dans les coulisses** : « Comment ce jeu est fabriqué », sous le bouton Jouer, explique le jeu en
  chapitres (code, 3D, visage, scan, vie privée, IA, puis le métier de chaque filière), avec de petites démos sur
  l'avatar de l'accueil. Pensé pour que l'équipe du stand l'explique, même sans connaître le code. « Imprimer » sort tous les chapitres
  sur quelques pages A4. Dans le chapitre Vie privée, « Imprimer la fiche du stand » sort « Tes données sur
  ce stand », une page A4 à poser sur la table du stand : ce que le jeu fait des données du visiteur, des
  photos à l'affiche. Textes dans `src/ui/AboutPanel.ts`, et dans `about.ts` de chaque filière.
- **Photos** : une photo de face suffit, on peut ajouter les deux profils et le dos (1 à 4 photos), rangés
  automatiquement à leur place d'après le visage qu'ils montrent. Comment les prendre et les effacer :
  [Photos des visiteurs](#photos-des-visiteurs).
- **Inactivité** : après 60 s sans toucher l'écran, « Tu es encore là ? » avec un compte à rebours de 10 s,
  puis retour à l'accueil. Plus de temps pendant le choix des photos et leur analyse, et sur la carte de
  l'affiche (3 min, le temps de scanner le QR code).
- **Fin de partie** : « J'ai fini ! » sur la carte de l'affiche (deux taps).
- **Réinitialisation** : la page est rechargée, donc tout est oublié (avatar, prénom, domaines gagnés, mesures du
  scan). Les affiches déjà envoyées restent sur le serveur jusqu'à leur effacement (30 min).
- **Pour l'équipe** : 5 taps rapides dans le coin en haut à gauche (ou F5) remettent le jeu à zéro.
  Le bouton son (accueil et bureau) coupe les sons ; le choix est mémorisé sur le PC.
- Option à tester sur place : ajouter `--kiosk-printing` pour imprimer directement sur l'imprimante par
  défaut, sans la fenêtre d'impression.

## Photos des visiteurs

Le jeu lit les photos, les analyse en mémoire et les oublie dès qu'on quitte l'écran du scan. Mais pour
que le visiteur les choisisse, elles doivent d'abord être des fichiers sur le PC : l'équipe du stand les
prend, les dépose sur le PC, puis les efface, sur le PC comme sur l'appareil qui les a prises.

**Préparer le PC** (une fois) :

- Un compte Windows ou macOS réservé au stand, sans droits d'administrateur, sans fichiers personnels et
  sans aucune session ouverte (messagerie, cloud, navigateur) : le sélecteur de fichiers s'ouvre devant le
  visiteur et laisse parcourir ce compte.
- Un seul dossier pour les photos, par exemple « Photos du stand » sur le bureau, en dehors de tout dossier
  synchronisé avec un cloud. Le choisir lors du premier essai : le navigateur le rouvre en général ensuite.

**Pour chaque visiteur** :

1. Prendre les photos avec le téléphone de l'équipe ou l'appareil photo du stand (de face, et si on veut
   les deux profils et le dos).
2. Les déposer dans le dossier des photos, vide jusque-là (par câble, carte SD ou partage sans fil ; si le
   transfert les dépose dans Téléchargements, les déplacer).
3. Le visiteur les choisit dans le jeu. Une personne de l'équipe reste à côté tant que le sélecteur de
   fichiers est ouvert.
4. Dès que l'analyse est finie, effacer les photos pour de bon :
   - sur le PC, sans passer par la corbeille : Maj + Suppr sous Windows, Option + Cmd + Retour arrière
     sous macOS ;
   - sur le téléphone, puis dans l'album « Supprimés récemment », qui les garde sinon 30 jours ;
   - sur l'appareil photo, depuis son menu.

**En fin de journée** : vérifier que le dossier des photos, Téléchargements et la corbeille du PC sont
vides, ainsi que la galerie et « Supprimés récemment » du téléphone ; formater la carte de l'appareil photo.
Les affiches, elles, ne laissent aucun fichier sur le PC : au stand, elles partent par QR code ou sur papier
(les boutons PNG et PDF n'existent qu'en développement).

## Développement

```bash
pnpm dev      # le jeu sur http://localhost:5173
pnpm server   # le serveur du stand (Vite lui transmet /api), relancé à chaque modification
```

Sans `pnpm server`, tout marche sauf le QR code (la carte d'export propose alors l'impression et les fichiers).
En développement, l'inactivité est désactivée (elle rechargerait la page sous les devtools) :
ouvrir http://localhost:5173/?borne pour la tester.

Pour contribuer, lire [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) ; pour ajouter une filière,
[docs/adding-a-trade.fr.md](docs/adding-a-trade.fr.md). Le plan complet et les décisions sont dans [PLAN.fr.md](PLAN.fr.md).

Autres commandes :

| Commande | Rôle |
|---|---|
| `pnpm build` | construit le jeu dans `dist/` |
| `pnpm check` | tout ce que vérifie la CI : `pnpm typecheck` (TypeScript), `pnpm lint:css` (tailles en rem), `pnpm test` (règles du jeu, contrat des filières), `pnpm test:e2e` (une visite complète de chaque filière dans Edge, hors-ligne ; sans Edge, voir CONTRIBUTING.fr.md) |
| `pnpm icons` | régénère les pictogrammes (`src/ui/iconPaths.ts`) après l'ajout d'un nom dans `tools/build-icons.ts` |
| `pnpm profils` | régénère `docs/profils-types.md`, le look le plus probable par genre et âge |
| `pnpm portraits`, `pnpm apercu` | comparent le scan à des portraits de test (voir plus bas) |

## Structure

```
server/                   serveur du stand (Express) : jeu construit, envoi des affiches, pages téléphone
src/
  main.ts                 point d'entrée : accueil (choix de la filière), photos, « Crée ton perso », bureau, affiche
  trades/                 les filières
    index.ts              registre : id, titre, métier, pictogramme ; VITE_TRADES et ?filiere
    types.ts              le contrat d'une filière, typé
    current.ts            la filière jouée (trade())
    mediamatique/         médiamatique : tâches, domaines, postes du bureau, affiche tenue, textes, mini-jeux
  game/                   commun : bureau iso (Room.ts), boucle de jeu (Game.ts), grille A*, entrées, domaines (skills.ts)
  minigames/MiniGame.ts   base commune des mini-jeux : carte par-dessus le bureau, victoire ou « Réessayer »
  character/              avatar chibi procédural : corps, tête, visage dessiné, cheveux, barbes, accessoires,
                          options et fréquences (population.ts), poses de l'affiche
  scan/                   analyse des photos (MediaPipe, modèle âge/genre local) → options les plus proches
  poster/                 l'affiche A4 : décors, rendu, déblocages, école, exports
  kiosk/                  mode borne : inactivité, réinitialisation, sons
  render/                 matériaux toon, palette, scène du perso, vignettes
  ui/                     écrans et HUD (accueil, scan, création du perso, studio d'affiche, coulisses…)
tests/                    unit/ (Vitest : règles du jeu, contrat des filières), e2e/ (Playwright : le jeu dans un navigateur)
tools/                    pictogrammes, règle CSS, profils types, comparaison des portraits de test
docs/                     ajouter une filière, profils types, journal du scan
```

## Portraits de test

`pnpm portraits` compare l'avatar que le scan construit avec des photos de test, sous 4 angles, et ouvre une galerie
(`.playwright-mcp/comparaisons/index.html`) avec les écarts à la vérité terrain (`tools/playwright/portraits.ts`).
`pnpm apercu` dessine l'avatar décrit par la fiche de chaque personne. Les photos **ne sont pas dans le dépôt** :
mets les tiennes dans `public/portraits/` (format dans [public/portraits/README.txt](public/portraits/README.txt)),
uniquement des personnes fictives ou qui ont donné leur accord. La vérité terrain et le journal
(`docs/portraits-journal.md`) se rapportent au jeu de portraits de l'auteur.

En développement, `window.studio` expose `welcome`, `scan`, `creator`, `kiosk`, `trades`, puis `game` et
`posterStudio` une fois la partie lancée, pour piloter le jeu depuis la console ou un outil de test.
`studio.game.openTask('shoot')` ouvre directement un mini-jeu. Les scripts de `tools/playwright/`
(`upload.ts`, `measure.ts`, `sheet.ts`, `simulate.ts`…) s'importent depuis la page.

## Licence

Le code est sous licence [GPL-3.0-or-later](LICENSE) : tu peux l'utiliser, l'étudier, le modifier et le redistribuer,
à condition de garder la même licence pour tes versions.

Éléments tiers inclus ou embarqués, chacun sous sa propre licence (toutes compatibles) :

| Élément | Licence |
|---|---|
| Modèles MediaPipe de Google (`public/mediapipe/`) et `@mediapipe/tasks-vision` | Apache-2.0 |
| Modèle âge/genre de `@vladmandic/face-api` (copié par `pnpm install`) | MIT |
| Pictogrammes [Phosphor](https://phosphoricons.com) (`src/ui/iconPaths.ts`) | MIT |
| Polices Fredoka et Nunito (`@fontsource-variable`) | SIL Open Font License 1.1 |
| three.js, jsPDF, qrcode, Express | MIT |

Le nom et le logo de ton école ne font pas partie du dépôt (voir Configuration).
