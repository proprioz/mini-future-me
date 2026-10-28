import * as THREE from 'three';
import { Character } from '../character/Character.ts';
import { POSES, applyPose } from '../character/poses.ts';
import { likelyLook } from '../character/options.ts';
import { CharacterStage } from '../render/CharacterStage.ts';
import { sound } from '../kiosk/sound.ts';
import { kiosk } from '../kiosk/kiosk.ts';
import { icon } from './icons.ts';
import { AboutPanel } from './AboutPanel.ts';
import { GAME, scanEnabled } from '../trades/index.ts';
import type { Trade } from '../trades/types.ts';

const NEW_LOOK_EVERY = 3.5; // seconds between two random characters
const ABOUT_IDLE = 120; // seconds without a touch before « Dans les coulisses » goes back to the attract screen
const WAVE = POSES.find((p) => p.id === 'wave');
// The whole character on its pedestal, with room for the hop.
const VIEW = { target: new THREE.Vector3(0, 0.42, 0), height: 2.45, width: 1.9, lift: 0.5 };

/** How the visitor starts: from portrait photos, or creating the character by hand. */
export type WelcomeStart = 'photos' | 'manual';

export interface WelcomeResult {
  start: WelcomeStart;
  trade: Trade;
}

type Resolve = (result: WelcomeResult) => void;

/**
 * Welcome screen of the stand: a random character waves to the passers-by until someone touches the
 * screen; then, when the stand shows several trades, a card to pick one; then, when the trade uses the
 * photo scan (trades/index.ts), a short consent card explains what the photos are used for.
 * « Dans les coulisses » explains how the game was made, for the booth team to show to curious visitors.
 * `trades`: the trades the stand shows (loaded, see trades/index.ts).
 * `run()` resolves with { start, trade }: `start` is 'photos' (analyse portrait photos) or 'manual'
 * (create the character by hand), `trade` the trade picked.
 */
export class WelcomeScreen {
  trades: Trade[];
  trade: Trade | null;
  el: HTMLDivElement;
  stage: CharacterStage;
  character: Character;
  about: AboutPanel;
  timer: THREE.Timer;
  nextLook: number;
  soundButton: HTMLButtonElement;

  constructor(root: HTMLElement, trades: Trade[]) {
    this.trades = trades;
    this.trade = trades.length === 1 ? trades[0] : null;
    const { trade } = this;
    this.el = document.createElement('div');
    this.el.className = 'welcome';
    this.el.dataset.step = 'attract';
    this.el.innerHTML = `
      <div class="welcome-stage"></div>
      <section class="welcome-card welcome-attract">
        <div class="welcome-badge"><span class="hud-logo">${icon((trade ?? GAME).icon)}</span>${(trade ?? GAME).title}</div>
        <h1>Entre dans le jeu&nbsp;!</h1>
        <p>Glisse-toi dans un jeu vidéo et découvre un métier fun${trade ? `&nbsp;: ${trade.job}` : ''}.</p>
        <ul class="welcome-highlights">
          <li><span>${icon(trades.some(scanEnabled) ? 'scan' : 'user-circle')}</span>Toi, en avatar 3D</li>
          ${trade
            ? `<li><span>${icon(trade.welcome.highlight[0])}</span>${trade.welcome.highlight[1]}</li>`
            : `<li><span>${icon('graduation-cap')}</span>${trades.length} métiers à essayer</li>`}
          <li><span>${icon('confetti')}</span>5 minutes de fun</li>
        </ul>
        <button class="btn btn-primary welcome-play">${icon('play')} Touche pour jouer</button>
        <button class="welcome-about-open" data-choice="about">${icon('gear-six')} Comment ce jeu est fabriqué</button>
      </section>
      <section class="welcome-card welcome-about" role="dialog" aria-label="Dans les coulisses"></section>
      <section class="welcome-card welcome-trade" role="dialog" aria-label="Choisis un métier">
        <h1>Choisis un métier</h1>
        <div class="welcome-trades">${trades.map((t) => `
          <button class="welcome-trade-option" data-trade="${t.id}">
            <span>${icon(t.icon)}</span>
            <span><b>${t.name}</b><small>${t.pitch}</small></span>
          </button>`).join('')}
        </div>
        <button class="welcome-back" data-choice="back">${icon('arrow-left')} Retour</button>
      </section>
      <section class="welcome-card welcome-consent" role="dialog" aria-label="Avant de commencer">
        <h1>Avant de commencer</h1>
        <p>Tu vas devenir un perso de jeu vidéo&nbsp;! Avec des photos de toi, il te ressemblera comme un vrai clone numérique.</p>
        <ul class="welcome-points">
          <li><span>${icon('laptop')}</span>Tes photos sont traitées ici, sur cet ordinateur.</li>
          <li><span>${icon('user-circle')}</span>Le jeu devine aussi ton âge et ton genre, juste pour un premier look : tu pourras tout changer.</li>
          <li><span>${icon('lock-simple')}</span>Rien n’est conservé : à la fin, tout est effacé automatiquement.</li>
        </ul>
        <div class="welcome-actions">
          <button class="btn btn-primary" data-choice="photos">${icon('images')} Avec mes photos</button>
          <button class="btn btn-ghost welcome-manual" data-choice="manual">Sans photos, à la main</button>
        </div>
        <button class="welcome-back" data-choice="back">${icon('arrow-left')} Retour</button>
      </section>
      <button class="welcome-sound" aria-label="Son"></button>
    `;
    root.appendChild(this.el);

    this.stage = new CharacterStage();
    this.stage.setView(VIEW);
    this.el.querySelector('.welcome-stage')!.appendChild(this.stage.canvas);
    this.character = new Character(this.randomVisitor());
    this.stage.scene.add(this.character.group);
    this.about = new AboutPanel(this.el.querySelector<HTMLElement>('.welcome-about')!, this.character, this.stage, trades);
    this.timer = new THREE.Timer();
    this.nextLook = NEW_LOOK_EVERY;

    const stageEl = this.el.querySelector<HTMLElement>('.welcome-stage')!;
    new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = stageEl;
      if (w && h) this.stage.setSize(w, h);
    }).observe(stageEl);

    this.soundButton = this.el.querySelector<HTMLButtonElement>('.welcome-sound')!;
    this.soundButton.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.setMuted(!sound.muted);
      this.updateSoundButton();
    });
    this.updateSoundButton();
  }

  /** A plausible visitor: frequent traits, genders not mixed (only the visitor's « Au hasard » does). */
  randomVisitor() {
    return likelyLook(Math.random() < 0.5 ? 'f' : 'm');
  }

  updateSoundButton() {
    this.soundButton.innerHTML = icon(sound.muted ? 'speaker-slash' : 'speaker-high');
    this.soundButton.setAttribute('aria-pressed', String(!sound.muted));
  }

  run() {
    this.timer.reset();
    this.stage.renderer.setAnimationLoop((t) => this.tick(t));
    return new Promise<WelcomeResult>((resolve) => {
      // Anywhere on the attract screen starts; the consent card needs an explicit choice.
      this.el.addEventListener('click', (e) => {
        const choice = (e.target as Element).closest<HTMLElement>('[data-choice]')?.dataset.choice;
        if (choice === 'about') {
          this.el.dataset.step = 'about';
          this.about.open();
          return;
        }
        if (this.el.dataset.step === 'attract') {
          this.character.setExpression('happy');
          this.character.hop();
          sound.play('pop');
          if (this.trades.length > 1) this.el.dataset.step = 'trade';
          else this.afterTrade(resolve);
          return;
        }
        const picked = (e.target as Element).closest<HTMLElement>('[data-trade]')?.dataset.trade;
        if (picked) {
          this.trade = this.trades.find((t) => t.id === picked)!;
          this.character.hop();
          sound.play('pop');
          this.afterTrade(resolve);
          return;
        }
        if (choice === 'back' && this.el.dataset.step === 'consent' && this.trades.length > 1) this.el.dataset.step = 'trade';
        else if (choice === 'back') this.backToAttract();
        else if (choice) this.close(choice as WelcomeStart, resolve);
      });
    });
  }

  /** Once the trade is known: the consent card before the photos, or straight to "Crée ton perso". */
  afterTrade(resolve: Resolve) {
    if (scanEnabled(this.trade!)) this.el.dataset.step = 'consent';
    else this.close('manual', resolve);
  }

  backToAttract() {
    if (this.el.dataset.step === 'about') this.about.close();
    this.el.dataset.step = 'attract';
  }

  close(choice: WelcomeStart, resolve: Resolve) {
    this.el.classList.add('leaving');
    setTimeout(() => {
      this.stage.renderer.setAnimationLoop(null);
      this.el.remove();
    }, 450);
    resolve({ start: choice, trade: this.trade! });
  }

  tick(timestamp: number) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const time = this.timer.getElapsed();

    // A new visitor-to-be every few seconds while nobody plays.
    this.nextLook -= dt;
    if (this.nextLook <= 0 && this.el.dataset.step === 'attract') {
      this.nextLook = NEW_LOOK_EVERY;
      this.character.setLook(this.randomVisitor());
      this.character.hop();
    }
    // Someone left « Dans les coulisses » open: back to the waving characters.
    if (this.el.dataset.step === 'about' && performance.now() - kiosk.lastActivity > ABOUT_IDLE * 1000) this.backToAttract();
    this.character.targetHeading = Math.sin(time * 0.6) * 0.35;
    this.character.update(dt, time);
    if (this.character.hopTime < 0) {
      applyPose(this.character, WAVE);
      this.character.arms.find((a) => a.shoulder.userData.side > 0)!.elbow.rotation.z += Math.sin(time * 7) * 0.35;
    }
    this.stage.render();
  }
}
