# Plan — Mini Future Me

[Version française](PLAN.fr.md)

A 100 % web game, in TypeScript, hosted locally on one PC, for a **booth** at a career fair, to let visitors
discover a trade. Sessions are short (≈ 5 min) and visitors follow one another: the game makes **short, simple demos** of a
few gestures of a trade, without trying to show everything. It suits indoor trades best, or trades whose
work partly fits in a single room (office, IT, workshop and creative trades, reception, care and service trades, and many more),
but the limit is imagination. It plays with a mouse, but
everything must also work by touch.

The game is built for several **trades**: a **common engine** (welcome, scan, avatar, office, poster
studio, export, kiosk mode) and, for each trade, a module that brings its tasks, its domains of the job,
its work stations, the object the avatar holds on the poster and its texts (`src/trades/<id>/`, see
`docs/adding-a-trade.md`). The first trade is media technology, **Mini Future Me Médiamaticien·ne**; other trades may take the
game up.

## How a game goes

```
Welcome (+ trade choice when there are several) + consent
  → Visitor's photos (1 to 4: front, profiles, back) analysed
  → Avatar creation (outfit, skin tone, hair, accessories — prefilled by the scan)
  → Isometric office: the trade's tasks → the domains of the job
  → Poster studio (decor, pose, expression, text)
  → Export: print + QR code for the phone (PNG/PDF in development)
  → Full reset (kiosk mode)
```

## Decisions

| Topic | Decision |
|---|---|
| Rendering | Three.js, orthographic camera in true isometric (2.5D), toon shading |
| Art direction | "Lagon": a floating diorama in the style of Monument Valley, Wes Anderson pastels (powder pink walls, honey basket-weave parquet aligned with the grid, teal base on an aqua background), Nintendo-like UI (white cards with a thick lip). Teal = environment and selection, coral = actions, sunflower = rewards and light, midnight blue = text. A single palette in `src/render/palette.ts`, mirrored as CSS tokens. Fredoka (titles) and Nunito (text) fonts, bundled through `@fontsource`. Phosphor pictograms in a sticker style (thick midnight-blue outline over a pastel fill, sunflower for rewards and light, coral for hearts), never emojis |
| Avatar | **Procedural chibi** (big head, small round body, no Blender model in V1). Eyes, eyebrows and mouth are drawn on a canvas texture, so expressions cost almost nothing; nose, hair, beard and accessories are 3D. The body, nose, eyebrows, eyelashes and lips are the same for everyone (visible, but not adjustable); the four face shapes are clearly different: two soft (round, oval) and two angular (square with a marked jaw, heart with wide cheekbones and a narrow chin), always rounded to stay cute, with a small neck visible between the chin and the collar. **Few options**, only traits that are **common among people in Switzerland** and plausible, based on published surveys (haircuts, hair and eye colours, beards, glasses, nose shapes…, sources in `src/character/population.ts`); rare options do not exist (afro, turban, vitiligo, dyed hair…): a rare trait, on a test photo or a visitor, takes the closest common option (turban → beanie). Same rule for clothing colours: only the main ones (black, grey, white, beige, brown, navy, blue, green, red, yellow, purple, pink); a measured colour takes the closest. Curly cuts in a scalloped volume with ringlets, including "Boucles et dégradé" (the "broccoli cut" of many teenagers: small corkscrew curls on top, a curly fringe on the forehead, temples and nape faded down to the skin). "Boucles et dégradé" is almost as frequent as "Court" among teenagers. A "Locks / tresses" cut covers both cases (raised cords, pulled back, below the shoulders); "Nattes" makes two three-strand braids from a middle parting, on the chest. "Boule à zéro" is painted on the scalp like the stubble (a shadow and very short hairs); the scan cannot tell it from a bald head, so the frequency by age decides. The headscarf follows the most common way of wearing it: pinned around the face from the middle of the forehead to below the chin, a darker underscarf showing on the forehead, wrapped around the neck, then draped over the shoulders and the top of the chest. Beards in painted strands: stubble, **goatee** (the moustache, around the mouth and the chin: always with the moustache) and **a single beard**, of a length between short and long (a rounded point under the chin); **a single moustache** (thick). Freckles painted on the face. V-neck buttoned cardigan, drop earrings with a turquoise stone. Common glasses frames, including a clear plastic one. Some options are coded feminine or masculine in `options.ts`, the others are neutral and go with both: what the game picks by itself (scan, welcome-screen avatars, default look) **never mixes** the two, even when the gender is unknown (it then follows the options already chosen); only the "Au hasard" button, pressed by the visitor, mixes everything, and the visitor can choose anything by hand. `pnpm portraits` counts a mixed look as a miss. On screen, the game talks about the avatar and its options, not about the person. glTF models maybe in V2 |
| Face scan | **Optional**: on by default, it can be turned off for the whole booth (`VITE_SCAN=false`) or for one trade (`scan: false`); without it, there is no consent card, the game goes straight to "Crée ton perso", and "Dans les coulisses" leaves the scan chapter out. **No webcam**: the person's photos are analysed, a single front one or one to four (front, left profile, right profile, back; the front one is required). Touching a slot opens the file picker, with multiple selection; photos chosen or dropped together are sorted into their slot from the face (no face = back, turned face = profile). The booth team takes the photos (the team's phone or the booth's camera), puts them in a dedicated folder of the PC and erases them after each visitor, on the PC as well as on the device (README, "Visitors' photos"). MediaPipe Face Landmarker and segmentation (`@mediapipe/tasks-vision`, models stored locally for offline use). It yields the **closest options** of "Crée ton perso" directly (skin tone and eye colour from the palette, eye shape, glasses, headwear, beard, moustache, hair colour and cut, top colour taken under the chin and from the back photo). The scan starts by estimating the apparent age and gender (local model, on the front photo), used only to start from the most likely look (table in `docs/profils-types.md`, generated by `pnpm profils`). Each measurement gives a likelihood per option, multiplied by the option's frequency for this visitor (gender, age, skin tone, hair colour): a clear measurement wins, a hesitant one falls back to the most likely. What is not measured (face shape, trousers, shoes…) takes the most frequent option. Nothing that cannot be selected. **No** photo pasted onto the avatar (an unsettling effect) |
| Input | Pointer Events (mouse + touch + stylus). Hover with the mouse only. In the office, the wheel, a two-finger pinch and the HUD's magnifier buttons zoom from 0.8× to 2.2× (towards the cursor or the fingers); zoomed in, dragging pans, never leaving the overview. The camera also turns by at most 20° each way (right-click drag, two-finger rotation, the HUD's arrow buttons): beyond that, a wall would be seen edge-on |
| Sharing | A small Node/Express server on the PC. The poster is sent to it, and the QR code points to `http://<local-IP>:<port>/p/<id>`. The phone must be on the same Wi-Fi (plan a router dedicated to the booth). |
| Privacy (Swiss nFADP, minors) | Consent screen, which also says that the scan guesses the age and gender for a first look; a printable sheet "Tes données sur ce stand" for the booth ("Dans les coulisses", privacy chapter). 100 % local processing. **No image of a face stored** (only the parameters, in memory). Posters erased automatically after ~30 min. Reset between players |
| Trades | One module per trade in `src/trades/<id>/`, behind a single contract (tasks, domains, office stations, held object, studio, texts); the common code reads it through `trade()` and never names a trade. The booth's administrator chooses which trades are shown (`VITE_TRADES` in `.env.local`); with several, the visitor picks one on the welcome screen; with one, there is no choice |
| Tools | pnpm, Vite, Three.js, strict TypeScript without a compile step (Vite for the game, Node for the server and the tools), no framework for now (to be chosen the day the UI needs one), `qrcode`, `jsPDF`. Checks: Vitest (rules of the game, contract of each trade), Playwright (a whole visit of each trade, offline), Stylelint (sizes in rem), run on every push by GitHub Actions |
| Open source | Code under GPL-3.0-or-later on GitHub (`proprioz/mini-future-me`). The booth's school (name, website, logo) and the test portraits are not in the repository: `.env.local`, `public/school/`, `public/portraits/`. Contributor docs in English and French; everyone uses the development setup they like, with or without AI (`AGENTS.md`, and the `new-trade` skill in `.agents/skills/` holds the game's DNA for a new trade). The README says other trades are welcome, how to add one, and that the game's creator can build one for a school on quotation (a "Nouvelle filière" issue form); in the game, the "Le code" chapter of "Dans les coulisses" says the game is open source: anyone can clone it, change it, propose improvements and add a trade |

## Behind the scenes

On the welcome screen, "Comment ce jeu est fabriqué" opens an explanation of the game for visitors curious
about the job, which the booth team (students, apprentices, teachers or volunteers, not necessarily from the trade or into code) must be able to give. One chapter per
question a visitor may ask (code, 3D, face, scan, privacy, AI, then the job of each trade of the booth): an
answer in plain words, details, then "Les mots du métier". The AI chapter says the game was developed with
an AI, what it brings (speed, complex tools made accessible) and why a specialist is needed to guide it and
judge its work. The job chapter comes from the trade (`about.ts`); the media one follows the 6 domains of
the federal training plan (content production, design, marketing and communication, IT, projects, business
management), each tied to the game, then what the job holds that is not in the game (video, sound, real
texts and social media, quotes and invoices, equipment). The privacy chapter says that the scan also
guesses the age and gender from the photo, only for a first look the visitor can change (the estimated
values are never shown). Demos on the welcome avatar (shapes, triangles, expressions). No brand named (no browser,
AI or software), except Google for the scan's models and the names of the libraries. "Imprimer" lays every
chapter out on A4 in the game's style, with images of the demos and the school's footer. In the privacy
chapter, "Imprimer la fiche du stand" prints "Tes données sur ce stand", a single A4 page to lay on the
booth's table for visitors, parents and teachers: what the game does with each piece of data, from the
photos to the poster, and whom to ask.

## Tasks (mini-games of 30 to 60 s) and domains of the job

These rules hold for every trade. The avatar walks to the station (A*), plays an animation, then the
mini-game opens over the office.

Guidance: a big badge floats above each station (✓ once its mission is done; the next order bounces in
coral with its name) and the station of the next order glows softly. Stations are big, and an invisible
zone around each one widens the click target. The "Y aller ▶" button at the bottom of the screen goes
straight to the next order, and the win screen, titled after the mission ("C'est dans la boîte !",
"Campagne lancée !"…), offers "Suivante ▶". A station opens its next order directly, without a menu or an
intro screen.

Text: the bare minimum, everywhere. The client's request fits in one line under the mini-game's title,
each instruction in one short sentence, and the win screen keeps only one sentence about the job (💡). No
blocking failure and no timer.

The cork board 📌, common to every trade, shows the tasks as "client orders" (one note per order).

The tasks win **domains of competence** from the trade's training plan, each with its pictogram and its
colour. In the HUD, each domain's ring fills with every task, and the pictogram takes its colour once the
domain is won; touching a badge says its name. The win screen shows the domain trained (and the trade's
final domain after the last order). Each domain won unlocks decors or poses for the poster.

## Media trade: Mini Future Me Médiamaticien·ne

The campaign of the "Pétille" lemonade, from the shoot to the printed posters. Module:
`src/trades/mediamatique/`.

No blocking failure: the lighting says "too dark" or "too bright", the focus is set at the player's pace
(the image sharpens when getting close), each retouch slider shows a ✓ once set right, and the layout can
also be played by touching an element, then its place.

1. 📷 **Product shoot** (camera, in front of a green screen): switch the light on and set its power (the
   camera's light meter), frame the bottle in the central rectangle, set the focus until the image is
   sharp, then shoot, then touch the green screen to key it out: the lemonade stays on a transparent
   background (checkerboard).
2. 💻 **Photo retouch** (laptop): choose the background of the keyed-out photo (yellow, lagoon, bubbles,
   night), then set brightness, contrast and crop to match a reference image. The chosen background is the
   photo's in the following tasks and on the office screens.
3. 🎨 **Poster layout** (laptop): place title, image and logo on a poster, with alignment and hierarchy.
   This poster is reused by publishing, printing and the poster studio.
4. 📣 **Publishing** (laptop): choose every support of the campaign (website, newsletter, TikTok,
   Instagram, YouTube, poster), each with a "What to watch for" bubble on the image (how to adapt the
   poster to that support: recompose without stretching, keep the essentials away from the edges, a title
   readable when small…); the player's poster flies to each one and is redone in its format, with its
   colours, its specifications (ratio, size in pixels, CMYK and bleed…) and a bubble explaining why.
5. 🖨️ **Pro printing** (printer): choose A3, CMYK rather than RGB, 300 dpi and bleed, then print. The
   preview shows the poster made in the layout, as it would come out with these settings.

The domains (`skills.ts`, the same as the job chapter behind the scenes): Produire des contenus (shoot and
retouch), Concevoir des visuels (layout), Marketing et communication (publishing and printing), and Mener
des projets, won once the client's whole campaign is done. They unlock: Photographe (content), Fête
(design), Ville la nuit (marketing), Grande première and Héroïque (projects). On the poster, the avatar
holds the poster it laid out; the trade adds the "Studio photo" decor (the default) and the "Photographe"
pose.

## Poster studio

- A separate Three.js scene: decor of choice, still pose of the avatar, expression through
  `FaceTexture.setExpression()`.
- The avatar holds the object made in the office (the trade's `creation`: a 3D object and its size; in
  media, the poster laid out in the layout task, redrawn on a canvas by `drawDesign()` of
  `PosterLayout.ts`). Each pose holds it its own way (`withCreation` in `poses.ts`, which the trade can
  adjust pose by pose with `creation.holds`): with both hands for "Fier·ère" (the default pose, offered
  only once the object exists), in one hand at the side for "Coucou", "Photographe" (the camera in the
  other hand) and "Héroïque", held up at arm's length for "Youpi !". Without an object made, the poses
  stay empty-handed.
- Shared decors and poses (`decors.ts`, `poses.ts`); each trade picks its own, adds some if needed, and
  says which domain unlocks each one (the trade's `studio`). The titles above the avatar and the caption
  under the name come from the trade too.
- High-definition off-screen rendering (A4 at 300 dpi ≈ 2480×3508), then a 2D canvas for the name and the
  frame. The domains won in the office are not on the poster (they only unlock decors and poses).
- A two-block footer at the bottom of every poster. Left, the visit: "Tu as été servi·e par" followed by
  the names of the booth team, then today's date (without names: "Affiche créée le" and the date).
  Right, the booth's school: its logo (`public/school/logo.svg`, or its name), "Infos sur la formation et
  le métier : <website> ou scanne le code" and the QR code to the website. The school is set in
  `.env.local` (`VITE_SCHOOL_NAME`, `VITE_SCHOOL_SITE`, `VITE_SCHOOL_URL`, see `src/poster/school.ts`);
  without a school, the visit block takes the whole width. The names are typed in the studio's Texte tab
  and stay from one visitor to the next (local storage of the PC).
- Export: printing and upload to the local server for the QR code. PNG or PDF files (jsPDF) are offered only in development: at the booth, they would pile up in the PC's Downloads, with the visitor's first name.

## Roadmap

- [x] **1. Skeleton**: isometric office, procedural avatar, click/tap to move, 5 interactive objects (with a placeholder message)
- [x] **2. Customisation**: outfit, skin tone, hairstyles (several styles), cap, glasses, etc.
- [x] **3. Face scan**: MediaPipe analysis of the photos (1 to 4, sorted automatically), turned into `FaceTexture` and `Character` parameters
- [x] **4. Mini-games**: the 5 tasks, one by one, with the domains of the job in the HUD
- [x] **5. Poster studio**: choice of decor, pose and expression, then PNG/PDF export
- [x] **6. Local server + QR code**: upload, URL on the local network, automatic clean-up
- [x] **7. Kiosk mode**: welcome screen, consent, inactivity back to the welcome screen, reset, sounds, transitions
- [x] **8. Several trades**: one module per trade, choice on the welcome screen, object held on the poster, "Adding a trade" guide
- [x] **9. Open source**: GPL-3.0 license, school and portraits out of the repository, docs in English and French
- [ ] **10. A second trade**
