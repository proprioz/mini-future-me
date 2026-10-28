import './style.css';
import { TASKS } from './tasks.ts';
import { SKILLS } from './skills.ts';
import { buildStations } from './stations.ts';
import { creation } from './creation.ts';
import { STUDIO } from './decors.ts';
import { PHOTOGRAPHER } from './poses.ts';
import { JOB_CHAPTER } from './about.ts';
import type { TradeModule } from '../types.ts';

// The media trade (médiamaticien·ne CFC): the campaign of "Pétille", a lemonade brand, from the photo
// shoot to the printed posters. Everything the common game asks of a trade is here; see
// docs/adding-a-trade.md for what each field does.
export default {
  // On the welcome screen, between "Toi, en avatar 3D" and "5 minutes de fun": [icon, text].
  welcome: { highlight: ['palette', 'Un métier créatif'] },

  // Visitors may start from their photos (the stand can still turn the scan off with VITE_SCAN=false).
  scan: true,

  // The client's orders, in campaign order, and the domains of the job they train.
  tasks: TASKS,
  skills: SKILLS,
  // Won with the whole campaign: shown on the win screen of the last order.
  finalSkill: 'projects',

  // The work stations of the office (desk and laptop, photo corner, copier).
  buildStations,

  // What the character holds on the poster: the poster laid out in the layout task.
  creation,

  // The poster studio: decors and poses on offer (ids of the shared ones, or the trade's own), the
  // domain that unlocks each, and the titles over the character.
  studio: {
    decors: [STUDIO, 'lagoon', 'party', 'city', 'premiere'],
    poses: ['proud', 'wave', 'cheer', PHOTOGRAPHER, 'hero'],
    unlocks: { party: 'design', city: 'marketing', premiere: 'projects', photographer: 'content', hero: 'projects' },
    titles: [
      { id: 'pro', lines: ['Futur·e', 'médiamaticien·ne'] },
      { id: 'star', lines: ['Star', 'du studio'] },
      { id: 'image', lines: ['Pro', 'de l’image'] },
      { id: 'creative', lines: ['Tête', 'créative'] },
    ],
  },

  // Under the visitor's name on the poster.
  poster: { caption: 'Médiamaticien·ne, un métier à découvrir !' },

  // « Dans les coulisses »: the job chapter, after the common ones.
  about: { chapter: JOB_CHAPTER },

  // On the phone page of the poster, after the download button.
  phone: { fact: 'photo, vidéo, graphisme, sites web, réseaux sociaux… Un métier créatif et technique, qui s’apprend en 4 ans (CFC).' },
} satisfies TradeModule;
