(() => {
  "use strict";

  const ROUND_SIZE = 7;
  const SECONDS = 30;
  const MAX_POINTS = ROUND_SIZE * 100;
  const TOWER_FEET = 307;
  const LAUNCH_DAY = "2026-11-18"; // Daily climb #1
  const STORE_KEY = "longshot.v1";
  const TIER_EMOJI = { 0: "⬛", 1: "⬜", 2: "🟩", 3: "🟦", 4: "🟪", 5: "🟧" };

  const PROMPTS = window.PROMPTS;
  const TIERS = window.TIERS;
  const $ = (id) => document.getElementById(id);
  const screen = $("screen");

  // ---------- storage (best effort) ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  // ---------- dates and seeded shuffle ----------
  function todayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function dayNumber(key) {
    const a = new Date(LAUNCH_DAY + "T00:00:00");
    const b = new Date(key + "T00:00:00");
    return Math.round((b - a) / 86400000) + 1;
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickPrompts(random) {
    const pool = PROMPTS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, ROUND_SIZE);
  }

  // ---------- answer matching ----------
  function norm(s) {
    return s
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’.]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/^(the|a|an) /, "")
      .trim();
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }
  function allowance(len) {
    if (len >= 10) return 2;
    if (len >= 5) return 1;
    return 0;
  }
  // Returns the matching answer entry, or null.
  function judge(prompt, raw) {
    const guess = norm(raw);
    if (!guess) return null;
    let best = null;
    let bestDist = Infinity;
    for (const ans of prompt.answers) {
      for (const form of [ans.a, ...ans.alt]) {
        const f = norm(form);
        const d = f === guess ? 0 : lev(f, guess);
        if (d <= allowance(f.length) && (d < bestDist || (d === bestDist && ans.t > best.t))) {
          best = ans; bestDist = d;
        }
      }
    }
    return best;
  }

  // ---------- tower ----------
  function setTower(points) {
    const ratio = Math.min(points / MAX_POINTS, 1);
    const h = 300 * ratio;
    const fill = $("tower-fill");
    fill.setAttribute("y", String(310 - h));
    fill.setAttribute("height", String(h));
    $("feet").textContent = String(Math.round(TOWER_FEET * ratio));
    document.querySelector(".tower-wrap").classList.toggle("lit", ratio >= 1);
  }
  const feetFor = (pts) => Math.round(TOWER_FEET * Math.min(pts / MAX_POINTS, 1));

  // ---------- rendering helpers ----------
  function mount(tplId) {
    screen.replaceChildren($(tplId).content.cloneNode(true));
    window.scrollTo(0, 0);
  }
  function badge(t) {
    const el = document.createElement("span");
    el.className = `badge t${t}`;
    el.textContent = t ? `${TIERS[t].name} · ${TIERS[t].points}` : "Off the board · 0";
    return el;
  }
  function renderStats() {
    const d = load();
    const streak = d.streak || 0;
    const best = d.best || 0;
    $("stats").textContent = `Streak ${streak} · Best ${best} pts`;
  }

  // ---------- game state ----------
  let game = null;
  let timer = null;

  function startGame(mode) {
    const key = todayKey();
    const random = mode === "daily" ? rng(hashString("longshot:" + key)) : rng((Math.random() * 2 ** 32) >>> 0);
    game = { mode, key, prompts: pickPrompts(random), index: 0, points: 0, results: [] };
    setTower(0);
    showQuestion();
  }

  function showQuestion() {
    const p = game.prompts[game.index];
    mount("tpl-question");
    $("q-count").textContent = `${game.index + 1} of ${ROUND_SIZE}`;
    $("q-cat").textContent = p.category;
    $("q-prompt").textContent = p.prompt;
    const input = $("answer");
    input.focus();

    const deadline = Date.now() + SECONDS * 1000;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      const secs = Math.ceil(left / 1000);
      $("timer-bar").style.width = `${(left / (SECONDS * 1000)) * 100}%`;
      $("timer-bar").classList.toggle("low", secs <= 5);
      $("timer-text").textContent = `${secs}s left`;
      if (left <= 0) submit(input.value, true);
    };
    clearInterval(timer);
    timer = setInterval(tick, 200);
    tick();

    $("answer-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!input.value.trim()) { input.focus(); return; }
      submit(input.value, false);
    });
    $("btn-skip").addEventListener("click", () => submit("", false));
  }

  function submit(raw, timedOut) {
    clearInterval(timer);
    const p = game.prompts[game.index];
    const match = judge(p, raw);
    const t = match ? match.t : 0;
    const pts = t ? TIERS[t].points : 0;
    game.points += pts;
    game.results.push({ id: p.id, prompt: p.prompt, raw: raw.trim(), answer: match ? match.a : null, t, pts, timedOut });
    setTower(game.points);
    showReveal(p, raw.trim(), match, timedOut);
  }

  function showReveal(p, raw, match, timedOut) {
    mount("tpl-reveal");
    $("r-count").textContent = `${game.index + 1} of ${ROUND_SIZE}`;
    $("r-cat").textContent = p.category;
    $("r-prompt").textContent = p.prompt;

    const v = $("verdict");
    const you = document.createElement("span");
    you.className = "you";
    you.textContent = raw ? `“${raw}”` : (timedOut ? "Time ran out" : "Skipped");
    const pts = document.createElement("span");
    pts.className = "pts";
    pts.textContent = `+${match ? TIERS[match.t].points : 0}`;
    const why = document.createElement("span");
    why.className = "why";
    if (match) {
      why.textContent = norm(match.a) === norm(raw) ? "On the board." : `Counted as ${match.a}.`;
    } else if (raw) {
      why.textContent = "That one isn't on our board. Check your spelling, or try a different answer next time.";
    } else {
      why.textContent = "No answer, no climb.";
    }
    v.append(you, badge(match ? match.t : 0), pts, why);

    // Show the rarest answers first, skipping the one the player gave.
    const others = p.answers
      .filter((a) => !match || a.a !== match.a)
      .slice()
      .sort((a, b) => b.t - a.t);
    const shown = [...others.filter((a) => a.t >= 4).slice(0, 3), ...others.filter((a) => a.t <= 2).slice(0, 2)];
    const list = $("others");
    for (const a of shown) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = a.a;
      li.append(name, badge(a.t));
      list.append(li);
    }

    const next = $("btn-next");
    next.textContent = game.index + 1 < ROUND_SIZE ? "Next prompt" : "See my climb";
    next.addEventListener("click", () => {
      game.index++;
      if (game.index < ROUND_SIZE) showQuestion(); else finish();
    });
    next.focus();
  }

  function finish() {
    const data = load();
    data.best = Math.max(data.best || 0, game.points);
    if (game.mode === "daily") {
      const yesterday = todayKey(new Date(Date.now() - 86400000));
      data.streak = data.lastDaily === yesterday ? (data.streak || 0) + 1 : 1;
      data.lastDaily = game.key;
      data.daily = data.daily || {};
      data.daily[game.key] = { points: game.points, results: game.results };
    }
    save(data);
    renderStats();
    showEnd(game);
  }

  function title(points) {
    if (points >= MAX_POINTS) return "You lit the Tower orange!";
    if (points >= 500) return "Observation deck. Legendary climb.";
    if (points >= 350) return "Halfway up and still climbing.";
    if (points >= 175) return "Solid start on the Forty Acres.";
    return "Still in the lobby. Hook 'em next time.";
  }

  function shareText(g) {
    const label = g.mode === "daily" ? `Longhorn Long Shot #${dayNumber(g.key)}` : "Longhorn Long Shot (practice)";
    const grid = g.results.map((r) => TIER_EMOJI[r.t]).join("");
    return `${label}\n${grid}\n${g.points} pts · ${feetFor(g.points)} of ${TOWER_FEET} ft 🤘`;
  }

  function showEnd(g) {
    mount("tpl-end");
    setTower(g.points);
    $("end-title").textContent = title(g.points);
    $("end-points").textContent = g.points;
    $("end-feet").textContent = feetFor(g.points);
    $("end-grid").textContent = g.results.map((r) => TIER_EMOJI[r.t]).join("");

    const ul = $("summary");
    for (const r of g.results) {
      const li = document.createElement("li");
      const ans = document.createElement("span");
      ans.textContent = r.answer || (r.raw ? `“${r.raw}”` : "No answer");
      const sp = document.createElement("span");
      sp.className = "sp";
      sp.textContent = r.prompt;
      li.append(ans, badge(r.t), sp);
      ul.append(li);
    }

    $("btn-share").addEventListener("click", async () => {
      const text = shareText(g);
      try {
        await navigator.clipboard.writeText(text);
        $("share-note").textContent = "Copied. Go brag in the group chat.";
      } catch {
        $("share-note").textContent = text;
      }
    });
    $("btn-again").addEventListener("click", () => startGame("practice"));
    $("btn-home").addEventListener("click", showHome);
  }

  function showHome() {
    clearInterval(timer);
    mount("tpl-home");
    setTower(0);
    const key = $("tier-key");
    for (const t of [1, 2, 3, 4, 5]) key.append(badge(t));

    const today = todayKey();
    const played = (load().daily || {})[today];
    const note = $("daily-note");
    if (played) {
      $("btn-daily").textContent = "See today's climb";
      note.textContent = `You already climbed today (${played.points} pts). A new daily climb unlocks at midnight.`;
      $("btn-daily").addEventListener("click", () => {
        showEnd({ mode: "daily", key: today, points: played.points, results: played.results });
      });
    } else {
      note.textContent = `Daily climb #${dayNumber(today)}: everyone gets the same seven prompts today.`;
      $("btn-daily").addEventListener("click", () => startGame("daily"));
    }
    $("btn-practice").addEventListener("click", () => startGame("practice"));
  }

  // Exposed for quick checks in the browser console.
  window.LongShot = { judge, norm };

  renderStats();
  showHome();
})();
