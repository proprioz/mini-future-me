import { ProductShoot } from './ProductShoot.ts';
import { PhotoRetouch } from './PhotoRetouch.ts';
import { PosterLayout } from './PosterLayout.ts';
import { ProPrint } from './ProPrint.ts';
import { SocialPublish } from './SocialPublish.ts';
import type { Task } from '../types.ts';

// The five client orders of "Pétille", a lemonade brand, in campaign order: from the photo shoot to
// the posters printed for the shop windows, once the campaign's supports are chosen. `item` is the
// id of the work station in stations.ts where the task is played.
// `brief` is the client's request, one line; `win` the title of the win screen, what the visitor just
// made; `fact` the one thing to remember about the job.
export const TASKS: Task[] = [
  {
    id: 'shoot', item: 'camera', where: 'à l’appareil photo', icon: 'camera', title: 'Shooting produit', Game: ProductShoot,
    brief: 'Une belle photo de notre limonade !',
    win: 'C’est dans la boîte !',
    fact: 'Sur un fond vert, on détoure le produit en un clic pour le poser sur n’importe quel décor.',
  },
  {
    id: 'retouch', item: 'laptop', where: 'sur le laptop', icon: 'laptop', title: 'Retouche photo', Game: PhotoRetouch,
    brief: 'Choisis un fond à la photo et éclaircis-la !',
    win: 'Photo sublimée !',
    fact: 'Retoucher, c’est corriger la lumière et les couleurs pour que la photo soit fidèle au produit.',
  },
  {
    id: 'layout', item: 'laptop', where: 'sur le laptop', icon: 'palette', title: 'Mise en page', Game: PosterLayout,
    brief: 'Une affiche où notre nom se voit de loin !',
    win: 'Affiche réussie !',
    fact: 'L’œil lit une affiche du plus gros au plus petit : le titre, l’image, puis les détails.',
  },
  {
    id: 'publish', item: 'laptop', where: 'sur le laptop', icon: 'paper-plane-tilt', title: 'Publication', Game: SocialPublish,
    brief: 'Annonce notre limonade partout, en ligne et en ville !',
    win: 'Campagne lancée !',
    fact: 'On décline un même visuel pour chaque support : chacun a son format, sa taille et ses contraintes.',
  },
  {
    id: 'print', item: 'printer', where: 'à l’imprimante', icon: 'printer', title: 'Impression pro', Game: ProPrint,
    brief: '200 affiches A3 pour nos vitrines !',
    win: 'Prêtes à afficher !',
    fact: 'Un écran mélange de la lumière (RVB), une imprimante mélange des encres (CMJN).',
  },
];
