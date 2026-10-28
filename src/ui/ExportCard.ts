import QRCode from 'qrcode';
import { kiosk } from '../kiosk/kiosk.ts';
import { sound } from '../kiosk/sound.ts';
import { downloadPdf, downloadPng, printPoster, sharePoster } from '../poster/exporters.ts';
import { icon } from './icons.ts';

const DONE_LABEL = `${icon('flag-checkered')} J’ai fini !`;
// PNG and PDF files would pile up in the booth PC's Downloads, with the visitor's first name: at the
// booth, the poster leaves by QR code or on paper. The files stay for development and tests.
const FILES = import.meta.env.DEV;
const FALLBACK = FILES ? 'imprime ou enregistre ton affiche' : 'imprime ton affiche';

/**
 * "Ton affiche est prête !" card over the studio: the poster at print size, and the ways to take it
 * home (QR code for the phone, print, and PNG or PDF in development). `open(render, name)` resolves when
 * the card is closed.
 */
export class ExportCard {
  root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async open(render: () => HTMLCanvasElement, name: string) {
    const el = document.createElement('div');
    el.className = 'minigame export';
    el.innerHTML = `
      <section class="mg-card export-card" role="dialog" aria-label="Ton affiche est prête">
        <header class="mg-head">
          <span class="mg-icon">${icon('image')}</span>
          <div class="mg-heading"><small>A4 · 300 dpi</small><h1>Ton affiche est prête !</h1></div>
          <button class="mg-close" aria-label="Fermer">${icon('x')}</button>
        </header>
        <div class="export-body">
          <div class="export-preview"><span>Un instant…</span></div>
          <div class="export-actions">
            <div class="export-share" data-state="loading">
              <div class="export-qr"><canvas width="360" height="360" aria-label="QR code de ton affiche"></canvas></div>
              <div class="export-share-text">
                <b>${icon('device-mobile')} Sur ton téléphone</b>
                <p>Un instant…</p>
              </div>
            </div>
            <button class="btn btn-primary" data-action="print" disabled>${icon('printer')} Imprimer</button>
            ${FILES ? `<div class="export-files">
              <button class="btn btn-ghost" data-action="png" disabled>${icon('file-png')} Image PNG</button>
              <button class="btn btn-ghost" data-action="pdf" disabled>${icon('file-pdf')} PDF</button>
            </div>` : ''}
            <p class="export-status" role="status"></p>
            <button class="btn btn-ghost export-done" data-action="done">${DONE_LABEL}</button>
          </div>
        </div>
      </section>`;
    this.root.appendChild(el);
    // Scanning the QR code with a phone means no touch on the screen for a while.
    const restoreIdle = kiosk.extend(180);
    this.bindDone(el.querySelector<HTMLButtonElement>('[data-action="done"]')!);
    const closed = new Promise<void>((resolve) => {
      const close = () => {
        restoreIdle();
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 250);
        resolve();
      };
      el.querySelector('.mg-close')!.addEventListener('click', close);
      el.addEventListener('click', (e) => {
        if (e.target === el) close();
      });
    });

    // Let the card appear before the heavy render (a few hundred ms).
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
    const canvas = render();
    const preview = el.querySelector('.export-preview')!;
    preview.innerHTML = '';
    const image = new Image();
    image.alt = 'Ton affiche';
    image.src = canvas.toDataURL('image/jpeg', 0.85);
    preview.appendChild(image);

    this.share(el.querySelector<HTMLElement>('.export-share')!, canvas, name);

    const status = el.querySelector('.export-status')!;
    const actions: Record<string, [() => Promise<unknown>, string]> = {
      print: [() => printPoster(canvas), 'Impression…'],
      png: [() => downloadPng(canvas, name), `${icon('check')} Enregistrée dans Téléchargements`],
      pdf: [() => downloadPdf(canvas, name), `${icon('check')} Enregistré dans Téléchargements`],
    };
    for (const [action, [run, done]] of Object.entries(actions)) {
      const button = el.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (!button) continue;
      button.disabled = false;
      button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = 'Un instant…';
        await run();
        status.innerHTML = done;
        button.disabled = false;
      });
    }

    return closed;
  }

  /** "J'ai fini !" ends the game for the next visitor, after a second tap to confirm. */
  bindDone(button: HTMLButtonElement) {
    let armed: ReturnType<typeof setTimeout> | null = null;
    button.addEventListener('click', () => {
      if (armed) {
        kiosk.reset();
        return;
      }
      button.textContent = 'Sûr·e ? Touche encore';
      button.classList.add('armed');
      armed = setTimeout(() => {
        armed = null;
        button.innerHTML = DONE_LABEL;
        button.classList.remove('armed');
      }, 4000);
    });
  }

  /** Sends the poster to the stand server and shows the QR code that opens it on a phone. */
  async share(el: HTMLElement, canvas: HTMLCanvasElement, name: string) {
    const text = el.querySelector('p')!;
    try {
      const { url, network, wifi, ttlMinutes } = await sharePoster(canvas, name);
      if (!network) {
        el.dataset.state = 'error';
        text.textContent = `Pas de réseau : ${FALLBACK}.`;
        return;
      }
      const qr = el.querySelector('canvas')!;
      await QRCode.toCanvas(qr, url, {
        width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e3a4c', light: '#ffffff' },
      });
      qr.removeAttribute('style'); // the library sets its pixel size inline; the CSS sizes it
      el.dataset.state = 'ready';
      sound.play('sparkle');
      text.innerHTML = `Scanne ce code
        ${wifi ? `sur le Wi-Fi <b class="nowrap">« ${escapeHtml(wifi)} »</b>` : 'sur le Wi-Fi du stand'}.
        <small>Effacée dans ${ttlMinutes} min · ${escapeHtml(url)}</small>`;
    } catch {
      el.dataset.state = 'error';
      text.textContent = `Partage indisponible : ${FALLBACK}.`;
    }
  }
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
