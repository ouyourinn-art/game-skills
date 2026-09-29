"use strict";
// Tidepool Sort — gather matching shells into the same tide pool.
// Pure offline HTML5 game; progress is stored on the device only.

const CAPACITY = 4;
const PALETTE = [
  { id: 0, name: "coral",  fill: "#ff7a6b", ring: "#c94a3d" },
  { id: 1, name: "sun",    fill: "#ffc83d", ring: "#c7931a" },
  { id: 2, name: "kelp",   fill: "#58c47a", ring: "#2f8a4d" },
  { id: 3, name: "lagoon", fill: "#3fb5e8", ring: "#1f7fae" },
  { id: 4, name: "urchin", fill: "#9b6cf0", ring: "#6a40b8" },
  { id: 5, name: "pearl",  fill: "#f4efe6", ring: "#b9ad97" },
  { id: 6, name: "ink",    fill: "#3e4a6b", ring: "#222a40" },
];
// Each color gets its own shell outline so the game is playable without color vision.
const SHAPES = ["scallop", "spiral", "star", "clam", "urchin", "pearl", "snail"];
const TOTAL_LEVELS = 30;
const SAVE_KEY = "tidepool-sort-v1";

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
function topRun(pool) {
  if (!pool.length) return { color: -1, count: 0 };
  const color = pool[pool.length - 1];
  let count = 0;
  for (let i = pool.length - 1; i >= 0 && pool[i] === color; i--) count++;
  return { color, count };
}
function canMove(pools, from, to) {
  if (from === to) return false;
  const a = pools[from], b = pools[to];
  if (!a.length || b.length >= CAPACITY) return false;
  const run = topRun(a);
  if (b.length && b[b.length - 1] !== run.color) return false;
  // Moving a complete pool into an empty one is legal but pointless.
  if (!b.length && run.count === a.length) return false;
  return true;
}
function applyMove(pools, from, to) {
  const next = pools.map((p) => p.slice());
  const run = topRun(next[from]);
  const room = CAPACITY - next[to].length;
  const n = Math.min(run.count, room);
  for (let i = 0; i < n; i++) next[to].push(next[from].pop());
  return { pools: next, moved: n };
}
function isSolved(pools) {
  return pools.every((p) => p.length === 0 || (p.length === CAPACITY && p.every((c) => c === p[0])));
}
function key(pools) {
  return pools.map((p) => p.join("")).sort().join("|");
}

// ---------- solver (used for level generation and hints) ----------
function solve(pools, budget = 60000) {
  const seen = new Set();
  const path = [];
  let steps = 0;
  function dfs(state) {
    if (isSolved(state)) return true;
    if (++steps > budget) return false;
    const k = key(state);
    if (seen.has(k)) return false;
    seen.add(k);
    for (let f = 0; f < state.length; f++) {
      for (let t = 0; t < state.length; t++) {
        if (!canMove(state, f, t)) continue;
        path.push([f, t]);
        if (dfs(applyMove(state, f, t).pools)) return true;
        path.pop();
      }
    }
    return false;
  }
  return dfs(pools) ? path.slice() : null;
}

// ---------- levels ----------
function levelSpec(n) {
  const colors = Math.min(3 + Math.floor((n - 1) / 5), PALETTE.length);
  const empties = n <= 20 ? 2 : 1 + (n % 2);
  return { colors, empties };
}
function generateLevel(n) {
  const { colors, empties } = levelSpec(n);
  for (let attempt = 0; attempt < 200; attempt++) {
    const rand = rng(n * 7919 + attempt * 104729);
    const bag = [];
    for (let c = 0; c < colors; c++) for (let i = 0; i < CAPACITY; i++) bag.push(c);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const pools = [];
    for (let c = 0; c < colors; c++) pools.push(bag.slice(c * CAPACITY, (c + 1) * CAPACITY));
    for (let e = 0; e < empties; e++) pools.push([]);
    if (isSolved(pools)) continue;
    // Reject boards that start with an already-finished pool.
    if (pools.some((p) => p.length === CAPACITY && p.every((c) => c === p[0]))) continue;
    const solution = solve(pools);
    if (solution) return { pools, par: solution.length };
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
function shellSVG(color, size = 44) {
  const p = PALETTE[color];
  const shape = SHAPES[color];
  const common = `fill="${p.fill}" stroke="${p.ring}" stroke-width="3"`;
  let body;
  switch (shape) {
    case "scallop":
      body = `<path ${common} d="M22 40 L6 18 Q22 0 38 18 Z"/><path d="M22 40 L14 12 M22 40 L22 8 M22 40 L30 12" stroke="${p.ring}" stroke-width="2"/>`;
      break;
    case "spiral":
      body = `<circle ${common} cx="22" cy="22" r="17"/><path d="M22 22 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 1 1 7 7 a11 11 0 0 1 -11 -11" fill="none" stroke="${p.ring}" stroke-width="2.5"/>`;
      break;
    case "star":
      body = `<path ${common} d="M22 4 L27 17 L41 17 L30 26 L34 40 L22 32 L10 40 L14 26 L3 17 L17 17 Z"/>`;
      break;
    case "clam":
      body = `<ellipse ${common} cx="22" cy="24" rx="18" ry="13"/><path d="M6 24 Q22 34 38 24" fill="none" stroke="${p.ring}" stroke-width="2.5"/>`;
      break;
    case "urchin":
      body = `<circle ${common} cx="22" cy="22" r="12"/>` + Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return `<line x1="${22 + Math.cos(a) * 12}" y1="${22 + Math.sin(a) * 12}" x2="${22 + Math.cos(a) * 19}" y2="${22 + Math.sin(a) * 19}" stroke="${p.ring}" stroke-width="3" stroke-linecap="round"/>`;
      }).join("");
      break;
    case "pearl":
      body = `<circle ${common} cx="22" cy="22" r="16"/><circle cx="16" cy="16" r="4" fill="#ffffff" opacity="0.9"/>`;
      break;
    default: // snail
      body = `<path ${common} d="M6 34 Q6 10 24 10 Q38 10 38 24 Q38 34 28 34 Z"/><circle cx="24" cy="22" r="6" fill="none" stroke="${p.ring}" stroke-width="2.5"/>`;
  }
  return `<svg class="shell" viewBox="0 0 44 44" width="${size}" height="${size}" aria-label="${p.name}">${body}</svg>`;
}

// ---------- game state ----------
const el = (id) => document.getElementById(id);
let save = loadSave();
let state = null; // { level, pools, history, moves, par, selected, undos }

function startLevel(n) {
  const { pools, par } = generateLevel(n);
  state = { level: n, pools, history: [], moves: 0, par, selected: -1, undos: 3, hint: null };
  el("level-title").textContent = `Pool ${n}`;
  showScreen("play");
  render();
}

function render() {
  const board = el("board");
  board.innerHTML = "";
  const cols = Math.min(state.pools.length, 4);
  const rows = Math.ceil(state.pools.length / cols);
  // Fit every pool on screen: shrink pools and shells on short phones.
  const poolH = Math.max(120, Math.min(224, (window.innerHeight - 170) / rows - 14));
  const shell = Math.min(44, Math.floor((poolH - 28) / CAPACITY));
  board.style.setProperty("--cols", String(cols));
  board.style.setProperty("--pool-h", poolH + "px");
  board.style.setProperty("--shell", shell + "px");
  state.pools.forEach((pool, i) => {
    const btn = document.createElement("button");
    btn.className = "pool";
    btn.setAttribute("data-pool", String(i));
    btn.setAttribute("aria-label", `Tide pool ${i + 1}`);
    if (state.selected === i) btn.classList.add("selected");
    if (state.hint && (state.hint[0] === i || state.hint[1] === i)) btn.classList.add("hint");
    if (pool.length === CAPACITY && pool.every((c) => c === pool[0])) btn.classList.add("done");
    const stack = document.createElement("div");
    stack.className = "stack";
    pool.forEach((c) => { stack.insertAdjacentHTML("beforeend", shellSVG(c)); });
    btn.appendChild(stack);
    btn.addEventListener("click", () => tapPool(i));
    board.appendChild(btn);
  });
  el("moves").textContent = String(state.moves);
  el("par").textContent = String(state.par);
  el("undo").textContent = `Undo (${state.undos})`;
  el("undo").disabled = !state.history.length || state.undos <= 0;
}

function tapPool(i) {
  state.hint = null;
  if (state.selected === -1) {
    if (state.pools[i].length) state.selected = i;
  } else if (state.selected === i) {
    state.selected = -1;
  } else if (canMove(state.pools, state.selected, i)) {
    state.history.push(state.pools);
    state.pools = applyMove(state.pools, state.selected, i).pools;
    state.moves++;
    state.selected = -1;
    if (isSolved(state.pools)) { render(); return finishLevel(); }
  } else {
    state.selected = state.pools[i].length ? i : -1;
  }
  render();
}

function starsFor(moves, par) {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.4)) return 2;
  return 1;
}

function finishLevel() {
  const stars = starsFor(state.moves, state.par);
  const prev = save.stars[state.level] || 0;
  save.stars[state.level] = Math.max(prev, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(state.level + 1, TOTAL_LEVELS));
  writeSave(save);
  el("result-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  el("result-text").textContent = `Sorted in ${state.moves} moves. Target: ${state.par} moves for three stars.`;
  el("next").hidden = state.level >= TOTAL_LEVELS;
  el("result").hidden = false;
}

function undo() {
  if (!state.history.length || state.undos <= 0) return;
  state.pools = state.history.pop();
  state.undos--;
  state.moves++;
  state.selected = -1;
  state.hint = null;
  render();
}

function hint() {
  const path = solve(state.pools, 40000);
  state.selected = -1;
  state.hint = path && path.length ? path[0] : null;
  if (!state.hint) el("toast").textContent = "No way forward from here — try Undo or Restart.";
  else el("toast").textContent = "";
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
    const locked = n > save.unlocked;
    b.disabled = locked;
    const s = save.stars[n] || 0;
    b.innerHTML = `<span class="num">${n}</span><span class="st">${locked ? "🔒" : "★".repeat(s) || "·"}</span>`;
    b.addEventListener("click", () => startLevel(n));
    grid.appendChild(b);
  }
  showScreen("levels");
}

function boot() {
  el("play-btn").addEventListener("click", () => startLevel(Math.min(save.unlocked, TOTAL_LEVELS)));
  el("levels-btn").addEventListener("click", renderLevels);
  el("back-menu").addEventListener("click", () => showScreen("menu"));
  el("back-levels").addEventListener("click", renderLevels);
  el("undo").addEventListener("click", undo);
  el("restart").addEventListener("click", () => startLevel(state.level));
  el("hint").addEventListener("click", hint);
  el("next").addEventListener("click", () => startLevel(state.level + 1));
  el("replay").addEventListener("click", () => startLevel(state.level));
  el("menu-shells").innerHTML = [0, 1, 2, 3, 4].map((c) => shellSVG(c, 40)).join("");
  showScreen("menu");
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", boot);
if (typeof module !== "undefined") module.exports = { generateLevel, solve, canMove, applyMove, isSolved, TOTAL_LEVELS, levelSpec };
