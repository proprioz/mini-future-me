import * as THREE from 'three';
import { PALETTE } from '../render/palette.ts';
import { SCHOOL, drawSchoolQr, loadLogo } from '../poster/school.ts';
import { icon } from './icons.ts';
import type { IconName } from './iconPaths.ts';
import { GAME, scanEnabled } from '../trades/index.ts';
import type { Trade } from '../trades/types.ts';
import type { Character } from '../character/Character.ts';
import type { Expression } from '../character/FaceTexture.ts';
import type { CharacterStage } from '../render/CharacterStage.ts';

// "Dans les coulisses": how the game was made, for visitors curious about the job. The booth team
// shows it and explains it, so each chapter answers one question a visitor may ask: a lead in
// plain words (enough on its own), details for follow-up questions, and the words of the job.
// « Imprimer » lays every chapter out on A4 pages, with still images of the demos.
// « Imprimer la fiche du stand », in the « Vie privée » chapter, prints « Tes données sur ce stand »:
// one A4 page for the booth's table, about what the game does with each piece of data.
// These chapters are common to every trade; each trade of the stand adds its "Le métier" chapter
// (`trade.about.chapter`, same shape) after them. When no trade of the stand uses the photo scan,
// chapters with `needsScan` are left out and `withoutScan` replaces the fields it lists.

/** A chapter of « Dans les coulisses »; a trade's "Le métier" chapter has the same shape. */
export interface Chapter {
  id: string;
  icon: IconName;
  tab: string;
  title: string;
  /** In plain words, enough on its own. */
  lead: string;
  /** Details for follow-up questions: points are [icon, HTML]. */
  blocks: { heading?: string; points: [IconName, string][] }[];
  note?: string;
  /** The words of the job: [word, definition]. */
  words?: [string, string][];
  demo?: 'render' | 'face' | 'scan';
  /** Left out when no trade of the stand uses the photo scan. */
  needsScan?: boolean;
  /** Replaces these fields when no trade of the stand uses the photo scan. */
  withoutScan?: Partial<Chapter>;
  /** Ends with the school's line (where to learn more): the job chapters. */
  school?: boolean;
}

const CHAPTERS: Chapter[] = [
  {
    id: 'web', icon: 'code', tab: 'Le code',
    title: 'Avec quoi ce jeu est-il fait ?',
    lead: 'C’est un site web ! Il s’ouvre dans un navigateur, comme une page Internet, mais tout est sur cet ordinateur : il marche même sans Internet.',
    blocks: [{
      heading: 'Trois langages, trois rôles',
      points: [
        ['file-html', '<b>HTML</b>, le squelette : les textes, les boutons, les images.'],
        ['palette', '<b>CSS</b>, les habits : les couleurs, les polices, les arrondis, les animations.'],
        ['brain', '<b>TypeScript</b>, le cerveau : ce qui se passe quand tu touches l’écran, la 3D, les mini-jeux. C’est du JavaScript qui précise le type de chaque donnée (un nombre, un texte…), pour repérer les erreurs avant même de lancer le jeu.'],
      ],
    }, {
      heading: 'Un jeu open source',
      points: [
        ['users-three', '<b>Le code est ouvert</b> : il est publié en ligne, sous licence libre, et tout le monde peut le lire.'],
        ['download-simple', '<b>Le cloner</b> : en faire sa propre copie sur son ordinateur, pour l’essayer ou s’en servir sur son stand.'],
        ['pencil-simple', '<b>Le modifier</b> : changer un texte, une couleur, une épreuve… et voir tout de suite le résultat.'],
        ['check-circle', '<b>Des tests automatiques</b> : à chaque changement, un programme joue une partie entière, sans Internet, et vérifie les règles du jeu.'],
        ['paper-plane-tilt', '<b>Proposer ses améliorations</b> : envoyer ses changements au projet. Une fois acceptés, ils rejoignent le jeu pour tout le monde.'],
        ['graduation-cap', '<b>Ajouter un métier</b> : chaque école peut y ajouter le sien, avec ses épreuves et son décor, sans refaire le reste du jeu.'],
      ],
    }],
    note: 'Environ 14 500 lignes de TypeScript et 3 700 lignes de CSS.',
    words: [
      ['Langage de programmation', 'une langue précise, que l’ordinateur comprend, pour lui dire quoi faire.'],
      ['Navigateur', 'le programme qui affiche les sites web, sur un ordinateur ou un téléphone.'],
      ['Open source', 'un programme dont le code est public : chacun peut l’étudier, le modifier et le partager.'],
      ['Cloner', 'copier tout le projet sur son ordinateur, avec son historique, pour travailler dessus.'],
      ['Test automatique', 'un petit programme qui vérifie tout seul qu’une partie du jeu marche encore.'],
    ],
  },
  {
    id: '3d', icon: 'cube', tab: 'La 3D',
    title: 'Comment le perso est-il dessiné en 3D ?',
    lead: 'Avec Three.js, une bibliothèque gratuite qui affiche de la 3D dans une page web. Le perso n’a pas été modelé à la main : c’est le code qui l’assemble avec des formes simples.',
    demo: 'render',
    blocks: [{
      points: [
        ['cube', 'Des sphères, des cylindres et des capsules font la tête, le corps, les bras et les cheveux.'],
        ['scan', 'Chaque forme est faite de petits triangles : c’est le <b>maillage</b>.'],
        ['sun', 'Le style dessin animé (<b>cel shading</b>) : une limite nette entre la lumière et l’ombre, et un contour foncé.'],
        ['lightbulb', 'Le perso est éclairé comme en studio photo : une <b>lumière principale</b>, une lumière douce qui éclaircit les ombres et un <b>contre-jour</b> qui détache sa silhouette du fond.'],
        ['eye', 'La caméra du bureau est <b>isométrique</b> : on voit la pièce de biais, sans perspective, comme une maquette.'],
      ],
    }],
    words: [
      ['Bibliothèque (ou librairie)', 'du code tout prêt, écrit par d’autres, qu’on réutilise au lieu de tout refaire.'],
      ['Shader', 'un petit programme qui calcule la couleur de chaque pixel, sur la carte graphique.'],
      ['Éclairage trois points', 'la base de la lumière en photo et en vidéo : une lumière principale, une d’appoint et un contre-jour.'],
    ],
  },
  {
    id: 'face', icon: 'smiley', tab: 'Le visage',
    title: 'Comment le perso change-t-il d’expression ?',
    lead: 'Les yeux, les sourcils et la bouche ne sont pas en 3D : c’est un dessin, refait par le code et collé sur la tête comme un autocollant.',
    demo: 'face',
    blocks: [{
      points: [
        ['pencil-simple', 'Changer d’expression, c’est redessiner cette image : c’est instantané.'],
        ['eye', 'Pour cligner des yeux, le code dessine des yeux fermés pendant une fraction de seconde.'],
        ['eyeglasses', 'Le nez, les cheveux, la barbe et les lunettes, eux, sont en 3D.'],
      ],
    }],
    words: [
      ['Texture', 'une image plaquée sur un objet 3D, comme un papier peint.'],
    ],
  },
  {
    id: 'scan', icon: 'scan', tab: 'Le scan', needsScan: true,
    title: 'Comment le jeu analyse-t-il mes photos ?',
    lead: 'Il trouve ton visage, colorie les zones de la photo, fait des mesures, puis choisit l’option la plus proche dans « Crée ton perso ». Tout se passe sur cet ordinateur.',
    demo: 'scan',
    blocks: [{
      heading: 'En 4 étapes',
      points: [
        ['magnifying-glass', '<b>Trouver le visage.</b> Un modèle d’IA de Google (MediaPipe) place 478 points : le contour, les yeux, les iris, le nez, la bouche.'],
        ['palette', '<b>Colorier les zones.</b> Un deuxième modèle range chaque pixel : fond, cheveux, peau, vêtements ou accessoire.'],
        ['target', '<b>Mesurer.</b> Avec les points et les zones, le code fait des mesures simples (exemples ci-dessous).'],
        ['check-circle', '<b>Choisir.</b> Une mesure nette l’emporte. Si elle hésite, le jeu prend l’option la plus courante en Suisse, d’après des enquêtes publiées.'],
      ],
    }, {
      heading: 'Exemples de mesures',
      points: [
        ['drop', 'Le teint : la couleur de la peau sur les joues.'],
        ['hair-dryer', 'Les cheveux longs : des cheveux qui descendent plus bas que le menton.'],
        ['eyeglasses', 'Les lunettes : des pixels « accessoire » devant les yeux et sur le nez.'],
        ['mustache', 'La moustache : le dessus de la lèvre plus foncé que les joues.'],
        ['t-shirt', 'La couleur du haut : juste sous le menton, et sur la photo de dos.'],
      ],
    }],
    words: [
      ['Modèle d’IA', 'un programme qui a appris à partir de milliers d’exemples, par exemple à trouver un visage sur une photo.'],
      ['Pixel', 'un des petits points de couleur qui forment une image.'],
      ['Segmentation', 'découper une image en zones : ici les cheveux, la peau, les habits.'],
    ],
  },
  {
    id: 'privacy', icon: 'shield-check', tab: 'Vie privée',
    title: 'Est-ce que le jeu sait qui je suis ?',
    lead: 'Non. Il détecte un visage, mais il ne le reconnaît pas : il ne sait pas à qui il appartient, et il l’oublie aussitôt.',
    blocks: [{
      points: [
        ['magnifying-glass', '<b>Détecter</b>, c’est trouver où sont les yeux et la bouche. <b>Reconnaître</b>, ce serait retrouver ton nom en comparant avec d’autres visages : le jeu ne le fait pas.'],
        ['lock-simple', 'Tes photos restent dans la mémoire de l’ordinateur pendant l’analyse, puis le jeu les oublie, et l’équipe du stand efface les fichiers juste après. Rien n’est envoyé sur Internet.'],
        ['user-circle', 'Pour proposer un premier look, le scan devine aussi ton âge et ton genre d’après la photo. Il ne les garde pas, et tu peux tout changer ensuite.'],
        ['brain', 'Les modèles d’IA ont appris avant, chez leurs créateurs. Ici, ils appliquent ce qu’ils savent, sans rien apprendre de toi.'],
        ['clock-countdown', 'Seule ton affiche va sur le petit serveur du stand, et elle est effacée après 30 minutes.'],
        ['hand-waving', 'Avant le scan, le jeu explique tout et te demande ton accord. Tu peux aussi créer ton perso à la main.'],
      ],
    }],
    words: [
      ['Données personnelles', 'tout ce qui permet de savoir qui tu es : ton visage, ton nom, ta voix…'],
      ['nLPD', 'la loi suisse sur la protection des données : ce que l’on a le droit de faire avec les données des gens.'],
    ],
    withoutScan: {
      lead: 'Non. Le jeu ne voit pas ton visage : ton perso, c’est toi qui le crées, et il est oublié à la fin de la partie.',
      blocks: [{
        points: [
          ['user-circle', 'Ton perso n’existe que pendant ta partie. Rien n’est envoyé sur Internet.'],
          ['clock-countdown', 'Seule ton affiche va sur le petit serveur du stand, et elle est effacée après 30 minutes.'],
          ['arrow-counter-clockwise', 'À la fin, le jeu se remet à zéro pour la personne suivante.'],
        ],
      }],
    },
  },
  {
    id: 'ai', icon: 'robot', tab: 'L’IA',
    title: 'Une IA a-t-elle aidé à fabriquer ce jeu ?',
    lead: 'Oui ! Une grande partie du code a été écrite par une IA spécialisée dans la programmation. Mais elle ne travaille pas seule : un·e spécialiste du web la guide, vérifie et corrige.',
    blocks: [{
      heading: 'Ce que l’IA apporte',
      points: [
        ['clock-countdown', '<b>Ça va beaucoup plus vite</b> : le jeu a été construit en quelques jours, au lieu de plusieurs mois.'],
        ['puzzle-piece', '<b>Des outils complexes deviennent accessibles</b> : la 3D, la détection de visage ou les shaders demandent d’habitude des années de pratique.'],
        ['lightbulb', '<b>On peut essayer plus d’idées</b> : tester plusieurs versions d’un écran et garder la meilleure.'],
        ['chat-circle-dots', '<b>Elle explique</b> : on peut lui demander pourquoi un code marche, et apprendre en le lisant.'],
      ],
    }, {
      heading: 'Ce que le ou la spécialiste fait',
      points: [
        ['clipboard-text', '<b>Décider</b> : quel jeu, pour qui, dans quel style, avec quelles règles. Tout a commencé par un plan écrit.'],
        ['chat-circle', '<b>Expliquer précisément</b> ce qu’on veut : une demande floue donne un résultat flou.'],
        ['bug', '<b>Juger la qualité</b> : l’IA se trompe parfois, avec beaucoup d’assurance. Il faut bien connaître le web (HTML, CSS, JavaScript, 3D) pour voir ce qui ne va pas.'],
        ['wrench', '<b>Tester et retoucher</b> : chaque écran est essayé, regardé sur plusieurs tailles d’écran, puis corrigé.'],
        ['shield-check', '<b>Rester responsable</b> : la protection des données, les droits d’auteur, la qualité finale, c’est l’humain qui en répond.'],
      ],
    }],
    note: 'L’IA est un outil puissant, comme un bon appareil photo : il faut savoir s’en servir pour obtenir une bonne image. L’IA qui a écrit le code n’est pas dans le jeu : ici, seuls les petits modèles du scan tournent.',
    words: [
      ['IA générative', 'une IA qui produit du texte, des images ou du code à partir d’une demande.'],
      ['Prompt', 'la demande écrite qu’on donne à l’IA.'],
    ],
    withoutScan: {
      note: 'L’IA est un outil puissant, comme un bon appareil photo : il faut savoir s’en servir pour obtenir une bonne image. L’IA qui a écrit le code n’est pas dans le jeu.',
    },
  },
];

/**
 * « Tes données sur ce stand »: one A4 page to lay on the booth's table for visitors, parents and
 * teachers, printed from the « Vie privée » chapter. It says what the game does with each piece of data,
 * from the photos to the poster.
 */
function standSheet(scan: boolean): Pick<Chapter, 'title' | 'lead' | 'blocks'> {
  const contact = `Une question ? Demande à l’équipe du stand${SCHOOL.name ? `, ou à ${SCHOOL.name}` : ''}.`;
  return {
    title: 'Tes données sur ce stand',
    lead: scan
      ? 'Ce que le jeu fait de tes photos, de ton perso et de ton affiche, du début à la fin de ta partie. Tout se passe sur l’ordinateur du stand : rien n’est envoyé sur Internet.'
      : 'Ce que le jeu fait de ton perso et de ton affiche, du début à la fin de ta partie. Tout se passe sur l’ordinateur du stand : rien n’est envoyé sur Internet.',
    blocks: [
      ...(scan ? [{
        heading: 'Tes photos',
        points: [
          ['camera', 'Seulement si tu choisis « Avec mes photos » : l’équipe du stand les prend, de face, et si tu veux de profil et de dos.'],
          ['laptop', 'Le jeu les analyse sur cet ordinateur pour proposer un premier look à ton perso, puis il les oublie dès la fin du scan.'],
          ['trash', 'L’équipe du stand efface les photos de l’ordinateur et de l’appareil photo juste après ton scan.'],
        ],
      }, {
        heading: 'Ce que le scan mesure',
        points: [
          ['palette', 'Des couleurs et des formes : ton teint, la couleur de tes yeux et de tes cheveux, ta coiffure, une barbe, des lunettes, la couleur de ton haut.'],
          ['user-circle', 'Il devine aussi ton âge et ton genre d’après la photo, juste pour partir du look le plus probable. Tu peux tout changer ensuite.'],
          ['magnifying-glass', 'Il détecte un visage, mais il ne le reconnaît pas : il ne sait pas qui tu es.'],
        ],
      }] satisfies Chapter['blocks'] : []),
      {
        heading: 'Ton perso et ton prénom',
        points: [
          ['user', 'C’est toi qui les choisis. Ils restent dans la mémoire de l’ordinateur pendant ta partie et sont effacés à la fin, quand le jeu se remet à zéro.'],
        ],
      },
      {
        heading: 'Ton affiche',
        points: [
          ['device-mobile', 'Pour le QR code, elle va sur le petit serveur du stand, que seul le Wi-Fi du stand peut joindre, et elle est effacée après 30 minutes.'],
          ['printer', 'Si tu l’imprimes, la feuille est à toi.'],
        ],
      },
      {
        heading: 'Tu décides',
        points: [
          scan
            ? ['hand-waving', 'Tu peux créer ton perso à la main, sans photos, et arrêter quand tu veux.']
            : ['hand-waving', 'Tu peux arrêter quand tu veux : le jeu se remet à zéro pour la personne suivante.'],
          ['chat-circle', contact],
        ],
      },
    ],
  };
}

const EXPRESSION_NAMES: Record<Expression, string> ={ neutral: 'Neutre', happy: 'Joie', surprised: 'Surprise', wink: 'Clin d’œil', focused: 'Concentration' };

// Demo materials for the « La 3D » chapter: plain shapes, then their triangles (light surfaces, so
// that only the edges facing the camera show).
interface RenderMode {
  id: string;
  label: string;
  material?: THREE.Material;
  edges?: THREE.LineBasicMaterial;
}

const RENDERS: RenderMode[] = [
  { id: 'final', label: 'Rendu final' },
  { id: 'shapes', label: 'Formes', material: new THREE.MeshNormalMaterial({ flatShading: true }) },
  {
    id: 'mesh', label: 'Triangles', edges: new THREE.LineBasicMaterial({ color: PALETTE.tealDeep }),
    material: new THREE.MeshBasicMaterial({ color: PALETTE.mist, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  },
];

/** French spacing: no-break space before ? ! : ; » and after «. */
const fr = (text: string) => text.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');

export class AboutPanel {
  el: HTMLElement;
  trades: Trade[];
  scan: boolean;
  chapters: Chapter[];
  character: Character;
  stage: CharacterStage;
  page: HTMLElement;
  tabs: HTMLButtonElement[];
  chapter: number;
  renderMode?: string;

  /**
   * `el`: the card to fill; `character` and `stage`: the welcome screen's character and its scene,
   * used by the 3D demos and photographed for the printed version; `trades`: the trades of the stand.
   */
  constructor(el: HTMLElement, character: Character, stage: CharacterStage, trades: Trade[]) {
    this.el = el;
    this.trades = trades;
    // One job chapter per trade, named after its job when there are several; the school's line
    // (where to learn more) ends each of them.
    this.scan = trades.some(scanEnabled);
    const common = CHAPTERS.filter((c) => this.scan || !c.needsScan).map((c) => (this.scan ? c : { ...c, ...c.withoutScan }));
    this.chapters = [...common, ...trades.map((trade) => ({
      ...trade.about.chapter,
      id: `job-${trade.id}`,
      tab: trades.length > 1 ? trade.name : trade.about.chapter.tab,
      school: true,
    }))];
    this.character = character;
    this.stage = stage;
    this.el.innerHTML = `
      <header class="about-head">
        <div class="welcome-badge"><span class="hud-logo">${icon('gear-six')}</span>Dans les coulisses</div>
        <div class="about-head-actions">
          <button class="btn btn-ghost about-print-button" data-print>${icon('printer')} Imprimer</button>
          <button class="mg-close" data-choice="back" aria-label="Fermer">${icon('x')}</button>
        </div>
      </header>
      <div class="about-body">
        <nav class="about-tabs">
          ${this.chapters.map((c, i) => `<button class="about-tab" data-chapter="${i}">${icon(c.icon)}<span>${fr(c.tab)}</span></button>`).join('')}
        </nav>
        <article class="about-page"></article>
      </div>`;
    this.page = this.el.querySelector<HTMLElement>('.about-page')!;
    this.tabs = [...this.el.querySelectorAll<HTMLButtonElement>('.about-tab')];
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.chapter = 0;
  }

  open() {
    this.show(0);
  }

  /** Leaves the character as the welcome screen expects it. */
  close() {
    this.stopDemo();
  }

  onClick(e: MouseEvent) {
    const tab = (e.target as Element).closest<HTMLElement>('[data-chapter]');
    if (tab) this.show(Number(tab.dataset.chapter));
    const render = (e.target as Element).closest<HTMLElement>('[data-render]');
    if (render) this.setRender(render.dataset.render!);
    const expression = (e.target as Element).closest<HTMLElement>('[data-expression]');
    if (expression) this.setExpression(expression.dataset.expression as Expression);
    const step = (e.target as Element).closest<HTMLElement>('[data-step-by]');
    if (step) this.show(this.chapter + Number(step.dataset.stepBy));
    if ((e.target as Element).closest('[data-print]')) this.print((logo) => this.printMarkup(logo));
    if ((e.target as Element).closest('[data-print-sheet]')) this.print((logo) => this.sheetMarkup(logo));
  }

  show(index: number) {
    this.stopDemo();
    this.chapter = index;
    const c = this.chapters[index];
    this.tabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
    this.tabs[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const prev = this.chapters[index - 1];
    const next = this.chapters[index + 1];
    this.page.innerHTML = `
      <h1>${fr(c.title)}</h1>
      ${chapterBody(c, c.demo && this.demoMarkup(c.demo))}
      ${c.id === 'privacy' ? `<button class="btn btn-ghost about-sheet-button" data-print-sheet>${icon('printer')} Imprimer la fiche du stand</button>` : ''}
      <footer class="about-nav">
        ${prev ? `<button class="btn btn-ghost" data-step-by="-1">${icon('arrow-left')} ${fr(prev.tab)}</button>` : '<span></span>'}
        ${next ? `<button class="btn btn-ghost" data-step-by="1">${fr(next.tab)} ${icon('arrow-right')}</button>` : ''}
      </footer>`;
    this.page.scrollTop = 0;
    if (c.demo === 'face') this.setExpression('happy');
  }

  demoMarkup(demo: NonNullable<Chapter['demo']>) {
    if (demo === 'render') {
      return `<p class="about-demo-hint">${icon('hand-pointing')} Regarde le perso pendant que tu changes de vue.</p>
        <div class="about-toggles">${RENDERS.map((r) => `<button class="about-toggle${r.id === 'final' ? ' active' : ''}" data-render="${r.id}">${r.label}</button>`).join('')}</div>`;
    }
    if (demo === 'face') {
      return `<canvas class="about-face" width="256" height="256" aria-label="Le dessin du visage"></canvas>
        <div>
          <p class="about-demo-hint">L’image collée sur la tête du perso :</p>
          <div class="about-toggles">${Object.entries(EXPRESSION_NAMES).map(([id, label]) => `<button class="about-toggle" data-expression="${id}">${fr(label)}</button>`).join('')}</div>
        </div>`;
    }
    return scanDiagram();
  }

  setRender(id: string) {
    const { material, edges } = RENDERS.find((r) => r.id === id)!;
    const meshes: THREE.Mesh[] = [];
    this.character.rig.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
    for (const o of meshes) {
      if (o.userData.outline) {
        o.visible = !material;
        continue;
      }
      o.userData.finalMaterial ??= o.material;
      o.material = material ?? o.userData.finalMaterial;
      if (o.userData.edges) {
        o.userData.edges.geometry.dispose();
        o.remove(o.userData.edges);
        delete o.userData.edges;
      }
      if (edges) o.add(o.userData.edges = new THREE.LineSegments(new THREE.WireframeGeometry(o.geometry), edges));
    }
    this.renderMode = id;
    for (const b of this.page.querySelectorAll<HTMLElement>('[data-render]')) b.classList.toggle('active', b.dataset.render === id);
  }

  setExpression(expression: Expression) {
    this.character.setExpression(expression);
    this.character.hop();
    const canvas = this.page.querySelector<HTMLCanvasElement>('.about-face')!;
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    // The middle of the face canvas, where the eyes, brows and mouth are.
    const face = this.character.faceTexture.canvas;
    const crop = face.width * 0.6;
    g.drawImage(face, (face.width - crop) / 2, face.height * 0.2, crop, crop, 0, 0, canvas.width, canvas.height);
    for (const b of this.page.querySelectorAll<HTMLElement>('[data-expression]')) b.classList.toggle('active', b.dataset.expression === expression);
  }

  stopDemo() {
    if (this.renderMode && this.renderMode !== 'final') this.setRender('final');
    this.character.setExpression('neutral');
  }

  // ---------- « Imprimer »: every chapter on A4 pages, or the stand's data sheet ----------

  /**
   * Prints `markup(logo)` from a sheet laid over the page only for the printer (see @media print).
   * `logo`: the school's logo image, or null (its name is written instead).
   */
  async print(markup: (logo: HTMLImageElement | null) => string) {
    document.querySelector('.about-print')?.remove();
    const sheet = document.createElement('article');
    sheet.className = 'about-print';
    sheet.innerHTML = markup(await loadLogo());
    document.body.append(sheet);
    await Promise.all([document.fonts.ready, ...[...sheet.querySelectorAll('img')].map((img) => img.decode().catch(() => {}))]);
    window.addEventListener('afterprint', () => sheet.remove(), { once: true });
    window.print();
  }

  /** Every chapter, after a cover with the contents. */
  printMarkup(logo: HTMLImageElement | null) {
    const shots = this.photographDemos();
    const figures = (list: [string, string][]) => list.map(([caption, src]) => `
      <figure><img src="${src}" alt=""><figcaption>${fr(caption)}</figcaption></figure>`).join('');
    const demos = {
      render: figures(shots.renders),
      face: figures(shots.faces),
      scan: scanDiagram(),
    };
    const { trades } = this;
    const game = trades.length === 1 ? trades[0] : GAME;
    const names = trades.map((t) => t.job);
    const jobs = names.length === 1 ? `le métier de ${names[0]}`
      : `les métiers de ${names.slice(0, -1).join(', ')} et ${names.at(-1)}`;
    return `
      <header class="print-cover">
        <div>
          <div class="welcome-badge"><span class="hud-logo">${icon(game.icon)}</span>${game.title}</div>
          <h1>Dans les coulisses du jeu</h1>
          <p class="print-intro">${fr(`Comment ce jeu a été fabriqué, expliqué simplement : le code, la 3D${this.scan ? ', le scan du visage' : ''}, l’IA et ${jobs}.`)}</p>
          <ol class="print-contents">${this.chapters.map((c) => `<li>${icon(c.icon)}${fr(c.tab)}</li>`).join('')}</ol>
        </div>
        <img class="print-hero" src="${shots.renders[0][1]}" alt="">
      </header>
      ${this.chapters.map((c, i) => `
        <section class="print-chapter">
          <div class="print-chapter-top">
            <header>
              <span class="print-chapter-icon">${icon(c.icon)}</span>
              <div><p class="print-kicker">${i + 1} · ${fr(c.tab)}</p><h2>${fr(c.title)}</h2></div>
            </header>
            <p class="about-lead">${fr(c.lead)}</p>
          </div>
          ${chapterBody(c, c.demo && demos[c.demo], { lead: false, school: false })}
        </section>`).join('')}
      ${schoolFooter(logo)}`;
  }

  /** « Tes données sur ce stand », on a single page. */
  sheetMarkup(logo: HTMLImageElement | null) {
    const sheet = standSheet(this.scan);
    const { trades } = this;
    const game = trades.length === 1 ? trades[0] : GAME;
    return `
      <header class="print-cover">
        <div>
          <div class="welcome-badge"><span class="hud-logo">${icon(game.icon)}</span>${game.title}</div>
          <h1>${fr(sheet.title)}</h1>
          <p class="print-intro">${fr(sheet.lead)}</p>
        </div>
        <span class="print-cover-icon">${icon('shield-check')}</span>
      </header>
      <section class="print-chapter">
        ${chapterBody(sheet, null, { lead: false, school: false })}
      </section>
      ${schoolFooter(logo)}`;
  }

  /** Still images of the demos: the character in each render and expression. */
  photographDemos() {
    const { character, stage } = this;
    const { renderMode = 'final' } = this;
    const { expression } = character.faceTexture;
    const heading = character.group.rotation.y;
    const size = stage.renderer.getSize(new THREE.Vector2());
    character.group.rotation.y = 0;
    character.faceTexture.setBlink(false);
    stage.setSize(480, 600); // framed like the printed figures, whatever the screen

    const renders = RENDERS.map((r): [string, string] => {
      this.setRender(r.id);
      stage.render();
      return [r.label, stage.canvas.toDataURL('image/png')];
    });
    this.setRender(renderMode);

    const face = character.faceTexture.canvas;
    const crop = face.width * 0.6;
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 320;
    const faces = Object.entries(EXPRESSION_NAMES).map(([id, label]): [string, string] => {
      character.setExpression(id as Expression);
      const g = thumb.getContext('2d')!;
      g.clearRect(0, 0, thumb.width, thumb.height);
      g.drawImage(face, (face.width - crop) / 2, face.height * 0.2, crop, crop, 0, 0, thumb.width, thumb.height);
      return [label, thumb.toDataURL('image/png')];
    });
    character.setExpression(expression);
    character.group.rotation.y = heading;
    stage.setSize(size.x, size.y);
    stage.render();
    return { renders, faces };
  }
}

/**
 * Everything a chapter says, below its title: on screen with the live demo, on paper with its images
 * (the lead then stays with the title, and the school footer replaces the school's line).
 */
function chapterBody(c: Pick<Chapter, 'lead' | 'blocks' | 'demo' | 'note' | 'school' | 'words'>, demo: string | null | undefined,
  { lead = true, school = true } = {}) {
  return `
    ${lead ? `<p class="about-lead">${fr(c.lead)}</p>` : ''}
    ${demo ? `<div class="about-demo about-demo-${c.demo}">${demo}</div>` : ''}
    ${c.blocks.map((b) => `
      ${b.heading ? `<h3 class="about-heading">${fr(b.heading)}</h3>` : ''}
      <ul class="about-points">${b.points.map(([name, text]) => `<li><span>${icon(name)}</span><p>${fr(text)}</p></li>`).join('')}</ul>
    `).join('')}
    ${c.note ? `<p class="about-note">${icon('lightbulb')}<span>${fr(c.note)}</span></p>` : ''}
    ${c.school && school && SCHOOL.site ? `<p class="about-note">${icon('graduation-cap')}<span>${fr(`Infos sur la formation et le métier : ${SCHOOL.site}`)}</span></p>` : ''}
    ${c.words ? `
      <h3 class="about-heading">Les mots du métier</h3>
      <dl class="about-words">${c.words.map(([term, def]) => `<div><dt>${fr(term)}</dt><dd>${fr(def)}</dd></div>`).join('')}</dl>` : ''}`;
}

/** The school's block at the end of a printed sheet, when the stand has a school. */
function schoolFooter(logo: HTMLImageElement | null) {
  if (!SCHOOL.url) return '';
  return `
    <footer class="print-school">
      ${logo ? `<img src="${logo.src}" alt="${SCHOOL.name}">` : `<b class="print-school-name">${SCHOOL.name}</b>`}
      <p>${fr(`Infos sur la formation et le métier : <b>${SCHOOL.site}</b> ou scanne le code`)}</p>
      <img class="print-qr" src="${schoolQr()}" alt="">
    </footer>`;
}

/** The QR code of the school website, as an image for the printed sheet. */
function schoolQr() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  drawSchoolQr(canvas.getContext('2d')!, 0, 0, 400, PALETTE.ink);
  return canvas.toDataURL('image/png');
}

// ---------- « Le scan »: the four steps on a drawn portrait ----------

const PHOTO = { bg: '#dce6ea', hair: '#5b3a29', skin: '#e9b993', neck: '#d9a47e', top: '#3d6fb6', ink: PALETTE.ink };
const ZONES = { bg: PALETTE.mist, hair: PALETTE.sun, skin: PALETTE.coral, neck: PALETTE.blush, top: PALETTE.teal };

/** A plain drawn portrait (100 × 100), in photo colours or in the colours of the segmentation zones. */
function portrait(colors: Omit<typeof PHOTO, 'ink'> & { ink?: string }, { features = true } = {}) {
  return `
    <rect width="100" height="100" rx="10" fill="${colors.bg}"/>
    <path d="M24,74 C22,48 26,16 50,16 C74,16 78,48 76,74 Z" fill="${colors.hair}"/>
    <rect x="43" y="58" width="14" height="18" fill="${colors.neck}"/>
    <path d="M12,100 C14,80 30,73 50,73 C70,73 86,80 88,100 Z" fill="${colors.top}"/>
    <ellipse cx="50" cy="44" rx="16" ry="20" fill="${colors.skin}"/>
    <path d="M33,42 C32,22 68,22 67,42 C62,31 44,28 33,42 Z" fill="${colors.hair}"/>
    ${features ? `<g fill="${colors.ink}">
      <ellipse cx="44" cy="46" rx="1.8" ry="2.2"/><ellipse cx="56" cy="46" rx="1.8" ry="2.2"/>
      <path d="M45,56 Q50,59.5 55,56" fill="none" stroke="${colors.ink}" stroke-width="1.4" stroke-linecap="round"/>
    </g>` : ''}`;
}

/** A few of the landmarks, drawn as dots: face contour, brows, eyes, nose and mouth. */
function landmarks() {
  const dots: [number, number][] = [];
  const ring = (cx: number, cy: number, rx: number, ry: number, n: number, from = 0, to = Math.PI * 2) => {
    for (let i = 0; i < n; i++) {
      const a = from + (to - from) * (i / (to - from === Math.PI * 2 ? n : n - 1));
      dots.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
  };
  ring(50, 44, 16, 20, 28);
  ring(44, 46, 3.6, 2.2, 8);
  ring(56, 46, 3.6, 2.2, 8);
  ring(44, 41.5, 4.5, 1.6, 5, Math.PI * 1.1, Math.PI * 1.9);
  ring(56, 41.5, 4.5, 1.6, 5, Math.PI * 1.1, Math.PI * 1.9);
  ring(50, 56.5, 5, 1.8, 10);
  for (const y of [46, 49, 52]) dots.push([50, y]);
  dots.push([47.5, 53], [52.5, 53]);
  return dots.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.1"/>`).join('');
}

function chibi() {
  return `
    <rect width="100" height="100" rx="10" fill="${PALETTE.mist}"/>
    <path d="M36,100 C36,84 42,80 50,80 C58,80 64,84 64,100 Z" fill="${PHOTO.top}"/>
    <path d="M22,62 C18,28 30,10 50,10 C70,10 82,28 78,62 Z" fill="${PHOTO.hair}"/>
    <circle cx="50" cy="48" r="26" fill="${PHOTO.skin}"/>
    <path d="M24,46 C22,18 78,18 76,46 C66,30 40,28 24,46 Z" fill="${PHOTO.hair}"/>
    <g fill="${PHOTO.ink}"><ellipse cx="41" cy="52" rx="3" ry="4.2"/><ellipse cx="59" cy="52" rx="3" ry="4.2"/></g>
    <ellipse cx="35" cy="60" rx="4" ry="2.4" fill="${PALETTE.blush}" opacity="0.7"/>
    <ellipse cx="65" cy="60" rx="4" ry="2.4" fill="${PALETTE.blush}" opacity="0.7"/>
    <path d="M45,63 Q50,67 55,63" fill="none" stroke="${PHOTO.ink}" stroke-width="1.8" stroke-linecap="round"/>`;
}

function scanDiagram() {
  const steps = [
    ['Ta photo', portrait(PHOTO)],
    ['478 points', `<g opacity="0.6">${portrait(PHOTO)}</g><g fill="${PALETTE.coral}">${landmarks()}</g>`],
    ['Les zones', portrait(ZONES, { features: false })],
    ['Ton perso', chibi()],
  ];
  return steps.map(([label, svg], i) => `
    ${i ? `<span class="about-arrow">${icon('arrow-right')}</span>` : ''}
    <figure><svg viewBox="0 0 100 100" aria-hidden="true">${svg}</svg><figcaption>${i + 1}. ${label}</figcaption></figure>`).join('');
}
