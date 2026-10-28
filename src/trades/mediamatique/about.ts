import type { Chapter } from '../../ui/AboutPanel.ts';

// The "Le métier" chapter of « Dans les coulisses » (ui/AboutPanel.ts): what the job is, which parts
// of it the visitor met in the game, and which not. Same shape as the common chapters there.
export const JOB_CHAPTER: Chapter = {
  // Six fields of the federal training plan (ordonnance sur la formation de médiamaticien·ne CFC, art. 4)
  // and the tasks listed by orientation.ch, each tied to what the visitor did in the game.
  id: 'job', icon: 'graduation-cap', tab: 'Le métier',
  title: 'Et le métier de médiamaticien·ne, dans tout ça ?',
  lead: 'Un métier entre l’informatique, le multimédia, le marketing et la communication. Ce jeu en montre une bonne partie, mais pas tout.',
  blocks: [{
    heading: 'Ce qu’on apprend, et où on le voit dans le jeu',
    points: [
      ['camera', '<b>Produire des contenus</b> : préparer un tournage ou une séance photo, filmer, photographier, enregistrer, puis retoucher et publier. <i>Dans le jeu</i> : le shooting de la limonade et la retouche photo.'],
      ['palette', '<b>Concevoir des visuels</b> : maquettes, éléments graphiques, mises en page adaptées à chaque support. <i>Dans le jeu</i> : la mise en page de l’affiche, et tout le style du jeu : couleurs, polices, pictogrammes.'],
      ['megaphone', '<b>Marketing et communication</b> : imaginer une campagne, créer des supports imprimés et numériques, animer les réseaux sociaux. <i>Dans le jeu</i> : l’impression pro et la publication sur les bons supports.'],
      ['code', '<b>Informatique</b> : installer ses outils, créer des sites web, les rendre interactifs, gérer des données sur un serveur. <i>Dans le jeu</i> : le jeu entier est un site web interactif, et un petit serveur envoie ton affiche sur ton téléphone.'],
      ['clipboard-text', '<b>Mener des projets</b> : comprendre ce que veut le client, planifier, suivre le travail, le rendre à temps. <i>Dans le jeu</i> : les commandes du client, réalisées une par une, et ce jeu lui-même, construit étape par étape d’après un plan.'],
      ['users-three', '<b>Gestion d’entreprise</b> : répondre aux demandes, organiser des réunions et des événements. <i>Dans le jeu</i> : ce stand est un événement, avec une équipe pour t’accueillir.'],
    ],
  }, {
    heading: 'Aussi dans le métier, mais pas dans ce jeu',
    points: [
      ['video-camera', 'Filmer et monter des vidéos, créer des animations et du stop motion.'],
      ['microphone', 'Enregistrer du son, l’améliorer, ajouter de la musique.'],
      ['chat-circle', 'Écrire des textes pour une entreprise, gérer de vrais comptes de réseaux sociaux, analyser les besoins d’un client et de son marché.'],
      ['receipt', 'Préparer des offres et des factures, écrire aux clients et aux fournisseurs, parfois dans une autre langue.'],
      ['hard-drives', 'Installer, entretenir et sécuriser le matériel : ordinateurs, caméras, micros.'],
    ],
  }, {
    heading: 'Les qualités utiles',
    points: [
      ['sparkle', 'La créativité, le sens de la communication, une méthode de travail, le goût de la technique, l’esprit d’équipe, et l’envie de suivre les nouvelles technologies, comme l’IA.'],
    ],
  }],
  note: 'La formation dure 4 ans et donne un CFC : en entreprise avec des cours à l’école professionnelle, ou en école à plein temps. Avec une maturité professionnelle, on peut ensuite continuer dans une haute école.',
  words: [
    ['CFC', 'le certificat fédéral de capacité, le diplôme de fin d’apprentissage.'],
    ['Maturité professionnelle', 'un diplôme en plus du CFC, qui ouvre les portes des hautes écoles spécialisées.'],
    ['TIC', 'les technologies de l’information et de la communication : ordinateurs, réseaux, logiciels.'],
  ],
};
