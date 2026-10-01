"use strict";
// Pinwheel Rows: turn the pinwheels until every row holds a single kind of flower.
// Pure offline HTML5 game; progress is stored on the device only.

const FLOWERS = [
  { name: "poppy",     fill: "#ef5a4c", ring: "#a8322a", tile: "#fbe3dc" },
  { name: "sunflower", fill: "#f6c230", ring: "#a97a0e", tile: "#fbf0cf" },
  { name: "bluebell",  fill: "#5a8fe6", ring: "#2d58a6", tile: "#dde8fb" },
  { name: "clover",    fill: "#55b86a", ring: "#2c7a3f", tile: "#dcf1df" },
];
const TOTAL_LEVELS = 30;
const SAVE_KEY = "pinwheel-rows-v1";

// ---------- deterministic random ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- rules ----------
// A board is { rows, cols, tiles } where tiles[r * cols + c] is a flower kind.
// Pinwheel k sits where four tiles meet: row r = floor(k / (cols - 1)), col c = k % (cols - 1).
function pinwheelCount(rows, cols) {
  return (rows - 1) * (cols - 1);
}
function pinwheelCells(cols, k) {
  const r = Math.floor(k / (cols - 1));
  const c = k % (cols - 1);
  const tl = r * cols + c;
  // clockwise order: top-left, top-right, bottom-right, bottom-left
  return [tl, tl + 1, tl + cols + 1, tl + cols];
}
function applyTurn(tiles, cols, k) {
  const next = tiles.slice();
  const [a, b, c, d] = pinwheelCells(cols, k);
  next[b] = tiles[a];
  next[c] = tiles[b];
  next[d] = tiles[c];
  next[a] = tiles[d];
  return next;
}
function applyTurnBack(tiles, cols, k) {
  const next = tiles.slice();
  const [a, b, c, d] = pinwheelCells(cols, k);
  next[a] = tiles[b];
  next[b] = tiles[c];
  next[c] = tiles[d];
  next[d] = tiles[a];
  return next;
}
function rowDone(tiles, cols, r) {
  const first = tiles[r * cols];
  for (let c = 1; c < cols; c++) if (tiles[r * cols + c] !== first) return false;
  return true;
}
function isSolved(tiles, rows, cols) {
  for (let r = 0; r < rows; r++) if (!rowDone(tiles, cols, r)) return false;
  return true;
}
const keyOf = (tiles) => tiles.join("");

// ---------- solver (used for level generation and hints) ----------
// Meet in the middle: a table of every board within a few turns of *any*
// finished garden (rows in any order), searched from the current board.
const goalTables = {};
function permutations(items) {
  if (items.length <= 1) return [items.slice()];
  const out = [];
  items.forEach((item, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) out.push([item].concat(p));
  });
  return out;
}
function goalTable(rows, cols, depth) {
  const id = rows + "x" + cols + ":" + depth;
  if (goalTables[id]) return goalTables[id];
  const kinds = Array.from({ length: rows }, (_, i) => i);
  const table = new Map(); // key -> [distance, next pinwheel toward the goal]
  let frontier = [];
  for (const order of permutations(kinds)) {
    const tiles = [];
    order.forEach((kind) => { for (let c = 0; c < cols; c++) tiles.push(kind); });
    const k = keyOf(tiles);
    if (!table.has(k)) { table.set(k, [0, -1]); frontier.push(tiles); }
  }
  const wheels = pinwheelCount(rows, cols);
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const tiles of frontier) {
      for (let w = 0; w < wheels; w++) {
        // Turning back from a board one step nearer the goal: the forward move is w.
        const prev = applyTurnBack(tiles, cols, w);
        const k = keyOf(prev);
        if (!table.has(k)) { table.set(k, [d, w]); next.push(prev); }
      }
    }
    frontier = next;
  }
  goalTables[id] = table;
  return table;
}
// Shortest list of pinwheel turns that finishes the garden, or null when the
// board is further than forwardDepth + goal depth turns away.
function solve(tiles, rows, cols, forwardDepth = 4, goalDepth = 4) {
  if (isSolved(tiles, rows, cols)) return [];
  const table = goalTable(rows, cols, goalDepth);
  const wheels = pinwheelCount(rows, cols);
  let best = null;
  const seen = new Map([[keyOf(tiles), null]]);
  let frontier = [tiles];
  for (let d = 0; d <= forwardDepth; d++) {
    const next = [];
    for (const board of frontier) {
      const k = keyOf(board);
      const hit = table.get(k);
      if (hit && (!best || d + hit[0] < best.length)) {
        // rebuild: forward path to this board, then follow the table to the goal
        const path = [];
        let cursor = k;
        while (seen.get(cursor)) { const [parent, move] = seen.get(cursor); path.unshift(move); cursor = parent; }
        let b = board;
        let step = table.get(keyOf(b));
        while (step[0] > 0) { path.push(step[1]); b = applyTurn(b, cols, step[1]); step = table.get(keyOf(b)); }
        best = path;
      }
      if (d === forwardDepth) continue;
      for (let w = 0; w < wheels; w++) {
        const nb = applyTurn(board, cols, w);
        const nk = keyOf(nb);
        if (!seen.has(nk)) { seen.set(nk, [k, w]); next.push(nb); }
      }
    }
    if (best && best.length <= d + 1) break;
    frontier = next;
  }
  return best;
}

// ---------- levels ----------
function levelSpec(n) {
  // Each size starts gentle and ends with the longest gardens the solver allows.
  const tiers = [
    { upTo: 2, rows: 2, cols: 3, pars: [[2, 4]] },
    { upTo: 12, rows: 3, cols: 3, pars: [[3, 4], [4, 5], [5, 6]] },
    { upTo: 21, rows: 3, cols: 4, pars: [[4, 5], [5, 6], [6, 7]] },
    { upTo: 30, rows: 4, cols: 4, pars: [[5, 6], [6, 7], [7, 8]] },
  ];
  let first = 1;
  for (const tier of tiers) {
    if (n <= tier.upTo) {
      const size = tier.upTo - first + 1;
      const step = Math.min(tier.pars.length - 1, Math.floor(((n - first) * tier.pars.length) / size));
      const [minPar, maxPar] = tier.pars[step];
      return { rows: tier.rows, cols: tier.cols, turns: maxPar, minPar, maxPar };
    }
    first = tier.upTo + 1;
  }
  throw new Error("no such garden " + n);
}
// Kinds renamed in order of first appearance: two boards that differ only in
// which flower is which count as the same garden.
function canonical(tiles) {
  const names = {};
  let next = 0;
  return tiles.map((t) => (t in names ? names[t] : (names[t] = next++))).join("");
}
const levelCache = {};
function generateLevel(n) {
  if (levelCache[n]) return levelCache[n];
  const used = new Set();
  for (let m = 1; m < n; m++) {
    const earlier = generateLevel(m);
    used.add(earlier.rows + "x" + earlier.cols + ":" + canonical(earlier.tiles));
  }
  const { rows, cols, turns, minPar, maxPar } = levelSpec(n);
  const wheels = pinwheelCount(rows, cols);
  for (let attempt = 0; attempt < 400; attempt++) {
    const seed = 2027 + n * 7919 + attempt * 104729;
    const rand = rng(seed);
    const order = Array.from({ length: rows }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let tiles = [];
    order.forEach((kind) => { for (let c = 0; c < cols; c++) tiles.push(kind); });
    let last = -1, repeat = 0;
    for (let t = 0; t < turns; t++) {
      let w = Math.floor(rand() * wheels);
      if (w === last && repeat >= 1) w = (w + 1 + Math.floor(rand() * (wheels - 1))) % wheels;
      repeat = w === last ? repeat + 1 : 0;
      last = w;
      tiles = applyTurn(tiles, cols, w);
    }
    if (isSolved(tiles, rows, cols)) continue;
    // No row may start finished: every row needs work.
    let anyRowDone = false;
    for (let r = 0; r < rows; r++) if (rowDone(tiles, cols, r)) anyRowDone = true;
    if (anyRowDone) continue;
    if (used.has(rows + "x" + cols + ":" + canonical(tiles))) continue;
    const solution = solve(tiles, rows, cols);
    if (!solution || solution.length < minPar || solution.length > maxPar) continue;
    levelCache[n] = { rows, cols, tiles, par: solution.length, seed, solution };
    return levelCache[n];
  }
  throw new Error("could not generate level " + n);
}

// ---------- persistence ----------
function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    return { unlocked: Math.max(1, data.unlocked | 0), stars: data.stars || {} };
  } catch (e) {
    return { unlocked: 1, stars: {} };
  }
}
function writeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
}

// ---------- drawing ----------
function petals(count, rx, ry, dist, p) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const a = (360 / count) * i;
    out += `<ellipse cx="32" cy="${32 - dist}" rx="${rx}" ry="${ry}" transform="rotate(${a} 32 32)" fill="${p.fill}" stroke="${p.ring}" stroke-width="2"/>`;
  }
  return out;
}
// Each kind has its own silhouette, so the game can be played without color vision.
function flowerSVG(kind, size) {
  const p = FLOWERS[kind];
  let body;
  if (kind === 0) { // poppy: five round petals
    body = petals(5, 10, 11, 12, p) + `<circle cx="32" cy="32" r="7" fill="#3b2a26"/>`;
  } else if (kind === 1) { // sunflower: many narrow rays
    body = petals(12, 4.5, 12, 15, p) + `<circle cx="32" cy="32" r="10" fill="#7a4b1c" stroke="#5a3510" stroke-width="2"/>`;
  } else if (kind === 2) { // bluebell: a hanging bell
    body = `<path d="M32 8 Q32 16 32 18" stroke="#2c7a3f" stroke-width="3" fill="none"/>` +
      `<path d="M18 44 Q18 18 32 18 Q46 18 46 44 L50 50 L42 46 L37 51 L32 46 L27 51 L22 46 L14 50 Z" fill="${p.fill}" stroke="${p.ring}" stroke-width="2.5" stroke-linejoin="round"/>`;
  } else { // clover: three heart leaves and a stem
    const leaf = (a) => `<path d="M32 32 C22 26 20 12 30 12 C32 12 32 14 32 16 C32 14 32 12 34 12 C44 12 42 26 32 32 Z" transform="rotate(${a} 32 32)" fill="${p.fill}" stroke="${p.ring}" stroke-width="2"/>`;
    body = leaf(0) + leaf(120) + leaf(240) + `<path d="M32 32 Q36 44 44 54" stroke="${p.ring}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  return `<svg class="flower" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
function pinwheelSVG(size) {
  const blades = ["#f2f7ff", "#ffe08a", "#f2f7ff", "#ffe08a"].map((fill, i) =>
    `<path d="M32 32 L32 6 Q46 10 32 32 Z" transform="rotate(${i * 90} 32 32)" fill="${fill}" stroke="#35506b" stroke-width="2.5" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${blades}<circle cx="32" cy="32" r="5" fill="#35506b"/></svg>`;
}

// ---------- garden scenery ----------
// The gardens sit on a mown lawn: a hedge and picket fence along the top, a
// flower border along the bottom, daisies and grass tufts in between. Drawn
// from a fixed seed for each screen size, so it never changes while playing.
const n1 = (v) => Math.round(v * 10) / 10;
function daisy(x, y, r, petal, centre) {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += `<ellipse cx="${n1(x)}" cy="${n1(y - r * 0.62)}" rx="${n1(r * 0.26)}" ry="${n1(r * 0.48)}" transform="rotate(${i * 45} ${n1(x)} ${n1(y)})" fill="${petal}"/>`;
  }
  return out + `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.3)}" fill="${centre}"/>`;
}
function tuft(x, y, u, color) {
  const h = 7 * u;
  return `<path d="M${n1(x - 3 * u)} ${n1(y)} q${n1(-1 * u)} ${n1(-h * 0.6)} ${n1(-3 * u)} ${n1(-h)} M${n1(x)} ${n1(y)} q0 ${n1(-h * 0.7)} ${n1(1 * u)} ${n1(-h * 1.25)} M${n1(x + 3 * u)} ${n1(y)} q${n1(1 * u)} ${n1(-h * 0.5)} ${n1(4 * u)} ${n1(-h * 0.85)}" stroke="${color}" stroke-width="${n1(1.7 * u)}" stroke-linecap="round" fill="none"/>`;
}
function gardenPinwheel(x, y, r, u, spin) {
  const colors = FLOWERS.map((f) => f.fill);
  const blades = colors.map((fill, i) =>
    `<path d="M0 0 L0 ${n1(-r)} Q${n1(r * 0.62)} ${n1(-r * 0.78)} 0 0 Z" transform="rotate(${spin + i * 90})" fill="${fill}" stroke="#35506b" stroke-width="${n1(2 * u)}" stroke-linejoin="round"/>`).join("");
  return `<g transform="translate(${n1(x)} ${n1(y)})"><rect x="${n1(-2.5 * u)}" y="0" width="${n1(5 * u)}" height="${n1(r * 2.4)}" rx="${n1(2 * u)}" fill="#a8743f" stroke="#6d4424" stroke-width="${n1(1.2 * u)}"/>${blades}<circle r="${n1(r * 0.16)}" fill="#35506b"/></g>`;
}
function gardenSVG(width, height, seed = 11, parts = {}) {
  const { hedge = true, border = true, sticks = true } = parts;
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
  const u = Math.max(0.6, Math.min(w, h) / 400);
  const rand = rng(seed + w * 31 + h);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const out = [];
  const stripe = n1(64 * u);
  out.push(`<defs>
<pattern id="g-stripes" width="${n1(stripe * 2)}" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="${stripe}" height="40" fill="#8bc66a"/><rect x="${stripe}" width="${stripe}" height="40" fill="#7db95d"/></pattern>
<pattern id="g-blades" width="${n1(23 * u)}" height="${n1(19 * u)}" patternUnits="userSpaceOnUse">
<path d="M${n1(3 * u)} ${n1(12 * u)} l${n1(-1 * u)} ${n1(-5 * u)} M${n1(12 * u)} ${n1(6 * u)} l${n1(1.2 * u)} ${n1(-4.5 * u)} M${n1(18 * u)} ${n1(17 * u)} l${n1(-1.4 * u)} ${n1(-4 * u)}" stroke="#6aa94d" stroke-width="${n1(1.3 * u)}" stroke-linecap="round"/>
<path d="M${n1(7 * u)} ${n1(17 * u)} l${n1(1 * u)} ${n1(-4 * u)} M${n1(20 * u)} ${n1(8 * u)} l${n1(-0.8 * u)} ${n1(-4 * u)}" stroke="#a3d983" stroke-width="${n1(1.2 * u)}" stroke-linecap="round"/>
<circle cx="${n1(15 * u)}" cy="${n1(13 * u)}" r="${n1(0.9 * u)}" fill="#5f9c45"/></pattern>
</defs>`);
  out.push(`<rect width="${w}" height="${h}" fill="url(#g-stripes)"/><rect width="${w}" height="${h}" fill="url(#g-blades)"/>`);
  // tufts, clover sprigs and daisies scattered over the lawn
  const tufts = Math.round((w * h) / (4200 * u * u));
  for (let i = 0; i < tufts; i++) out.push(tuft(rand() * w, rand() * h, u * (0.8 + rand() * 0.6), pick(["#5c9a42", "#4f8d3a", "#71b453"])));
  const clovers = Math.round((w * h) / (30000 * u * u));
  for (let i = 0; i < clovers; i++) {
    const x = rand() * w, y = rand() * h, r = (3 + rand() * 1.5) * u;
    out.push([0, 120, 240].map((a) => `<circle cx="${n1(x + Math.sin(a * Math.PI / 180) * r)}" cy="${n1(y - Math.cos(a * Math.PI / 180) * r)}" r="${n1(r)}" fill="#4e9a48" stroke="#3a7a36" stroke-width="${n1(0.8 * u)}"/>`).join(""));
  }
  const daisies = Math.round((w * h) / (16000 * u * u));
  for (let i = 0; i < daisies; i++) {
    out.push(daisy(rand() * w, rand() * h, (5 + rand() * 4) * u, pick(["#fffaf0", "#fff4f7", "#fffdf2"]), pick(["#f4c430", "#f2b632"])));
  }
  // garden pinwheels on sticks, where the screen is wide enough to show them
  if (sticks && w > h * 1.2) {
    out.push(gardenPinwheel(w * 0.05, h * 0.27, 30 * u, u, 12));
    out.push(gardenPinwheel(w * 0.95, h * 0.3, 27 * u, u, 40));
  }
  // hedge and picket fence along the top
  const top = hedge ? Math.round(Math.min(h * 0.13, 92 * u)) : 0;
  if (hedge) {
  out.push(`<rect width="${w}" height="${top}" fill="#3d7a37"/>`);
  for (let x = -20 * u; x < w + 20 * u; x += 15 * u) {
    out.push(`<circle cx="${n1(x + rand() * 6 * u)}" cy="${n1(top * (0.15 + rand() * 0.6))}" r="${n1((11 + rand() * 7) * u)}" fill="${pick(["#4a8b40", "#3f7d3a", "#55994a", "#468642"])}"/>`);
  }
  for (let x = -10 * u; x < w + 10 * u; x += 9 * u) {
    out.push(`<circle cx="${n1(x + rand() * 5 * u)}" cy="${n1(top * (0.1 + rand() * 0.7))}" r="${n1((2 + rand() * 2.5) * u)}" fill="${pick(["#6db35a", "#7cc266", "#5ea64f"])}"/>`);
  }
  for (let i = 0; i < w / (26 * u); i++) {
    out.push(daisy(rand() * w, top * (0.12 + rand() * 0.55), (2.6 + rand() * 1.4) * u, pick(["#ffffff", "#ffd3dc", "#fff1b8"]), "#f2b632"));
  }
  out.push(`<rect y="${n1(top + 12 * u)}" width="${w}" height="${n1(7 * u)}" fill="#2f5d25" opacity="0.22"/>`);
  const rail = (y) => `<rect x="0" y="${n1(y)}" width="${w}" height="${n1(6 * u)}" fill="#efe2c4" stroke="#c4ab80" stroke-width="${n1(1.2 * u)}"/>`;
  out.push(rail(top - 22 * u), rail(top - 2 * u));
  for (let x = 6 * u; x < w; x += 30 * u) {
    const pw = 15 * u, base = top + 12 * u, tip = top - 44 * u;
    out.push(`<path d="M${n1(x)} ${n1(base)} L${n1(x)} ${n1(tip + 7 * u)} L${n1(x + pw / 2)} ${n1(tip)} L${n1(x + pw)} ${n1(tip + 7 * u)} L${n1(x + pw)} ${n1(base)} Z" fill="#f7efdc" stroke="#c4ab80" stroke-width="${n1(1.4 * u)}" stroke-linejoin="round"/>`);
    out.push(`<path d="M${n1(x + pw * 0.3)} ${n1(tip + 12 * u)} L${n1(x + pw * 0.3)} ${n1(base - 4 * u)}" stroke="#e4d4b1" stroke-width="${n1(1.4 * u)}"/>`);
  }
  }
  // flower border along the bottom: brick edging, soil, bushes in bloom
  if (border) {
  const bed = Math.round(Math.min(h * 0.1, 70 * u));
  const soilTop = h - bed * 0.62;
  out.push(`<rect y="${n1(soilTop)}" width="${w}" height="${n1(h - soilTop)}" fill="#7a5236"/>`);
  for (let i = 0; i < w / (6 * u); i++) {
    out.push(`<circle cx="${n1(rand() * w)}" cy="${n1(soilTop + rand() * (h - soilTop))}" r="${n1((0.8 + rand() * 1.2) * u)}" fill="${pick(["#5f3e28", "#946645", "#6a462e"])}"/>`);
  }
  for (let x = 0, k = 0; x < w; x += 22 * u, k++) {
    out.push(`<rect x="${n1(x + 1 * u)}" y="${n1(soilTop - 5 * u)}" width="${n1(20 * u)}" height="${n1(8 * u)}" rx="${n1(2 * u)}" fill="${k % 2 ? "#c8855a" : "#b8744b"}" stroke="#8d5434" stroke-width="${n1(1 * u)}"/>`);
  }
  for (let x = 4 * u; x < w; x += 34 * u) {
    const cx = x + rand() * 10 * u, cy = h - bed * 0.18;
    out.push(`<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(15 * u)}" fill="${pick(["#4a8f43", "#3f8039", "#559c4b"])}"/>`);
    out.push(`<circle cx="${n1(cx - 9 * u)}" cy="${n1(cy + 4 * u)}" r="${n1(10 * u)}" fill="#3f8039"/>`);
    const kind = Math.floor(rand() * 3);
    for (let j = 0; j < 3; j++) {
      const fx = cx + (j - 1) * 8 * u + rand() * 3 * u, fy = cy - (4 + rand() * 7) * u;
      if (kind === 0) out.push(daisy(fx, fy, 4.4 * u, "#ef5a4c", "#3b2a26"));
      else if (kind === 1) out.push(daisy(fx, fy, 4.6 * u, "#f6c230", "#7a4b1c"));
      else out.push(daisy(fx, fy, 4 * u, "#8fb4f0", "#fff6c9"));
    }
  }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${out.join("")}</svg>`;
}

// ---------- game state ----------
const el = (id) => document.getElementById(id);
let save = loadSave();
let state = null; // { level, rows, cols, tiles, start, history, moves, par, hint, spins }

function startLevel(n) {
  const level = generateLevel(n);
  state = {
    level: n, rows: level.rows, cols: level.cols, tiles: level.tiles, start: level.tiles,
    history: [], moves: 0, par: level.par, hint: -1, spins: {}, turned: null,
  };
  el("level-title").textContent = `Garden ${n}`;
  showScreen("play");
  render();
}

function isWide() {
  return window.innerWidth > window.innerHeight * 1.25;
}
// Larger screens get the same layout, zoomed: a tablet or a 1080p window shows
// bigger tiles and text instead of a small board in a sea of lawn.
let ui = 1;
function applyScale() {
  const w = window.innerWidth, h = window.innerHeight;
  ui = isWide() ? Math.min(2.4, Math.max(1, h / 560)) : Math.min(1.8, Math.max(1, w / 500));
  ui = Math.round(ui * 100) / 100;
  const app = el("app");
  app.style.zoom = ui === 1 ? "" : String(ui);
  app.style.width = ui === 1 ? "" : (w / ui).toFixed(2) + "px";
  app.style.height = ui === 1 ? "" : (h / ui).toFixed(2) + "px";
}
function layout() {
  const wide = isWide();
  const viewW = window.innerWidth / ui, viewH = window.innerHeight / ui;
  const width = wide ? viewW * 0.46 : Math.min(viewW, 560) - 24;
  const height = wide ? viewH - 40 : viewH - 236;
  // A tile and its gap take 1.1 tile widths; the planter frame, soil margin and
  // row marks add about half a tile plus 34px across and 0.42 tiles down.
  const across = (width - 34) / (state.cols * 1.1 + 0.52);
  const down = (height - 8) / (state.rows * 1.1 + 0.42);
  const tile = Math.floor(Math.max(44, Math.min(wide ? 150 : 112, across, down)));
  return { tile, gap: Math.max(5, Math.round(tile * 0.1)) };
}

function render() {
  const board = el("board");
  const { tile, gap } = layout();
  const flower = Math.round(tile * 0.72);
  board.innerHTML = "";
  board.parentElement.style.setProperty("--tile", tile + "px");
  board.style.setProperty("--gap", gap + "px");
  board.style.setProperty("--cols", String(state.cols));
  board.style.setProperty("--rows", String(state.rows));
  for (let r = 0; r < state.rows; r++) {
    const done = rowDone(state.tiles, state.cols, r);
    for (let c = 0; c < state.cols; c++) {
      const i = r * state.cols + c;
      const cell = document.createElement("div");
      cell.className = "tile" + (done ? " done" : "") + (state.turned && state.turned.includes(i) ? " moved" : "");
      cell.style.gridRow = String(r + 1);
      cell.style.gridColumn = String(c + 1);
      cell.style.background = FLOWERS[state.tiles[i]].tile;
      cell.setAttribute("data-kind", FLOWERS[state.tiles[i]].name);
      cell.innerHTML = flowerSVG(state.tiles[i], flower);
      board.appendChild(cell);
    }
    const mark = document.createElement("div");
    mark.className = "row-mark" + (done ? " done" : "");
    mark.style.gridRow = String(r + 1);
    mark.style.gridColumn = String(state.cols + 1);
    mark.textContent = done ? "✓" : "";
    board.appendChild(mark);
  }
  const knob = Math.round(tile * 0.5);
  for (let k = 0; k < pinwheelCount(state.rows, state.cols); k++) {
    const r = Math.floor(k / (state.cols - 1));
    const c = k % (state.cols - 1);
    const btn = document.createElement("button");
    btn.className = "pinwheel" + (state.hint === k ? " hint" : "");
    btn.setAttribute("data-wheel", String(k));
    btn.setAttribute("aria-label", "Turn pinwheel " + (k + 1));
    btn.style.width = btn.style.height = knob + "px";
    btn.style.left = gap + (c + 1) * (tile + gap) - gap / 2 - knob / 2 + "px";
    btn.style.top = gap + (r + 1) * (tile + gap) - gap / 2 - knob / 2 + "px";
    btn.style.setProperty("--spin", ((state.spins[k] || 0) * 90) + "deg");
    btn.innerHTML = pinwheelSVG(knob);
    btn.addEventListener("click", () => turn(k));
    board.appendChild(btn);
  }
  // On wide screens the result card sits beside the bed; keep it out of the bed.
  const side = (window.innerWidth / ui - board.parentElement.offsetWidth) / 2 - 20;
  el("app").style.setProperty("--side", Math.max(170, Math.round(side)) + "px");
  el("moves").textContent = String(state.moves);
  el("par").textContent = String(state.par);
  el("undo").disabled = !state.history.length;
}

function turn(k) {
  if (!el("result").hidden) return;
  state.history.push({ tiles: state.tiles, wheel: k });
  state.tiles = applyTurn(state.tiles, state.cols, k);
  state.spins[k] = (state.spins[k] || 0) + 1;
  state.turned = pinwheelCells(state.cols, k);
  state.moves++;
  state.hint = -1;
  el("toast").textContent = "";
  render();
  if (isSolved(state.tiles, state.rows, state.cols)) setTimeout(finishLevel, 350);
}

function starsFor(moves, par) {
  if (moves <= par) return 3;
  if (moves <= par + 2) return 2;
  return 1;
}

function finishLevel() {
  const stars = starsFor(state.moves, state.par);
  const prev = save.stars[state.level] || 0;
  save.stars[state.level] = Math.max(prev, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(state.level + 1, TOTAL_LEVELS));
  writeSave(save);
  el("result-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  el("result-text").textContent = `Finished in ${state.moves} moves. Three stars at ${state.par}.`;
  el("next").hidden = state.level >= TOTAL_LEVELS;
  el("result").hidden = false;
  petalShower();
}

function petalShower() {
  const layer = el("petals");
  layer.innerHTML = "";
  const rand = rng(state.level * 97 + state.moves);
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("span");
    p.className = "petal";
    p.style.left = (4 + rand() * 92).toFixed(1) + "%";
    p.style.background = FLOWERS[i % FLOWERS.length].fill;
    p.style.animationDelay = (rand() * 0.5).toFixed(2) + "s";
    p.style.setProperty("--drift", Math.round(rand() * 80 - 40) + "px");
    layer.appendChild(p);
  }
  clearTimeout(petalShower.timer);
  petalShower.timer = setTimeout(() => { layer.innerHTML = ""; }, 2600);
}

function undo() {
  const last = state.history.pop();
  if (!last) return;
  state.tiles = last.tiles;
  state.spins[last.wheel] = (state.spins[last.wheel] || 0) - 1;
  state.turned = pinwheelCells(state.cols, last.wheel);
  state.moves++;
  state.hint = -1;
  el("toast").textContent = "";
  render();
}

function hint() {
  let path = solve(state.tiles, state.rows, state.cols);
  if (!path) path = solve(state.tiles, state.rows, state.cols, 5, 4);
  state.hint = path && path.length ? path[0] : -1;
  state.turned = null;
  el("toast").textContent = state.hint >= 0 ? "Turn the glowing pinwheel." : "This garden is far from finished. Try Undo or Restart.";
  render();
}

function showScreen(name) {
  for (const s of ["menu", "levels", "play"]) el(`screen-${s}`).hidden = s !== name;
  el("result").hidden = true;
  el("toast").textContent = "";
}

function renderLevels() {
  const grid = el("level-grid");
  grid.innerHTML = "";
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    const b = document.createElement("button");
    b.className = "level";
    const s = save.stars[n] || 0;
    const level = levelSpec(n);
    b.setAttribute("data-level", String(n));
    b.innerHTML = `<span class="num">${n}</span><span class="size">${level.rows}×${level.cols}</span><span class="st">${"★".repeat(s) || "·"}</span>`;
    b.addEventListener("click", () => startLevel(n));
    grid.appendChild(b);
  }
  showScreen("levels");
}

function firstOpenGarden() {
  for (let n = 1; n <= TOTAL_LEVELS; n++) if (!save.stars[n]) return n;
  return TOTAL_LEVELS;
}

let gardenSize = "";
function paintGarden() {
  const size = window.innerWidth + "x" + window.innerHeight;
  if (size === gardenSize) return;
  gardenSize = size;
  el("garden").innerHTML = gardenSVG(window.innerWidth, window.innerHeight);
}

function boot() {
  if (!el("app")) return; // the art pages reuse the drawing code only
  applyScale();
  paintGarden();
  el("play-btn").addEventListener("click", () => startLevel(firstOpenGarden()));
  el("levels-btn").addEventListener("click", renderLevels);
  el("back-menu").addEventListener("click", () => showScreen("menu"));
  el("back-levels").addEventListener("click", renderLevels);
  el("undo").addEventListener("click", undo);
  el("restart").addEventListener("click", () => startLevel(state.level));
  el("hint").addEventListener("click", hint);
  el("next").addEventListener("click", () => startLevel(state.level + 1));
  el("replay").addEventListener("click", () => startLevel(state.level));
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    applyScale();
    if (state && !el("screen-play").hidden) render();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(paintGarden, 120);
  });
  el("menu-art").innerHTML = [0, 1, 2, 3].map((k) => flowerSVG(k, 46)).join("") ;
  el("menu-art").insertAdjacentHTML("afterbegin", `<span class="menu-wheel">${pinwheelSVG(64)}</span>`);
  showScreen("menu");
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", boot);
if (typeof module !== "undefined") {
  module.exports = { generateLevel, solve, applyTurn, applyTurnBack, isSolved, rowDone, pinwheelCount, pinwheelCells, TOTAL_LEVELS, levelSpec, flowerSVG, pinwheelSVG, gardenSVG, FLOWERS };
}
