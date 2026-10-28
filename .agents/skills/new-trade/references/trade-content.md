# Content: the job, the story, the texts

## Sources

- The official training plan of the trade. In Switzerland: the SERI ordinance on vocational training
  (*ordonnance sur la formation professionnelle initiale*) and its training plan, which list the
  **domains of competence** (*domaines de compétences opérationnelles*); orientation.ch for the job
  description, the tasks and the qualities asked.
- The person adding the trade (a teacher, a trainer, an apprentice): ask them what apprentices are
  proud of doing, and what visitors usually get wrong about the job.

Name the sources in a comment at the top of `about.ts`, like the media trade does.

## The client story

The whole game is **one order from one fictional client**, followed from start to finish (media: the
"Pétille" lemonade's campaign, shoot → retouch → layout → publishing → print). It gives a reason to each
task, and the last one delivers something.

- Invent a friendly local brand or customer (no real brand), with a name that reads well in French.
- 4 to 6 tasks, in the order of the real work; each task's result can feed the next ones.
- The object the avatar holds on the poster is the tangible result of the story (the poster in media; a
  cake, a chair, a bouquet…).

## Domains of the job

`skills` in the trade module: 3 to 5 domains taken from the training plan (short labels, verb first:
"Produire des contenus", "Concevoir des visuels"), each with a pictogram and a palette tint, each
trained by one or more tasks. Add a final domain trained by every task (media: "Mener des projets"), won
with the whole order. Each domain unlocks a decor or a pose on the poster (`studio.unlocks`).

## The job chapter of "Dans les coulisses"

`about.ts` exports a chapter shaped like the common ones in `src/ui/AboutPanel.ts`. Follow the media
chapter (`src/trades/mediamatique/about.ts`):

1. `title`: a question ("Et le métier de cuisinier·ère, dans tout ça ?"); `lead`: the job in two plain
   sentences.
2. Block "Ce qu'on apprend, et où on le voit dans le jeu": one point per domain of the training plan, in
   bold, with what it means and *"Dans le jeu"* : where the visitor met it.
3. Block "Aussi dans le métier, mais pas dans ce jeu": what the game leaves out (be honest).
4. Block "Les qualités utiles".
5. `note`: length of the training and the diploma, and what comes after.
6. `words`: 2 to 4 words of the job, each with a one-line definition.

The booth team (students, teachers or volunteers, not necessarily from the trade) must be able to say it out loud: plain words, short
sentences. No brand names.

## Other texts

- `poster.caption`: "<Job>, un métier à découvrir !".
- `studio.titles`: 3 or 4 two-line titles over the avatar; the first is the default
  ("Futur·e" / "médiamaticien·ne").
- `phone.fact`: what the job is about in one line, then the training length.
- `welcome.highlight`: `[icon, "Un métier <adjective>"]`.
- Registry entry: `job` (inclusive, lower case; the trade's name follows, "Mini Future Me
  Cuisinier·ère"), `pitch` (three things you do, comma-separated, shown on the trade choice card).

## Writing rules

- French from French-speaking Switzerland, "tu", inclusive forms with the middle dot (cuisinier·ère).
- Respectful and inclusive: talk about the avatar and its options, never about the visitor's body; say
  what data is used for rather than what is hidden.
- Short. If a sentence can lose a word, it loses it.
