# Contribuer à Mini Future Me

[English version](CONTRIBUTING.md)

Merci de ton intérêt ! Des écoles utilisent le jeu sur les stands des salons des métiers. Toutes les
contributions sont bienvenues, de la coquille corrigée à une nouvelle filière complète.

## Pour commencer

Il faut [Node.js](https://nodejs.org) 22.18 ou plus récent (il exécute tel quel le TypeScript du serveur et des outils) et [pnpm](https://pnpm.io), le gestionnaire de
paquets du projet (son lockfile est `pnpm-lock.yaml`). Tu n'as que npm ? `npm install -g pnpm` une fois, puis les
commandes ci-dessous.

```bash
pnpm install                 # copie aussi le moteur et les modèles du scan dans public/
cp .env.example .env.local   # facultatif : filières et école de ton stand (Windows : copy au lieu de cp)
pnpm dev                     # le jeu sur http://localhost:5173
pnpm server                  # facultatif, dans un deuxième terminal : le serveur du stand, pour le QR code
```

Une fois `pnpm install` lancé, il n'y a besoin ni d'Internet ni de photo : « Sans photos, à la main », sur
l'accueil, crée le perso à la main. Tout éditeur qui gère TypeScript montre les erreurs de type pendant la
frappe. Les tests de bout en bout demandent en plus Microsoft Edge, le navigateur du stand, ou le Chromium
de Playwright (voir « Vérifier ton changement »).

Le jeu et les décisions de conception sont décrits dans [PLAN.fr.md](PLAN.fr.md), l'organisation du code dans
le [README](README.fr.md#structure).

## Conventions

La liste complète est dans [AGENTS.md](AGENTS.md) (en anglais). L'essentiel :

- TypeScript strict en modules ES, sans framework ni étape de compilation (les imports gardent leur
  extension `.ts`, `import type` pour les types, pas d'`enum`). Suis le style du code voisin : noms,
  densité des commentaires, commentaires en anglais.
- **Textes du jeu en français**, avec le tutoiement, inclusifs (médiamaticien·ne), aussi courts que
  possible. Les docs pour les contributeurs (README, CONTRIBUTING, PLAN, docs/) existent en anglais et en
  français : mets à jour les deux. Les notes de travail internes (`docs/portraits-journal.md`, le skill
  portraits) restent en français.
- Tailles de l'interface en `rem` ; pictogrammes avec `icon()`, jamais d'emojis ; matériaux avec `toon()`.
- Les options du perso ne couvrent que des traits courants en Suisse, et ce que le jeu choisit seul ne
  mélange jamais les genres (lire AGENTS.md avant d'ajouter une option).
- **Vie privée** : tout reste sur le PC, fonctionne hors-ligne, et aucune image du visage n'est stockée ni
  envoyée nulle part. Un changement qui ne respecte pas ça ne peut pas être intégré.

## Vérifier ton changement

`pnpm check` lance tout ce que la CI lance sur ta pull request : les types (`pnpm typecheck`), le CSS
(`pnpm lint:css`), les règles du jeu et le contrat de chaque filière (`pnpm test`), puis une visite complète
de chaque filière dans Edge, hors-ligne (`pnpm test:e2e`). Si tu changes une règle du jeu, ajoute ou adapte
son test dans `tests/`.

Les tests de bout en bout ouvrent le Microsoft Edge installé. Sans Edge (sous Linux, par exemple), installe
une fois le Chromium de Playwright avec `pnpm exec playwright install chromium`, puis lance
`E2E_BROWSER=chromium pnpm test:e2e` (PowerShell : `$env:E2E_BROWSER="chromium"; pnpm test:e2e`). Un test
qui échoue laisse une trace dans `test-results/` : `pnpm exec playwright show-trace <son trace.zip>` la
rejoue pas à pas.

Les tests ne jouent pas les gestes des mini-jeux et ne regardent pas le résultat : vérifie aussi dans un
navigateur.

- Joue les parties que tu as modifiées, à la souris et, si tu peux, au doigt.
- Regarde le résultat au moins en 1280×620, 1920×1080 et 3440×1440 (l'interface suit la taille de l'écran).
- Surveille la console : aucune erreur.
- `pnpm build` doit passer.

## Ajouter une filière

Une filière (ses tâches, ses postes du bureau, l'objet que tient l'avatar, ses textes) est un dossier de
`src/trades/`. Suis [docs/adding-a-trade.fr.md](docs/adding-a-trade.fr.md) ; avec un assistant IA, indique-lui le
skill [`new-trade`](.agents/skills/new-trade/SKILL.md). En parler d'abord dans une
[demande « Nouvelle filière »](https://github.com/proprioz/mini-future-me/issues/new?template=nouvelle-filiere.yml) aide : quelqu'un s'en occupe peut-être déjà, et si ton école préfère
confier le travail, le créateur du jeu peut s'en charger, sur devis.

## Pull requests

- Un changement par pull request, avec une courte description de ce qu'il fait et pourquoi.
- Une capture d'écran quand l'interface change.
- Indique les tailles d'écran et les navigateurs vérifiés.

## Avec un assistant IA (facultatif)

Utilise l'environnement que tu veux : n'importe quel éditeur, n'importe quel assistant IA ou LLM, ou aucun.

- Les consignes pour les assistants sont dans [AGENTS.md](AGENTS.md), un fichier que la plupart des
  assistants de code lisent d'eux-mêmes.
- Des skills pour les tâches récurrentes sont dans `.agents/skills/` (le format Agent Skills, que la plupart
  des assistants chargent d'eux-mêmes) : `new-trade` guide la création d'une filière dans le style du jeu.
- Si ton assistant peut piloter un navigateur, le serveur MCP Playwright lui permet de vérifier lui-même
  l'interface (ouvrir, regarder, cliquer) ; AGENTS.md donne quelques astuces.
- Le dépôt contient une configuration toute prête pour Claude Code (`.mcp.json` et `.claude/` : le skill
  portraits et son hook). Les autres outils ignorent simplement ces fichiers.
- Quel que soit l'outil qui écrit le code, tu en restes l'auteur ou l'autrice : relis-le, comprends-le et
  teste-le toi-même avant d'ouvrir une pull request.

## Licence

En contribuant, tu acceptes que ta contribution soit publiée sous la licence du projet,
[GPL-3.0-or-later](LICENSE).
