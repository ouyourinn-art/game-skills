---
name: original-mini-game
description: Build one original, complete, offline HTML5 mini game (its own core mechanic, levels, art and name) ready to be wrapped as an Android WebView APK and listed on TapTap. Use when asked to make a new small game for a store listing. Not for reskinning or parameter-tweaking an existing game into per-account variants.
---

# Original mini game

Build **one** small game that stands on its own as a product: a real core
mechanic, a level structure, its own art and name, no bugs, fully offline.
The output is a `www/` folder (plus store copy) that the TapTap workbench
packages into an APK.

Reference implementation: `reference/tidepool-sort/` (shell sorting puzzle,
30 generated levels, solver-verified, play-tested). Read it before starting.

## Boundaries (read first)

Store rules this skill is built around — TapTap Game Review Specifications
(https://developer.taptap.io/docs/store/store-agree/):

- **1.5.1** Do not upload multiple games of the same or similar content.
- **1.5.3** A game must not be a simple webpage port or template application;
  games with poor experience are removed.
- **1.5.5** Game content must not be the same as a game already on TapTap.

Therefore:

- Each game gets its **own core mechanic**, win/lose condition and level
  design. A new name, palette, art set or changed numbers (move limits, board
  size, timers) on the same mechanic is a variant, not a new game.
- Do **not** build a generator that turns one game into many per account
  ("input developer ID → output game"). Games are designed one at a time.
- Before building, fill the distinctness table (below) against every game
  already made in this repo. If two rows match on mechanic *and* goal,
  pick a different concept.
- Open-source code or art may be used only when its license allows commercial
  use and modification; keep the license file and required attribution in
  `www/` and note the source in `listing.json`. Prefer writing from scratch:
  it is as fast and avoids license and "same as existing game" problems.
- Quality bar is part of the rules (1.5.3). A "basic" game is still complete:
  tutorial text, progression, feedback on win, no dead ends, no crashes.

## Workflow

### 1. Concept (5 minutes)

Write down, in the answer to the user:

| Field | Example (Tidepool Sort) |
|---|---|
| Name | Tidepool Sort |
| One-line play | Tap a pool to lift its top shells, tap another to drop them; group matching shells. |
| Core mechanic | Stack sorting with capacity 4, drop only on empty or same kind |
| Goal / end | Every pool empty or full of one kind |
| Progression | 30 levels, 3→7 kinds, fewer spare pools later |
| Scoring | Stars by moves vs. target |
| Theme / art | Sea shells, each kind has its own outline |
| Differs from existing games in this repo by | (first game) |

Get the user's OK on the concept if they are present; otherwise pick the
simplest concept that passes the distinctness check and say which one.

### 2. Build

Structure (keep exactly; the workbench expects it):

```
www/
  index.html   # markup only, loads style.css and game.js, strict CSP
  style.css
  game.js      # all logic; export pure functions via module.exports for Node tests
  (assets/     # only if needed; prefer inline SVG drawn in code)
listing.json   # store copy, see step 5
```

Rules:

- Fully offline: no CDN, no web fonts, no analytics, no network calls.
  CSP meta: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'`.
- Pure rule functions (`canMove`, `applyMove`, `isSolved`, …) separated from
  DOM code, and exported for Node when `module` exists.
- Levels: either hand-authored or generated from a fixed seed. **Generated
  levels must be verified solvable by a solver** at generation time (see
  `solve()` and `generateLevel()` in the reference) — never ship a level the
  code has not solved.
- Save progress in `localStorage`, wrapped in try/catch; the game must work
  when storage is unavailable.
- Layout fits 360×640 and 440×1020 phones without scrolling; size the board
  from `window.innerHeight` when it has several rows.
- Accessibility: pieces differ by shape as well as color; buttons have text
  labels; visible focus state.
- Stable hooks for automation: interactive pieces carry `data-*` attributes
  (e.g. `data-pool="3"`) so tests and the workbench's video recorder can click them.
- The workbench's screenshot scenes run **one after another on the same page,
  without reloading**: scene 2 starts where scene 1 stopped. Only the first
  scene clicks through a start menu; later scenes continue the game. The
  gameplay video, by contrast, starts from a fresh page load. Use the shortest
  (breadth-first) solution of level 1 for these actions so the video looks
  purposeful rather than wandering.

### 3. Verify (must pass before showing the user)

1. **Logic, in Node**: generate every level, solve it, replay the solution
   through `canMove`/`applyMove`, assert `isSolved`. Print level specs and
   timings. (See the Node snippet below.)
2. **Smoke test**: `python scripts/smoke_test.py path/to/www` — offline check,
   no console errors, no horizontal overflow at both phone sizes.
3. **Play-through**: a game-specific `playtest.py` (copy the reference) that
   really clicks through the first 3 levels using the solver's moves, checks
   the win screen, undo/hint/restart, a late (largest) level's layout, and
   that progress survives a reload.
4. **Look at the screenshots yourself** (menu, win screen, largest level, small
   screen). Fix anything clipped, overlapping or unreadable.

Node check used for the reference game:

```bash
node -e '
const g=require("./www/game.js");
for(let n=1;n<=g.TOTAL_LEVELS;n++){const L=g.generateLevel(n);const sol=g.solve(L.pools);
 if(!sol) throw new Error("unsolvable "+n);
 let p=L.pools; for(const [f,t] of sol){ if(!g.canMove(p,f,t)) throw new Error("bad move "+n); p=g.applyMove(p,f,t).pools;}
 if(!g.isSolved(p)) throw new Error("not solved "+n); console.log(n,"ok",L.par);}'
```

### 4. Let the user try it

Publish a single-file playable page (inline CSS and JS, drop the CSP meta)
as an artifact so the user can play on phone or desktop before packaging.

### 5. Hand-off for packaging

Write `listing.json` next to `www/`:

```json
{
  "title": "Tidepool Sort",
  "developer_id": "<the one account this game is for>",
  "package_name": "com.<studio>.<game>",
  "version_name": "1.0.0",
  "version_code": 1,
  "game_type": "益智",
  "languages": ["英文"],
  "description": "…store description, English, from the real rules…",
  "features": ["30 tide pools", "Undo, hint and restart", "Plays offline"],
  "is_online_game": false,
  "has_in_app_purchases": false,
  "third_party": []
}
```

- One game ↔ one developer ID ↔ one package name ↔ its own signing key.
- The description states only what the game really does.
- `third_party` lists any open-source code/art with its license.

The TapTap workbench then builds the APK with its WebView shell, captures
screenshots and the gameplay video from the built APK, and uploads.

### 6. Zip package for the workbench

Deliver one `.zip` per game. The user drags it onto the workbench (or clicks
“导入游戏压缩包”); it is checked and unpacked into
`local-projects/<developer_id>/<slug>/`, then “自动查找并处理” picks it up.
Layout (at the zip root or inside one top folder):

```
manifest.json         dossier: developer_id, title, description, gameplay,
                      features, languages, region, release_status,
                      publisher_role, game_type, version, package_name,
                      version_code, icon/header paths; app_id must be empty
release-build.json    source_dir "source", output_dir ".taptap-build",
                      icon, assets, screenshots (cumulative scenes), video
source/               the www files (index.html, style.css, game.js) at its
                      top level, plus android/ (AndroidManifest.xml,
                      MainActivity.java, res/drawable/icon.png); copy
                      reference/tidepool-sort/android and change the package
                      name, host and background colour
store-assets/         icon-512.png, header-1920x1080.png
description-en.md     optional, store copy source
```

The importer refuses the zip when: `developer_id` is missing or differs
between the two JSON files; `app_id` is set; a project with the same slug
already exists for any account (never overwrites; one game ↔ one account);
it contains signing keys, executables, absolute or `..` paths, or links.
It fills this PC's Android SDK and JDK paths and creates the game's own
signing key under `signing/<developer_id>-<slug>/`, so leave those fields
out or as placeholders. Use `reference/tidepool-sort/` as the model for
`manifest.json` and `release-build.json`.

## Done means

- Concept table written and distinct from every earlier game.
- All levels solver-verified; smoke test and play-through pass; screenshots
  checked by eye.
- User has played it (or was sent the playable page).
- `www/`, `listing.json` and the workbench zip delivered.
