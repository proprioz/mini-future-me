// The pages a visitor's phone opens from the QR code: plain HTML, no script, fonts served locally
// (the stand's Wi-Fi may have no Internet). Same "Lagon" palette and pictograms as the game.
import { icon, logoSvg } from '../src/ui/icons.ts';
import { ICON_PATHS, type IconName } from '../src/ui/iconPaths.ts';

/** The trade a poster comes from, as the game sent it (plain text, escaped here). */
export interface PosterTrade {
  title?: string;
  job?: string;
  icon?: string;
  fact?: string;
}

// The game's name and logo (src/trades/index.ts), on every page and when the poster's trade is unknown.
const GAME: { title: string; icon: IconName } = { title: 'Mini Future Me', icon: 'person-arms-spread' };

const favicon = (name: IconName) => `data:image/svg+xml,${encodeURIComponent(logoSvg(name))}`;

/** Text sent by the game, safe inside HTML. */
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
  @font-face { font-family: Fredoka; src: url(/fonts/fredoka.woff2) format('woff2'); font-weight: 300 700; }
  @font-face { font-family: Nunito; src: url(/fonts/nunito.woff2) format('woff2'); font-weight: 200 1000; }
  * { box-sizing: border-box; }
  html { background: #7fd2ca; }
  body {
    margin: 0; min-height: 100vh; padding: 24px 16px 40px;
    background: linear-gradient(180deg, #ccf4ed 0%, #a3e2d9 55%, #7fd2ca 100%);
    color: #1e3a4c; font: 600 17px/1.45 Nunito, system-ui, sans-serif; text-align: center;
  }
  main { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .badge {
    margin: 0; padding: 6px 18px; border-radius: 999px; background: #ff6584; box-shadow: 0 4px 0 #dc3f64;
    color: #fff; font: 600 15px Fredoka, sans-serif; letter-spacing: 0.12em;
  }
  h1 { margin: 4px 0 0; font: 600 32px/1.1 Fredoka, sans-serif; }
  img { display: block; width: 100%; border-radius: 10px; box-shadow: 0 6px 0 rgba(22, 70, 82, 0.15), 0 18px 40px rgba(22, 70, 82, 0.25); }
  .btn {
    display: block; width: 100%; padding: 16px 24px; border-radius: 999px; background: #ff6584; box-shadow: 0 5px 0 #dc3f64;
    color: #fff; font: 600 20px Fredoka, sans-serif; text-decoration: none;
  }
  .btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #dc3f64; }
  .card { width: 100%; padding: 16px 20px; border-radius: 22px; background: #fff; box-shadow: 0 5px 0 #cfe9e4; }
  .card p { margin: 0; }
  .card p + p { margin-top: 8px; }
  .fact { background: #fff6db; box-shadow: 0 5px 0 #f3e2ac; text-align: left; }
  small { color: rgba(30, 58, 76, 0.62); font-size: 14px; }
  .icon { width: 1.25em; height: 1.25em; vertical-align: -0.25em; fill: currentColor; }
  .icon .icon-tint { fill: var(--icon-tint, #8fe3d6); }
  .btn .icon { --icon-tint: rgba(255, 255, 255, 0.35); }
`;

function page(title: string, logo: IconName, body: string) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <link rel="icon" type="image/svg+xml" href="${favicon(logo)}">
  <title>${title}</title>
  <style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

/** `trade`: { title, job, icon, fact } of the trade the poster comes from, as the game sent it. */
export function posterPage(id: string, minutesLeft: number, trade: PosterTrade = {}) {
  const title = escape(trade.title || GAME.title);
  const logo = ICON_PATHS[trade.icon as IconName] ? trade.icon as IconName : GAME.icon;
  const job = escape(trade.job ?? '');
  return page(`Mon affiche · ${title}`, logo, `
    <p class="badge">${GAME.title.toLocaleUpperCase('fr')}</p>
    <h1>Ton affiche ${icon('confetti')}</h1>
    <img src="/p/${id}/image" alt="Ton affiche">
    <a class="btn" href="/p/${id}/image?download">${icon('download-simple')} Enregistrer l’affiche</a>
    <div class="card">
      <p>Sur iPhone, tu peux aussi appuyer longuement sur l’image, puis « Ajouter à Photos ».</p>
      <p><small>Elle sera effacée de notre ordinateur dans ${minutesLeft} min : enregistre-la avant !</small></p>
    </div>
    <div class="card fact">
      <p>${job ? `<b>${icon(logo)} ${job[0].toLocaleUpperCase('fr')}${job.slice(1)}</b> : ` : ''}${escape(trade.fact ?? '')}
      Merci d’être passé·e sur notre stand !</p>
    </div>`);
}

export function expiredPage(ttlMinutes: number) {
  return page(`Affiche introuvable · ${GAME.title}`, GAME.icon, `
    <p class="badge">${GAME.title.toLocaleUpperCase('fr')}</p>
    <h1>Oups, plus d’affiche ici ${icon('smiley-nervous')}</h1>
    <div class="card">
      <p>Les affiches sont effacées ${ttlMinutes} minutes après la partie, pour protéger ta vie privée.</p>
      <p><small>Repasse au stand : on peut t’en refaire une !</small></p>
    </div>`);
}
