Test portraits / Portraits de test
==================================

EN — The photos are not in the repository. The game itself does not need them: they only serve the
tools that check the face scan (`pnpm portraits`, `pnpm apercu`, skill .claude/skills/portraits).
To use those tools, put your own test people here, one folder each:

  Personne_NN/
    01_face.jpg            front
    02_profil_gauche.jpg   left profile
    03_profil_droit.jpg    right profile
    04_dos.jpg             back
    fiche.md               the traits seen on the photos, as options of « Crée ton perso »

Use only photos of fictional people (generated images) or of people who agreed in writing to this
use. Images of 600 × 800 pixels work well. The ground truth in tools/playwright/portraits.ts and the
log in docs/portraits-journal.md describe the author's own set of 40 fictional people: replace them
with yours.

FR — Les photos ne sont pas dans le dépôt. Le jeu n'en a pas besoin : elles servent seulement aux
outils qui vérifient le scan du visage (`pnpm portraits`, `pnpm apercu`, skill .claude/skills/portraits).
Pour utiliser ces outils, mets ici tes propres personnes de test, un dossier chacune, comme ci-dessus.

N'utilise que des photos de personnes fictives (images générées) ou de personnes qui ont accepté par
écrit cet usage. Des images de 600 × 800 pixels conviennent bien. La vérité terrain de
tools/playwright/portraits.ts et le journal docs/portraits-journal.md décrivent le jeu de 40 personnes
fictives de l'auteur : remplace-les par les tiens.
