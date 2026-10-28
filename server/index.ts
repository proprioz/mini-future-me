// Stand server: receives the finished posters from the game and serves them to the visitors' phones
// (the QR code points to http://<local IP>:<port>/p/<id>), and serves the built game itself.
//
//   pnpm start    build the game, then serve everything on http://localhost:3000
//   pnpm server   API and phone pages only, next to `pnpm dev` (Vite forwards /api here)
//   pnpm essai    frozen build in dist-essai/ on http://localhost:3100, to play while the code changes
//
// Environment: PORT (3000), PUBLIC_HOST (address put in the QR code, detected if absent),
// WIFI_NAME (stand network, shown next to the QR code), POSTER_TTL_MINUTES (30),
// DIST (folder of the built game, dist).

import express, { type Request } from 'express';
import { existsSync } from 'node:fs';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { PosterStore } from './PosterStore.ts';
import { posterPage, expiredPage } from './phonePages.ts';

const PORT = Number(process.env.PORT) || 3000;
const TTL_MINUTES = Number(process.env.POSTER_TTL_MINUTES) || 30;
const WIFI_NAME = process.env.WIFI_NAME || '';
const ROOT = new URL('..', import.meta.url);
const DIST = fileURLToPath(new URL(`${process.env.DIST || 'dist'}/`, ROOT));
const FONTS: Record<string, string> = {
  'fredoka.woff2': 'node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2',
  'nunito.woff2': 'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2',
};

/** The PC's address on the stand network: private IPv4 first (192.168.x, 10.x, 172.16–31.x). */
function lanAddress() {
  const addresses = (Object.values(networkInterfaces()).flat() as NetworkInterfaceInfo[])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  const isPrivate = (ip: string) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return addresses.find(isPrivate) ?? addresses[0] ?? null;
}

/** Only the PC itself may upload posters or play; phones on the Wi-Fi just get their poster. */
function fromThisPc(req: Request) {
  return (['127.0.0.1', '::1', '::ffff:127.0.0.1'] as (string | undefined)[]).includes(req.socket.remoteAddress);
}

const store = new PosterStore({ ttl: TTL_MINUTES * 60_000, max: 100 });
const app = express();
app.disable('x-powered-by');

// ------------------------------------------------------------ phones

app.get('/fonts/:file', (req, res) => {
  const file = FONTS[req.params.file];
  if (!file) return res.sendStatus(404);
  res.sendFile(fileURLToPath(new URL(file, ROOT)), { maxAge: '1d' });
});

app.get('/p/:id', (req, res) => {
  const poster = store.get(req.params.id);
  res.set('Cache-Control', 'no-store');
  if (!poster) return res.status(404).type('html').send(expiredPage(TTL_MINUTES));
  res.type('html').send(posterPage(req.params.id, store.minutesLeft(poster), poster.trade));
});

app.get('/p/:id/image', (req, res) => {
  const poster = store.get(req.params.id);
  if (!poster) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  if ('download' in req.query) res.attachment(poster.fileName);
  res.type(poster.type).send(poster.image);
});

// ------------------------------------------------------------ the game (this PC only)

app.use((req, res, next) => (fromThisPc(req) ? next() : res.sendStatus(403)));

app.post('/api/posters', express.raw({ type: 'image/jpeg', limit: '20mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'image JPEG attendue' });
  const name = String(req.query.name ?? '');
  const fileName = /^[a-z0-9-]{1,60}\.jpg$/.test(name) ? name : 'affiche.jpg';
  // The trade the poster comes from, for its phone page: plain text, escaped there.
  const text = (key: string) => String(req.query[key] ?? '').slice(0, 300);
  const trade = { title: text('title'), job: text('job'), icon: text('icon'), fact: text('fact') };
  const id = store.add({ image: req.body, type: 'image/jpeg', fileName, trade });
  const host = process.env.PUBLIC_HOST || lanAddress();
  res.json({
    id,
    url: `http://${host ?? 'localhost'}:${PORT}/p/${id}`,
    network: Boolean(host), // false: no network found, phones can't reach this PC
    wifi: WIFI_NAME,
    ttlMinutes: TTL_MINUTES,
  });
});

/** Forgets every poster (end of the day, or from the kiosk's reset). */
app.delete('/api/posters', (req, res) => {
  store.clear();
  res.sendStatus(204);
});

if (existsSync(DIST)) {
  app.use(express.static(DIST));
} else {
  app.get('/', (req, res) => res.type('text').send('Jeu pas encore construit : lance `pnpm start`, ou `pnpm dev` en développement.'));
}

app.listen(PORT, '0.0.0.0', () => {
  const host = process.env.PUBLIC_HOST || lanAddress();
  console.log(`Mini Future Me : http://localhost:${PORT}`);
  console.log(host
    ? `Affiches pour les téléphones : http://${host}:${PORT}/p/…${WIFI_NAME ? ` (Wi-Fi « ${WIFI_NAME} »)` : ''}`
    : 'Aucun réseau trouvé : les téléphones ne pourront pas récupérer les affiches.');
  console.log(`Affiches gardées en mémoire ${TTL_MINUTES} min, jamais écrites sur le disque.`);
});
