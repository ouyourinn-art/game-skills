---
name: original-mini-game
description: Build one original, complete, offline HTML5 mini game (its own core mechanic, levels, art and name) ready to be wrapped as an Android WebView APK and listed on TapTap. Use when asked to make a new small game for a store listing. Not for reskinning or parameter-tweaking an existing game into per-account variants.
---

# Original mini game

Build **one** small game that stands on its own as a product: a real core
mechanic, a level structure, its own art and name, no bugs, fully offline.
The output is a `www/` folder (plus `listing.json`) that the TapTap workbench
packages into an APK; the workbench writes the store texts itself.

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
listing.json   # listing facts, see step 5
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
  "developer_id": "",
  "package_name": "com.<studio>.<game>",
  "version_name": "1.0.0",
  "version_code": 1,
  "game_type": "益智",
  "languages": ["英文"],
  "is_online_game": false,
  "has_in_app_purchases": false,
  "third_party": []
}
```

- One game ↔ one developer ID ↔ one package name ↔ its own signing key.
- Leave `developer_id` empty for a new game. The workbench gives the game to
  the account that logs in (it asks first if that account already has games),
  and records the App ID TapTap assigns when the game is created. Neither ID
  goes into the APK.
- The in-game tagline and rules open the 简介 and the 首页推荐语, so write
  them as plain English sentences that say only what the game really does.
  Keep the tagline short enough that `<tagline> across <N> relaxing puzzles.`
  fits in 80 characters.
- Leave the store texts out of this file. The workbench fills every text
  field of the TapTap version page (简介, 首页推荐语, 更新日志, 开发者的话)
  **itself, offline, in the approved listing template** (the wording of
  Tidepool Sort's approved listing) and enters them straight into TapTap with
  no review step. (`description`, `tagline`, `release_notes`,
  `developer_note`, `gameplay` or `features` written here would replace the
  template for that field; add one only when the user asks for different
  wording. The reference `listing.json` carries them because it is the
  approved listing the template was taken from.) The workbench reads the
  game's own files (the `www/` source, or the web assets inside the APK) and
  fills the template like this:

  | Field | Template |
  |---|---|
  | 简介 | `<tagline> <rules>` ⏎⏎ `<Title> has <N> <levels>. Earn up to three stars in each <level>, with undo, hint and restart when you get stuck. The game plays fully offline and saves progress on this device.` |
  | 首页推荐语 | `<tagline> across <N> relaxing puzzles.` (≤ 80 characters) |
  | 更新日志 | `First release:` then `- <N> <levels>`, `- Up to three stars per <level>`, `- Undo, hint and restart`, `- Plays fully offline` |
  | 开发者的话 | `<Title> is a small, quiet puzzle game: <tagline>. Every <level> is generated from a fixed seed and checked by a solver, so each one can be finished. There are no ads and no purchases; the game plays offline and keeps your progress on your device.` |

- **Every game built with this skill meets that standard**, so every template
  sentence is true of it: plays offline, no ads and no purchases, progress
  saved on the device, seeded levels checked by a solver, undo / hint /
  restart, up to three stars per level. Build it so the workbench can read
  each part:

  | The workbench reads | Put it in the game as |
  |---|---|
  | Game name | `<title>` and the menu `<h1>` |
  | Home-page line | one short sentence in an element with class `tagline` |
  | How to play (opens 简介) | the in-game instructions in an element with class `rules` (or `help` / `how-to-play`) |
  | Level count | one constant such as `const TOTAL_LEVELS = 30;` |
  | What a level is called | a title template such as `` `Level ${n}` `` (or `Pool ${n}`), plus a heading like "Tide pools" on the level list |
  | Tools | buttons labelled Undo, Hint, Restart |
  | Star ratings | the ★ character in the result screen |
  | Solver-checked levels | levels made by `generateLevel(n)` from a seeded random generator (`rng(seed)`), each checked by a `function solve…(…)` |
  | Saves progress | `localStorage.setItem(...)` |
  | Plays offline | no `http(s)://`, `fetch`, `XMLHttpRequest` or `WebSocket` anywhere |
  | No ads or purchases | no ad/billing code, and `"has_in_app_purchases": false` in this file |

  A template sentence whose part is missing from the game is dropped rather
  than written (for example, network code means no "plays offline").
- `third_party` lists any open-source code/art with its license.

The TapTap workbench then builds the APK with its WebView shell, captures
screenshots and the gameplay video from the built APK, and uploads.

**The APK carries its own listing kit.** Put these in `www/taptap/` and list
them in the build's `assets`, so they end up under `assets/taptap/` in the APK:

| File | Content |
|---|---|
| `listing.json` | `title`, `game_type`, `languages`, `is_online_game`, `has_in_app_purchases`, `region`, `release_status`, `publisher_role`, `listed_elsewhere` |
| `capture.json` | `{"screenshots": {…}, "video": {…}}`: the same capture steps as the build config |
| `icon-512.png` | 512×512 store icon |
| `header-1920x1080.png` | 1920×1080 English header image |

The user then only drags the APK into the workbench: it reads the kit, writes
the store texts from the game's own words, records screenshots and the video
from the APK, gives the game to the account that logs in, and uploads the APK
unchanged.

## Done means

- Concept table written and distinct from every earlier game.
- All levels solver-verified; smoke test and play-through pass; screenshots
  checked by eye.
- User has played it (or was sent the playable page).
- `www/` and `listing.json` delivered.
