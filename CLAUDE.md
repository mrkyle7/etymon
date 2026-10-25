# Etymon

A game on **cheetahmoongames.com**, served at **https://etymon.cheetahmoongames.com** from the `etymon` Cloud Run service. This repo was started from the skeleton in [mrkyle7/cheetahmoongames](https://github.com/mrkyle7/cheetahmoongames) by `scripts/new-game.sh`. Etymon moved here from mrkyle7/claude, where it began.

## The game

You are a word drifting through a thousand years of meaning: *nice* (once "foolish"), *silly* ("blessed"), *awful* ("awe-inspiring"), *girl* ("child") and *meat* ("food"). The goal is speakers. The map is meaning: landmarks are senses, and your circle is the senses you carry. Each century:
- **Choose what happens.** Each word has a world per ending (`worlds`), the target's being real history, with an event a century: a clue, two senses wanted, two out of fashion and a clue to those. You're offered your world's event and one that changes history (from history, the world of the nearest other ending; from another world, back to history) (`offer`).
- **Drift** up to `REACH`, and broaden a lot (`BROADEN`) or narrow a little (`NARROW`).
- **Speakers change** (`preview`): each sense carried wins `GAIN.plain`, or `GAIN.needed` if wanted; out of fashion costs `SCORN`. Over `MAX_SENSES` senses dilutes what you win; none costs `MEANINGLESS`; `FORGETTING` forget you anyway. **Fads** (`fads`) sprout beside senses you've carried, pay `FAD`, and go out of fashion `FAD_LIFE` centuries later. At 0 you're obsolete.

Senses beyond `SIGHT` are "?" until you get near; some appear only in a later century (a landmark's 4th element).

**Endings.** With `REVEAL` centuries left, `chooseEnding` fixes the goal: the real meaning (`target`) if you kept history's event in at least `ON_COURSE` centuries, or else the world you're in (if back in history, the last other one). Your world is then fixed to the goal's. Carry it in the last century for +100 (some need a narrow circle, `maxBreadth`). `history` is what the word really meant, shown afterwards. Endings found are kept in `localStorage`.

**Perfect routes.** The score to beat is the best route to your ending (moves and events), found by `scripts/routes.js`, which writes `public/routes.js`. It stays hidden until the player asks or matches it. Run `node scripts/routes.js` (several minutes) after changing the rules or a word; the tests check every ending has a legal route that arrives.

- `public/game.js` is all of the rules and the five words' data, with no DOM, shared by the page and `test/etymon.test.js`. It loads `public/routes.js`.
- `public/app.js` and `public/style.css` are its page. A start screen (the Cheetah Moon bar, a card per word, How to play) leads into play mode, which takes the whole screen (and goes full screen where the browser allows) with nothing to scroll on desktop: the SVG map you tap to drift, with your speakers as a crowd of dots, and beside it three cards in the order the player thinks (on phones Now goes above the map and the drift card is pinned to the bottom): **Now** (the word, what it means and speakers in one row, then a one-line timeline: each past century's change in speakers and ✓ if history was kept, tap to see its summary again), **Next** ("The 1300s": the two events to choose between, the chosen one with its clues; fads and the ending as tags), and **If you drift here** (what you'd mean, and "Continue to 1400"; broadening and narrowing are + and − on the edge of your circle on the map; never what it would do to your speakers, which shows only once the century passes). Once a century passes, a summary popup lists what each meaning gained or lost and why, what the word really meant and any new ways to go; speakers won walk in gold (wanted) or green and stand by their meaning; the speakers you're sure to lose next (forgetting, vagueness or emptiness at your circle's size) show hollow; and the map shows what it wanted (with hollow dots for the speakers a missed one would have brought) and scorned, until the next one passes, and your move is graded against the best one you had (`bestMove`, `grade`), without showing where that was. Centuries are written as years ("1300", "the 1300s"), never "the 14th century". The game assumes players know how to play: explanations belong in How to play, not on the game screen. The end screen compares your journey with the real one and replays yours. Finding the best route is the puzzle, so its score and path stay hidden behind "Reveal the answer" (which warns first), unless the player matches it.

It runs entirely in the browser: the server only serves files, `/healthz` and `/api/me`, so nothing is stored and any number of instances is fine. Best scores and endings found are kept in `localStorage`.

## Read this first

Before any work in this repo, read **[ADDING_A_GAME.md](https://github.com/mrkyle7/cheetahmoongames/blob/master/ADDING_A_GAME.md)** in mrkyle7/cheetahmoongames in full, not only the section you need. It explains how this game gets onto the site, what each step does, and what every game must have: the shared Cheetah Moon sign-in, a link back to cheetahmoongames.com, its own icons, and being installable as an app. The rules below repeat those; the doc explains them.

The infrastructure is not in this repo. The Cloud Run service, image registry, subdomain, DNS record and this repo's deploy permissions all live in `terraform/` in mrkyle7/cheetahmoongames, and change through pull requests there. That repo's workflow applies them. To change them, clone mrkyle7/cheetahmoongames and open a pull request there. Never create or change Google Cloud resources by hand or from this repo.

## Getting it live

Check what's done before starting. Ask the user if unsure, and update these boxes as steps complete.

- [x] Repo created from the skeleton (`scripts/new-game.sh`)
- [x] `etymon` entry added to `terraform/games.tf` in mrkyle7/cheetahmoongames, merged, and its workflow applied successfully
- [x] Card for the game added to `site/public/index.html` in mrkyle7/cheetahmoongames (can be the same pull request)
- [x] The game's own icon in `public/icon.svg`, with the PNGs in `public/icons/` rendered from it, and the same art on its home page card
- [x] A push to `main` deployed successfully (Actions → CI/CD). Every push to `main` deploys; there is no setting or repo variable to turn on, so never tell anyone to set one (an old `DEPLOY_ENABLED` variable is gone).
- [x] `https://etymon.cheetahmoongames.com` loads over HTTPS (the certificate can take 15–60 minutes after the DNS record appears)

## Rules the game must keep

- **Listen on `PORT`.** Cloud Run sets it to 8080; `server.js` reads it.
- **Serve the game at `/`.** It owns the whole subdomain.
- **Keep nothing important on local disk.** It's wiped whenever the instance restarts. Anything that must survive needs a database or other storage. That's new infrastructure, so it goes in mrkyle7/cheetahmoongames; see "Games that need secrets or a database" in ADDING_A_GAME.md.
- **Keep the workflow's `env` block as generated.** `REPOSITORY`, `IMAGE_NAME`, `SERVICE_NAME` and `SERVICE_ACCOUNT` must match the `etymon` entry in games.tf. The deploy account can only push to its own registry and deploy its own service.
- **Keep `PAGE_MARKER` current.** It's the text the container and deploy smoke tests look for on `/`. If the page stops showing "Etymon", update it in `.github/workflows/ci-cd.yml`.
- **No keys or secrets for Google Cloud in this repo.** GitHub Actions sign in without them. Only jobs on `main` of this repo can deploy; Google Cloud enforces that, not the workflow file.
- **Players are Cheetah Moon accounts.** They sign in once at `https://cheetahmoongames.com/login`, and `auth.js` tells the server who they are (`await auth.player(req)` gives `{ id, name }` or null). If the game lets guests play under a typed name, call `auth.guestSeen(name)` when one starts playing, so the owner's login alerts include them. That page also creates accounts and resets forgotten passwords by email. Don't build a sign-in, sign-up or password reset, or ask for names or passwords, in the game. Key games and records by `id`; `name` is for display and can contain spaces. See "Players and signing in" in ADDING_A_GAME.md.
- **Link back to Cheetah Moon Games.** The game's main page keeps a visible link to `https://cheetahmoongames.com/`, like the "← Cheetah Moon Games" in the skeleton's top bar.
- **Its own icons.** Replace the placeholder `public/icon.svg` (the favicon) with the game's own art, then render the PNGs in `public/icons/` from it; see "Icons and installing" in ADDING_A_GAME.md. Every page links the favicon, the Apple icon and the manifest.
- **Installable.** Keep `public/manifest.webmanifest` (name and colours in step with the game), `public/sw.js` and `public/offline.html`, and register the service worker on every page. The service worker must not cache the game itself, only the offline page.
- **Don't log, store or forward the `userjwt` cookie.** Only `auth.js` reads it, and it only ever sends it back to the accounts service that issued it (to report the players it sees, for the owner's login alerts). Keep `auth.js` as it is in the skeleton; fixes to it go in mrkyle7/cheetahmoongames first.
- **Notifications** (telling players it's their turn): build them as "Notifications" in ADDING_A_GAME.md describes. The server makes its own Web Push keys and keeps them in the game's storage; never put them in Secret Manager or GitHub secrets.
- **Instances:** by default up to 3 can run, and players may land on different ones. If players must meet on the same server, for example rooms kept in memory, set `max_instances = 1` (and, for WebSockets, `timeout`, `concurrency` and `session_affinity`) in the games.tf entry. The Boxer does this.

## Commands

```sh
npm test            # unit tests
node scripts/routes.js   # find the perfect route to every ending, after changing the rules or a word
npm start           # http://localhost:8080
docker build -t etymon . && docker run -p 8080:8080 etymon   # the container Cloud Run runs
```

## How it deploys

`.github/workflows/ci-cd.yml` runs tests and a container smoke test on every push and pull request. Every push to `main` also deploys it:
1. builds the image and pushes it to `us-east1-docker.pkg.dev/bartenders-464918/etymon/etymon`
2. deploys it to the `etymon` service
3. checks the service serves the page
4. rolls back if the deploy fails
