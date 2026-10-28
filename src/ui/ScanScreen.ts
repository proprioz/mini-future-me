import * as THREE from 'three';
import { Character, DEFAULT_LOOK, type Look } from '../character/Character.ts';
import { CharacterStage } from '../render/CharacterStage.ts';
import { PortraitAnalyzer } from '../scan/PortraitAnalyzer.ts';
import { logReport } from '../scan/classify.ts';
import { PhotoSlots, type PhotoSources } from './PhotoSlots.ts';
import { AnalysisView, type Finding } from './AnalysisView.ts';
import { icon } from './icons.ts';

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
  findingsEl: HTMLUListElement;
  instructionEl: HTMLElement;
  hintEl: HTMLElement;
  skipButton: HTMLButtonElement;
  goButton: HTMLButtonElement;
  stage: CharacterStage;
  character: Character;
  timer: THREE.Timer;
  analyzerPromise?: Promise<PortraitAnalyzer> | null;
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
        <div class="scan-avatar"></div>
        <p class="scan-instruction" aria-live="polite"></p>
        <p class="scan-hint"></p>
        <ul class="scan-findings" aria-live="polite"></ul>
        <p class="scan-privacy">${icon('lock-simple')} Les photos restent sur cet ordinateur et sont oubliées dès que tu continues :
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
    this.findingsEl = this.el.querySelector<HTMLUListElement>('.scan-findings')!;
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
      if (w && h) this.stage.setSize(w, h);
    }).observe(avatarEl);
    this.character = new Character();
    this.stage.scene.add(this.character.group);
    this.timer = new THREE.Timer();

    this.skipButton.addEventListener('click', () => this.onSkip?.());
    this.goButton.addEventListener('click', () => this.onGo?.());
  }

  /** Shows the screen on the photo slots; resolves with the scanned look parameters, or null. */
  run() {
    // Start loading the models while the visitor picks their photos.
    this.analyzerPromise ??= PortraitAnalyzer.create();
    this.analyzerPromise.catch(() => {}); // reported when it is needed
    this.character.setLook(DEFAULT_LOOK);
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
      instruction: 'Oups, l’analyse ne marche pas sur cet ordinateur. Pas grave : tu vas créer ton perso à la main !',
      go: 'Continuer',
      onGo: () => this.finish(null),
    });
  }

  showPhotos() {
    this.setState('photos', {
      instruction: 'Ajoute une photo de toi de face, et si tu veux de profil et de dos. Touche une case : tu peux en choisir plusieurs d’un coup.',
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

  /** Slot of each photo picked together, guessed from the face it shows (null when unsure). */
  async sortPhotos(bitmaps: ImageBitmap[]) {
    try {
      const analyzer = (await this.analyzerPromise)!;
      return bitmaps.map((bitmap) => analyzer.guessView(bitmap));
    } catch (error) {
      console.warn('Tri des photos impossible :', error);
      return bitmaps.map(() => null);
    }
  }

  /** Analyses `sources` ({ front, left, right, back }), then replays the findings. */
  async runAnalysis(sources: PhotoSources) {
    this.setState('analyzing', { instruction: 'J’analyse tes photos…' });
    this.findingsEl.replaceChildren();
    let result: Awaited<ReturnType<PortraitAnalyzer['analyze']>>;
    try {
      const analyzer = (await this.analyzerPromise)!;
      if (this.el.dataset.state !== 'analyzing') return;
      result = await analyzer.analyze(sources);
    } catch (error) {
      console.warn('Analyse impossible :', error);
      this.analyzerPromise = null;
      this.showError();
      return;
    }
    logReport(result.report);
    if (!result.features.face) {
      this.showPhotos();
      this.hintEl.textContent = 'Je ne trouve pas de visage sur la photo de face : essaie une photo plus nette, bien de face.';
      return;
    }

    this.setState('analyzing', {
      instruction: 'Regarde ce que je repère sur tes photos…',
      skip: 'Passer l’animation',
      onSkip: () => this.analysis.skip(),
    });
    // The avatar starts as the most likely look for the visitor's gender and age, then each finding
    // refines it.
    this.look = { ...result.base };
    this.character.setLook({ ...DEFAULT_LOOK, ...this.look });
    await this.analysis.play(result, (finding) => this.addFinding(finding));
    if (this.el.dataset.state !== 'analyzing') return;

    this.look = result.look;
    this.character.setLook({ ...DEFAULT_LOOK, ...this.look });
    this.showDone();
  }

  addFinding(finding: Finding) {
    const item = document.createElement('li');
    item.innerHTML = `<span class="scan-finding-icon">${icon(finding.icon)}</span>
      <span><b>${finding.title}</b> ${finding.value}</span>
      ${finding.color ? `<i class="scan-finding-color" style="--c:${finding.color}"></i>` : ''}`;
    this.findingsEl.append(item);
    item.scrollIntoView({ block: 'nearest' });
    if (finding.patch) {
      Object.assign(this.look, finding.patch);
      this.character.setLook({ ...DEFAULT_LOOK, ...this.look });
      this.character.setExpression('happy');
    }
    if (finding.final) this.character.hop();
  }

  /** Photos are dropped as soon as they are no longer shown. */
  forgetPhotos() {
    this.photos.clear();
    this.analysis.clear();
    this.findingsEl.replaceChildren();
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
