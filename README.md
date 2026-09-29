# game-skills

Claude skills for building and shipping small original games.

| Skill | What it does |
|---|---|
| [`original-mini-game`](skills/original-mini-game/SKILL.md) | Build one original, complete, offline HTML5 mini game (own mechanic, levels, art, name), verify every level is solvable, play-test it, and hand off `www/` + `listing.json` for APK packaging and TapTap listing. Reference game: Tidepool Sort. |

## Use

Point Claude at a skill folder (or copy it into your skills directory) and ask
for a new game; the skill's `SKILL.md` describes the whole workflow.

Checks need Node.js and Python with Playwright:

```bash
pip install playwright && playwright install chromium
python skills/original-mini-game/scripts/smoke_test.py skills/original-mini-game/reference/tidepool-sort/www
```
