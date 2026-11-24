import * as THREE from 'three';
import { Character, DEFAULT_LOOK, type Look } from '../character/Character.ts';
import { CharacterStage } from '../render/CharacterStage.ts';
import { Thumbnailer } from '../render/Thumbnailer.ts';
import { PortraitAnalyzer } from '../scan/PortraitAnalyzer.ts';
import { logReport } from '../scan/classify.ts';
import { PhotoSlots, SLOTS, type PhotoSources, type SlotName } from './PhotoSlots.ts';
import { AnalysisView, type Finding } from './AnalysisView.ts';
import { icon } from './icons.ts';

/**
 * Fictional people (AI-generated photos in public/samples/<id>/, one per slot), for visitors without
 * photos of their own. Offered only when the stand turns them on: VITE_SAMPLE_PHOTOS=true in .env.local.
 */
export const SAMPLE_PEOPLE = /^(true|1|on|oui)$/i.test(import.meta.env.VITE_SAMPLE_PHOTOS ?? '')
  ? [
      { id: 'noa', name: 'Noa' },
      { id: 'robin', name: 'Robin' },
      { id: 'sacha', name: 'Sacha' },
      { id: 'alex', name: 'Alex' },
    ]
  : [];

/** The photos of the sample person `id`, by slot (front.jpg, profile.jpg, back.jpg; only the front one is required). */
async function samplePhotos(id: string) {
  const photos = await Promise.all(SLOTS.map(async ({ name, required }) => {
    const response = await fetch(`${import.meta.env.BASE_URL}samples/${id}/${name}.jpg`);
    const image = response.ok && response.headers.get('content-type')?.startsWith('image/');
    if (!image && required) throw new Error(`Photo d'exemple introuvable : ${id}/${name}.jpg`);
    return image ? [[name, new File([await response.blob()], `${name}.jpg`, { type: 'image/jpeg' })]] : [];
  }));
  return Object.fromEntries(photos.flat()) as Partial<Record<SlotName, File>>;
}

const DRAG_TURN = 0.012; // radians per dragged pixel, as in « Crée ton perso »

// How the avatar turns in each slot's guide: seen from the front, looking towards the left of the photo,
// and from the back.
const GUIDE_HEADINGS: Record<SlotName, number> = { front: 0, profile: -Math.PI / 2, back: Math.PI };
// A portrait: the whole head, a little room above it, and the shoulders.
const GUIDE_VIEW = { target: new THREE.Vector3(0, 1.01, 0), height: 1.15, width: 1.15, lift: 0.05 };

/** The default avatar framed and turned the way each photo should be (head and shoulders), as image URLs. */
function renderGuides() {
  const thumbnailer = new Thumbnailer(512);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const guides = Object.fromEntries(SLOTS.map(({ name }) => {
    thumbnailer.draw(canvas, DEFAULT_LOOK, { view: GUIDE_VIEW, heading: GUIDE_HEADINGS[name], expression: 'neutral' });
    return [name, canvas.toDataURL('image/png')];
  })) as Record<SlotName, string>;
  thumbnailer.stage.renderer.dispose();
  thumbnailer.stage.renderer.forceContextLoss();
  return guides;
}

type ScanState = 'photos' | 'analyzing' | 'done' | 'error';

/** Panel of a state: `go` / `skip` are button labels (HTML). */
interface StateOptions {
  instruction: string;
  hint?: string;
  go?: string;
  skip?: string;
  onGo?: (() => void) | null;
  onSkip?: (() => void) | null;
}

/**
 * "Scanne tes photos": the visitor gives one to four portrait photos (front, profiles, back), then
 * watches the animated analysis. `run()` resolves with a partial look, or null if the visitor skipped.
 */
export class ScanScreen {
  el: HTMLDivElement;
  photos: PhotoSlots;
  analysis: AnalysisView;
  instructionEl: HTMLElement;
  hintEl: HTMLElement;
  skipButton: HTMLButtonElement;
  goButton: HTMLButtonElement;
  stage: CharacterStage;
  character: Character;
  timer: THREE.Timer;
  analyzerPromise?: Promise<PortraitAnalyzer> | null;
  guided: boolean;
  finish!: (look: Partial<Look> | null) => void;
  onGo?: (() => void) | null;
  onSkip?: (() => void) | null;
  look!: Partial<Look>;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'scan';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="scan-area"></div>
      <section class="scan-panel">
        <h1 class="scan-title">Scanne tes photos</h1>
        <div class="scan-avatar">
          <span class="scan-avatar-hint" title="Fais-moi tourner">${icon('hand-swipe-right')}</span>
        </div>
        <p class="scan-instruction" aria-live="polite"></p>
        <p class="scan-hint"></p>
        <p class="scan-pick">Touche une case&nbsp;: tu peux choisir plusieurs photos d’un coup.</p>
        ${SAMPLE_PEOPLE.length ? `<div class="scan-samples">
          <p>Pas de photos&nbsp;? Prends une personne inventée par une IA&nbsp;:</p>
          <div class="scan-samples-list">${SAMPLE_PEOPLE.map(({ id, name }) => `
            <button type="button" class="scan-sample" data-sample="${id}">
              <img src="${import.meta.env.BASE_URL}samples/${id}/thumb.jpg" alt="">${name}
            </button>`).join('')}
          </div>
        </div>` : ''}
        <p class="scan-privacy">${icon('lock-simple')} Les photos restent sur cet appareil et sont oubliées dès que tu continues :
          on garde seulement des couleurs et des formes.</p>
        <footer class="scan-actions">
          <button class="btn btn-ghost" data-action="skip"></button>
          <button class="btn btn-primary" data-action="go"></button>
        </footer>
      </section>
    `;
    root.appendChild(this.el);

    const areaEl = this.el.querySelector<HTMLElement>('.scan-area')!;
    this.photos = new PhotoSlots(areaEl, {
      sort: (bitmaps) => this.sortPhotos(bitmaps),
      onChange: () => this.updatePhotoState(),
      onError: () => {
        this.hintEl.textContent = 'Je n’arrive pas à lire cette photo. Essaie une photo en JPG ou en PNG '
          + '(sur iPhone, les photos HEIC ne marchent pas ici).';
      },
    });
    this.analysis = new AnalysisView(areaEl);
    this.instructionEl = this.el.querySelector<HTMLElement>('.scan-instruction')!;
    this.hintEl = this.el.querySelector<HTMLElement>('.scan-hint')!;
    this.skipButton = this.el.querySelector<HTMLButtonElement>('[data-action="skip"]')!;
    this.goButton = this.el.querySelector<HTMLButtonElement>('[data-action="go"]')!;

    const avatarEl = this.el.querySelector<HTMLElement>('.scan-avatar')!;
    this.stage = new CharacterStage({ pedestal: false });
    this.stage.setView('head');
    avatarEl.appendChild(this.stage.canvas);
    new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = avatarEl;
      if (!w || !h) return;
      this.stage.setSize(w, h);
      this.stage.render(); // a resize clears the canvas: no blank frame while the analysis holds the page
    }).observe(avatarEl);
    this.character = new Character();
    this.stage.scene.add(this.character.group);
    this.timer = new THREE.Timer();
    this.guided = false; // the slots' guides are drawn the first time the screen shows

    // Drag (mouse or finger) on the avatar to spin it.
    let drag: { id: number; x: number } | null = null;
    avatarEl.addEventListener('pointerdown', (e) => {
      drag = { id: e.pointerId, x: e.clientX };
      avatarEl.setPointerCapture(e.pointerId);
      avatarEl.classList.add('dragging');
    });
    avatarEl.addEventListener('pointermove', (e) => {
      if (drag?.id !== e.pointerId) return;
      this.character.targetHeading += (e.clientX - drag.x) * DRAG_TURN;
      drag.x = e.clientX;
    });
    const endDrag = () => {
      drag = null;
      avatarEl.classList.remove('dragging');
    };
    avatarEl.addEventListener('pointerup', endDrag);
    avatarEl.addEventListener('pointercancel', endDrag);

    this.skipButton.addEventListener('click', () => this.onSkip?.());
    this.goButton.addEventListener('click', () => this.onGo?.());
    for (const button of this.el.querySelectorAll<HTMLElement>('[data-sample]')) {
      button.addEventListener('click', () => this.useSample(button.dataset.sample!));
    }
  }

  /** Shows the screen on the photo slots; resolves with the scanned look parameters, or null. */
  run() {
    // Start loading the models while the visitor picks their photos.
    this.analyzerPromise ??= PortraitAnalyzer.create();
    this.analyzerPromise.catch(() => {}); // reported when it is needed
    this.character.setLook(DEFAULT_LOOK);
    if (!this.guided) this.photos.setGuides(renderGuides());
    this.guided = true;
    this.el.hidden = false;
    this.el.classList.remove('leaving');
    this.timer.reset();
    this.stage.renderer.setAnimationLoop((t) => this.tick(t));

    return new Promise<Partial<Look> | null>((resolve) => {
      this.finish = (look) => {
        this.el.dataset.state = 'closed';
        this.forgetPhotos();
        this.el.classList.add('leaving');
        setTimeout(() => {
          this.el.hidden = true;
          this.stage.renderer.setAnimationLoop(null);
        }, 350);
        resolve(look);
      };
      this.showPhotos();
    });
  }

  /**
   * Panel text and buttons for a state. `go` / `skip` are button labels (HTML, hidden if absent) and
   * `onGo` / `onSkip` their actions, which never outlive the state.
   */
  setState(state: ScanState, { instruction, hint = '', go, skip, onGo = null, onSkip = null }: StateOptions) {
    this.el.dataset.state = state;
    // The photo screen shows the head; the analysis and its result, the whole body.
    if (state === 'photos') this.stage.setView('head');
    else this.stage.setView('stage', this.character.group);
    this.onGo = onGo;
    this.onSkip = onSkip;
    this.instructionEl.textContent = instruction;
    this.hintEl.textContent = hint;
    for (const [button, label] of [[this.goButton, go], [this.skipButton, skip]] as [HTMLButtonElement, string | undefined][]) {
      button.hidden = !label;
      button.innerHTML = label ?? '';
      button.disabled = false;
    }
  }

  showError() {
    if (this.el.dataset.state === 'closed') return; // skipped while loading
    this.setState('error', {
      instruction: 'Oups, l’analyse ne marche pas sur cet appareil. Pas grave : tu vas créer ton perso à la main !',
      go: 'Continuer',
      onGo: () => this.finish(null),
    });
  }

  showPhotos() {
    this.setState('photos', {
      instruction: 'Ajoute une photo de toi de face, cadrée comme un portrait\u00a0: toute ta tête et tes épaules.',
      go: `${icon('magnifying-glass')} Analyser`,
      skip: 'Passer',
      onGo: () => this.runAnalysis(this.photos.sources()),
      onSkip: () => this.finish(null),
    });
    this.goButton.disabled = !this.photos.ready;
  }

  updatePhotoState() {
    if (this.el.dataset.state !== 'photos') return;
    this.goButton.disabled = !this.photos.ready;
    this.hintEl.textContent = this.photos.sorting ? 'Je range tes photos…' : '';
  }

  /** Puts the photos of the sample person `id` in the slots and analyses them. */
  async useSample(id: string) {
    if (this.el.dataset.state !== 'photos') return;
    this.hintEl.textContent = '';
    try {
      await this.photos.fill(await samplePhotos(id));
    } catch (error) {
      console.warn('Photos d’exemple impossibles à charger :', error);
      this.hintEl.textContent = 'Je n’arrive pas à charger ces photos.';
      return;
    }
    if (this.el.dataset.state === 'photos' && this.photos.ready) this.runAnalysis(this.photos.sources());
  }

  /** Slot of each photo picked together, guessed from the face it shows (null when unsure). */
  async sortPhotos(bitmaps: ImageBitmap[]) {
    try {
      const analyzer = (await this.analyzerPromise)!;
      return bitmaps.map((bitmap) => {
        const view = analyzer.guessView(bitmap);
        return view === 'left' || view === 'right' ? 'profile' : view;
      });
    } catch (error) {
      console.warn('Tri des photos impossible :', error);
      return bitmaps.map(() => null);
    }
  }

  /** Analyses `sources` ({ front, left, right, back }), then replays the findings. */
  async runAnalysis(sources: PhotoSources) {
    this.character.heading = this.character.targetHeading = 0;
    this.setState('analyzing', { instruction: 'J’analyse tes photos…' });
    this.analysis.preview(sources);
    this.el.classList.add('busy');
    let result: Awaited<ReturnType<PortraitAnalyzer['analyze']>>;
    try {
      const analyzer = (await this.analyzerPromise)!;
      if (this.el.dataset.state !== 'analyzing') return;
      // The analysis can hold the page for seconds: the message and its animation go on screen first
      // (Safari needs a little time after the frame to take the animation over).
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100)));
      // The analyzer reads a profile from either side: the profile goes in as its left view.
      const { profile, ...others } = sources;
      result = await analyzer.analyze({ ...others, left: profile });
    } catch (error) {
      console.warn('Analyse impossible :', error);
      this.analyzerPromise = null;
      this.showError();
      return;
    } finally {
      this.el.classList.remove('busy');
    }
    logReport(result.report);
    if (!result.features.face) {
      this.analysis.clear();
      this.showPhotos();
      this.hintEl.textContent = 'Je ne trouve pas de visage sur la photo de face : essaie une photo plus nette, bien de face, avec toute ta tête.';
      return;
    }

    // The avatar stays the default one: each finding changes only what it found, straight to its final
    // value, and what no photo shows (trousers, shoes…) comes at the end.
    this.look = {};
    this.setState('analyzing', {
      instruction: 'Regarde ce que je repère sur tes photos…',
      skip: 'Passer l’animation',
      onSkip: () => this.analysis.skip(),
    });
    await this.analysis.play({ ...result, views: { ...result.views, profile: result.views.left } }, (finding) => this.addFinding(finding, result.look));
    if (this.el.dataset.state !== 'analyzing') return;

    this.look = result.look;
    this.character.setLook({ ...DEFAULT_LOOK, ...this.look });
    this.showDone();
  }

  /** Each finding sets the options it found on the avatar, as in `look`, as the animation reaches it. */
  addFinding(finding: Finding, look: Partial<Look>) {
    if (finding.patch) {
      for (const key of Object.keys(finding.patch) as (keyof Look)[]) Object.assign(this.look, { [key]: look[key] });
      this.character.setLook({ ...DEFAULT_LOOK, ...this.look });
      this.stage.setView('stage', this.character.group); // room for headwear
      this.character.setExpression('happy');
    }
    if (finding.final) this.character.hop();
  }

  /** Photos are dropped as soon as they are no longer shown. */
  forgetPhotos() {
    this.photos.clear();
    this.analysis.clear();
  }

  restart() {
    this.forgetPhotos();
    this.character.setLook(DEFAULT_LOOK);
    this.showPhotos();
  }

    showDone() {
    this.character.setExpression('happy');
    this.character.hop();
    this.setState('done', {
      instruction: 'Voilà ce que j’ai trouvé ! Tu pourras tout changer à l’étape suivante.',
      go: 'Continuer',
      skip: 'Recommencer',
      onGo: () => this.finish(this.look),
      onSkip: () => this.restart(),
    });
  }

  tick(timestamp: number) {
    this.timer.update(timestamp);
    this.character.update(Math.min(this.timer.getDelta(), 0.05), this.timer.getElapsed());
    this.stage.render();
  }
}
