/* =====================================================================
   core.js · Tiện ích dùng chung (không cần sửa)
   Globals: Core, Icons, Badges, Mascot, Sfx, Music, Fx
   ===================================================================== */
(function () {
  "use strict";

  const INK = "#3A2340";

  /* ---------------- DOM + helpers ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // h("div.panel.panel--pink", { text, html, onClick, dataset, style, ...attrs }, ...children)
  function h(tag, props, ...children) {
    const [name, ...classes] = String(tag).split(".");
    const el = document.createElement(name || "div");
    if (classes.length) el.className = classes.join(" ");
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className += (el.className ? " " : "") + v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k === "style" && typeof v === "object") {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith("--")) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        } else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => (Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr);
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const reducedMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (str, vars) => String(str == null ? "" : str).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  function cssMs(name, fallback) {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }
  // Restart a CSS animation class (remove → reflow → add)
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* no-op */ }
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const isVideo = (src) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src || "");

  /* ---------------- Storage (safe) ---------------- */
  const Store = {
    key: "hanh-trinh-cua-tui-minh-v1",
    get() {
      try { return JSON.parse(localStorage.getItem(this.key)); } catch (e) { return null; }
    },
    set(v) {
      try { localStorage.setItem(this.key, JSON.stringify(v)); } catch (e) { /* private mode */ }
    },
    clear() {
      try { localStorage.removeItem(this.key); } catch (e) { /* no-op */ }
    },
  };

  /* ---------------- Image preload ---------------- */
  const imgCache = new Map();
  function loadImage(src) {
    if (!src) return Promise.resolve(false);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((resolve) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => resolve(true);
      im.onerror = () => resolve(false);
      im.src = src;
    });
    imgCache.set(src, p);
    return p;
  }
  function preload(list) {
    return Promise.all((list || []).filter(Boolean).map((s) => (isVideo(s) ? Promise.resolve(true) : loadImage(s))));
  }

  window.Core = { INK, $, $$, h, sleep, clamp, rand, randInt, pick, shuffle, reducedMotion, fmt, cssMs, replay, vibrate, center, isVideo, Store, loadImage, preload };

  /* ---------------- Icons (stroke, currentColor) ---------------- */
  const I = (inner, sw = 2.6) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
  const HEART_24 = "M12 20.5C7 17 2.5 13.2 2.5 8.6 2.5 5.7 4.7 3.5 7.4 3.5c1.9 0 3.6 1.1 4.6 2.8 1-1.7 2.7-2.8 4.6-2.8 2.7 0 4.9 2.2 4.9 5.1 0 4.6-4.5 8.4-9.5 11.9z";
  const STAR_24 = "M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";

  window.Icons = {
    HEART_PATH: HEART_24,
    STAR_PATH: STAR_24,
    heart: I(`<path d="${HEART_24}"/>`),
    heartFill: I(`<path d="${HEART_24}" fill="currentColor"/>`),
    star: I(`<path d="${STAR_24}"/>`),
    starFill: I(`<path d="${STAR_24}" fill="currentColor"/>`),
    lock: I('<rect x="4.5" y="10.5" width="15" height="10.5" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
    check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3.2),
    x: I('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 3.2),
    soundOn: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>'),
    soundOff: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
    clock: I('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 3h5"/>'),
    backspace: I('<path d="M9.5 5.5H20a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.5L3 12z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/>'),
    play: I('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
    refresh: I('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
    gift: I('<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7M12 8.5V21"/><path d="M12 8.5C10.5 5 7 4 7 6.5 7 8 9 8.5 12 8.5zM12 8.5C13.5 5 17 4 17 6.5 17 8 15 8.5 12 8.5z"/>'),
    sparkle: I('<path d="M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z" fill="currentColor"/>', 1.6),
    arrowRight: I('<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>'),
    image: I('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>'),
  };

  /* ---------------- Level badges (illustrated, 80x80) ---------------- */
  const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const HEART_80 = (x, y, s, fill) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M12 20.5C7 17 2.5 13.2 2.5 8.6 2.5 5.7 4.7 3.5 7.4 3.5c1.9 0 3.6 1.1 4.6 2.8 1-1.7 2.7-2.8 4.6-2.8 2.7 0 4.9 2.2 4.9 5.1 0 4.6-4.5 8.4-9.5 11.9z" fill="${fill}" stroke="${INK}" stroke-width="${(4 / s).toFixed(2)}" stroke-linejoin="round"/>`;
  const svg80 = (inner) => `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false" style="overflow:visible">${inner}</svg>`;
  window.Badges = {
    quiz: svg80(
      `<path d="M16 14h48a9 9 0 0 1 9 9v25a9 9 0 0 1-9 9H38L24 69V57h-8a9 9 0 0 1-9-9V23a9 9 0 0 1 9-9z" fill="#fff" ${S}/>` +
        `<path d="M33 29c0-5 3.5-8 7.5-8S48 24 48 28.5c0 5-7.5 5.5-7.5 10.5" fill="none" stroke="#FF7FA8" stroke-width="6" stroke-linecap="round"/><circle cx="40.5" cy="47" r="3.6" fill="#FF7FA8"/>`
    ),
    blur: svg80(
      `<filter id="bdg-blur"><feGaussianBlur stdDeviation="2.6"/></filter>` +
        `<rect x="8" y="12" width="64" height="56" rx="9" fill="#fff" ${S}/>` +
        `<rect x="15" y="19" width="50" height="36" rx="5" fill="#C4E7FF"/>` +
        `<circle cx="30" cy="31" r="7" fill="#FFD24A" filter="url(#bdg-blur)"/>` +
        `<path d="M15 55l15-15 10 8 11-12 14 19z" fill="#4DD0AB" filter="url(#bdg-blur)"/>` +
        `<circle cx="58" cy="58" r="13" fill="#FFA3C2" ${S}/><path d="M53.5 55.5c0-3 2-4.6 4.5-4.6s4.5 1.6 4.5 4.2c0 3-4.5 3.2-4.5 6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="58" cy="65" r="2" fill="#fff"/>`
    ),
    memory: svg80(
      `<rect x="10" y="18" width="34" height="46" rx="7" transform="rotate(-10 27 41)" fill="#FF7FA8" ${S}/>` +
        HEART_80(15, 30, 0.72, "#fff") +
        `<rect x="36" y="14" width="34" height="46" rx="7" transform="rotate(9 53 37)" fill="#79E2C3" ${S}/>` +
        `<path d="M47.5 31c0-4.2 3-6.8 6.5-6.8s6.5 2.6 6.5 6.4c0 4.4-6.5 4.8-6.5 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="54" cy="47" r="3" fill="#fff"/>`
    ),
    puzzle: svg80(
      `<path d="M18 22h13a7 7 0 1 1 14 0h13v13a7 7 0 1 0 0 14v13H45a7 7 0 1 0-14 0H18V49a7 7 0 1 1 0-14z" fill="#79E2C3" ${S}/>` +
        `<path d="M24 28h8" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`
    ),
    hearts: svg80(
      HEART_80(22, 2, 1.5, "#FF7FA8") +
        `<rect x="9" y="38" width="62" height="11" rx="5.5" fill="#FFE27A" ${S}/>` +
        `<path d="M14 49h52l-5 19a6 6 0 0 1-6 4.5H25a6 6 0 0 1-6-4.5z" fill="#FFD24A" ${S}/>` +
        `<path d="M30 53l2 16M40 53v16M50 53l-2 16" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".35"/>`
    ),
    gift: svg80(
      `<rect x="12" y="36" width="56" height="34" rx="6" fill="#FF7FA8" ${S}/>` +
        `<rect x="8" y="26" width="64" height="14" rx="5" fill="#FFA3C2" ${S}/>` +
        `<path d="M40 26v44" stroke="${INK}" stroke-width="4"/><rect x="35" y="26" width="10" height="44" fill="#79E2C3" ${S}/>` +
        `<path d="M40 26c-4-11-19-15-19-5 0 5 9 5 19 5zM40 26c4-11 19-15 19-5 0 5-9 5-19 5z" fill="#79E2C3" ${S}/>`
    ),
  };

  /* ---------------- Mascot (heart buddy) ---------------- */
  function face(mood) {
    const eye = (cx) => `<ellipse cx="${cx}" cy="28" rx="2.9" ry="3.7" fill="${INK}"/><circle cx="${cx + 1}" cy="26.5" r="1.05" fill="#fff"/>`;
    const blush = `<ellipse cx="17.5" cy="34.5" rx="4.2" ry="2.5" fill="#F25C8F" opacity=".55"/><ellipse cx="46.5" cy="34.5" rx="4.2" ry="2.5" fill="#F25C8F" opacity=".55"/>`;
    const L = `stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    switch (mood) {
      case "happy":
        return `<path d="M21 29.5Q24.5 24.5 28 29.5" ${L}/><path d="M36 29.5Q39.5 24.5 43 29.5" ${L}/>${blush}` +
          `<path d="M27 33.5Q32 41.5 37 33.5Z" fill="${INK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M29.6 37.4Q32 39.6 34.4 37.4" fill="#FF9EBB"/>`;
      case "sad":
        return eye(24.5) + eye(39.5) + `<path d="M20 24.2L27 22" ${L}/><path d="M44 24.2L37 22" ${L}/>${blush}` +
          `<path d="M28.5 38Q32 34 35.5 38" ${L}/><path d="M44.5 31q2.2 3.8 0 5.4q-2.2-1.6 0-5.4z" fill="#C4E7FF" stroke="${INK}" stroke-width="1.5"/>`;
      case "wow":
        return `<circle cx="24.5" cy="28" r="3.9" fill="${INK}"/><circle cx="25.8" cy="26.6" r="1.3" fill="#fff"/><circle cx="39.5" cy="28" r="3.9" fill="${INK}"/><circle cx="40.8" cy="26.6" r="1.3" fill="#fff"/>${blush}` +
          `<ellipse cx="32" cy="37" rx="2.8" ry="3.4" fill="${INK}"/>`;
      case "love": {
        const hEye = (x) => `<path transform="translate(${x - 4.6} 23.4) scale(.38)" d="${HEART_24}" fill="#D9427A" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`;
        return hEye(24.5) + hEye(39.5) + blush + `<path d="M27 33.5Q32 41.5 37 33.5Z" fill="${INK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
      }
      default:
        return eye(24.5) + eye(39.5) + blush + `<path d="M28.5 34Q32 37.8 35.5 34" ${L}/>`;
    }
  }
  function mascotSVG(mood = "idle") {
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
      `<g class="m-foot m-foot-l"><ellipse cx="23.5" cy="57.5" rx="6.2" ry="3.8" fill="#F25C8F" stroke="${INK}" stroke-width="2.6"/></g>` +
      `<g class="m-foot m-foot-r"><ellipse cx="40.5" cy="57.5" rx="6.2" ry="3.8" fill="#F25C8F" stroke="${INK}" stroke-width="2.6"/></g>` +
      `<path class="m-body" d="M32 55.5C19.5 47.8 6.5 39 6.5 24.5 6.5 15.8 12.8 9.5 20.6 9.5c4.8 0 9 2.5 11.4 6.5 2.4-4 6.6-6.5 11.4-6.5 7.8 0 14.1 6.3 14.1 15 0 14.5-13 23.3-25.5 31z" fill="#FF7FA8" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>` +
      `<path d="M12.6 22.5c0-4.6 3.4-7.8 7.6-7.8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".8"/>` +
      `<g class="m-face">${face(mood)}</g></svg>`;
  }
  window.Mascot = {
    svg: mascotSVG,
    // Returns a .mascot element. Uses CONFIG.art.mascot image when provided.
    el(mood = "idle", opts = {}) {
      const { size = 96, bob = false, cls = "" } = opts;
      const art = window.CONFIG && CONFIG.art && CONFIG.art.mascot;
      const el = h("div.mascot" + (bob ? ".mascot--bob" : "") + (cls ? "." + cls.split(" ").join(".") : ""), {
        style: { "--size": typeof size === "number" ? size + "px" : size },
        dataset: { mood },
      });
      if (art) {
        const im = h("img", { src: art, alt: "", draggable: "false" });
        // Ảnh tự vẽ bị thiếu / sai đường dẫn: quay về nhân vật SVG có sẵn (vẫn đổi được nét mặt)
        im.addEventListener("error", () => { el.innerHTML = mascotSVG(el.dataset.mood || mood); }, { once: true });
        el.append(im);
      } else el.innerHTML = mascotSVG(mood);
      return el;
    },
    setMood(el, mood) {
      if (!el) return;
      el.dataset.mood = mood;
      const g = el.querySelector(".m-face"); // không có khi đang dùng ảnh tự vẽ
      if (g) g.innerHTML = face(mood);
    },
  };

  /* ---------------- Sound effects (WebAudio synth, no files) ---------------- */
  window.Sfx = (() => {
    let ac = null;
    let master = null;
    let noiseBuf = null;
    let muted = false;
    function ctx() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.9;
        master.connect(ac.destination);
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    }
    function tone(f, dur, o = {}) {
      if (muted) return;
      const a = ctx();
      if (!a) return;
      const { type = "triangle", vol = 0.16, to = null, at = 0, attack = 0.006 } = o;
      const t0 = a.currentTime + at;
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }
    function noise(dur, o = {}) {
      if (muted) return;
      const a = ctx();
      if (!a) return;
      const { vol = 0.1, at = 0, from = 400, to = 2400, q = 0.8 } = o;
      if (!noiseBuf) {
        noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = a.currentTime + at;
      const src = a.createBufferSource();
      src.buffer = noiseBuf;
      const f = a.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = q;
      f.frequency.setValueAtTime(from, t0);
      f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    }
    return {
      tone,
      noise,
      unlock() { ctx(); },
      context() { return ctx(); },
      setMuted(m) { muted = !!m; },
      get muted() { return muted; },
      tap() { tone(700, 0.06, { to: 820, vol: 0.1 }); },
      key() { tone(560, 0.07, { to: 640, vol: 0.12 }); },
      back() { tone(420, 0.07, { to: 320, vol: 0.1 }); },
      pop() { tone(420, 0.09, { type: "sine", to: 900, vol: 0.16 }); },
      flip() { tone(900, 0.05, { type: "sine", to: 1300, vol: 0.07 }); },
      correct() { tone(660, 0.12, { vol: 0.16 }); tone(990, 0.22, { vol: 0.16, at: 0.09 }); },
      wrong() { tone(240, 0.28, { type: "square", to: 150, vol: 0.06 }); tone(200, 0.3, { type: "sawtooth", to: 120, vol: 0.035, at: 0.02 }); },
      match() { [784, 988, 1319].forEach((f, i) => tone(f, 0.14, { vol: 0.12, at: i * 0.07 })); },
      lifeLost() { tone(520, 0.16, { type: "square", to: 400, vol: 0.06 }); tone(390, 0.32, { type: "square", to: 210, vol: 0.06, at: 0.14 }); },
      star(i = 0) { const f = [880, 1109, 1319][i % 3]; tone(f, 0.24, { vol: 0.14 }); tone(f * 2, 0.2, { type: "sine", vol: 0.05, at: 0.03 }); },
      win() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.45 : 0.16, { vol: 0.15, at: i * 0.11 }));
        tone(1568, 0.5, { type: "sine", vol: 0.05, at: 0.44 });
      },
      lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, { type: "triangle", vol: 0.13, at: i * 0.18 })); },
      tick() { tone(1200, 0.035, { type: "square", vol: 0.035 }); },
      count() { tone(620, 0.14, { type: "square", vol: 0.06 }); },
      go() { tone(930, 0.32, { type: "square", vol: 0.06 }); tone(1395, 0.3, { type: "triangle", vol: 0.08, at: 0.02 }); },
      whoosh() { noise(0.38, { vol: 0.09, from: 300, to: 3200 }); },
      unlocked() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, { vol: 0.13, at: i * 0.07 })); },
      catch() { tone(620 + Math.random() * 140, 0.09, { type: "sine", to: 1250, vol: 0.14 }); },
      crack() { noise(0.2, { vol: 0.14, from: 2200, to: 500, q: 1.4 }); tone(300, 0.22, { type: "square", to: 140, vol: 0.05 }); },
      swap() { tone(500, 0.07, { type: "sine", to: 760, vol: 0.12 }); },
    };
  })();

  /* ---------------- Background music (optional files) ---------------- */
  window.Music = (() => {
    let el = null;
    let current = "";
    let gain = null;
    // Âm lượng nhạc nền: CONFIG.music.volume (0 đến 1), mặc định 0.25
    const cfgVolume = () => {
      const v = window.CONFIG && CONFIG.music ? Number(CONFIG.music.volume) : NaN;
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.25;
    };
    function ensure() {
      if (el) return;
      el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.setAttribute("playsinline", "");
      // iOS Safari ignores <audio>.volume, so route the element through a WebAudio gain node.
      // Skipped on file:// where Chrome would output silence (CORS).
      if (location.protocol !== "file:" && window.Sfx && Sfx.context) {
        try {
          const ac = Sfx.context();
          if (ac && ac.createMediaElementSource) {
            const node = ac.createMediaElementSource(el);
            gain = ac.createGain();
            node.connect(gain);
            gain.connect(ac.destination);
          }
        } catch (e) {
          gain = null;
        }
      }
    }
    return {
      // Call inside a click/tap handler (iOS needs a user gesture).
      play(src, volume) {
        if (!src) return;
        ensure();
        if (current !== src) {
          el.src = src;
          current = src;
        }
        const v = volume == null ? cfgVolume() : volume;
        if (gain) {
          gain.gain.value = v;
          el.volume = 1;
        } else el.volume = v;
        if (window.Sfx && Sfx.muted) return;
        if (window.Sfx) Sfx.unlock();
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
      },
      stop() { if (el) el.pause(); },
      sync() {
        if (!el || !current) return;
        if (Sfx.muted) el.pause();
        else { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
      },
      get src() { return current; },
      get playing() { return !!el && !el.paused; },
    };
  })();

  /* ---------------- Particles (hearts, stars, confetti) ---------------- */
  window.Fx = (() => {
    const COLORS = ["#FF7FA8", "#FFA3C2", "#79E2C3", "#4DD0AB", "#FFD24A", "#C9B6FF", "#FFFFFF"];
    let cv = null;
    let cx = null;
    let parts = [];
    let raf = 0;
    let last = 0;
    let dpr = 1;
    let W = 0;
    let H = 0;
    function init() {
      cv = document.getElementById("fx");
      if (!cv) return;
      cx = cv.getContext("2d");
      resize();
      window.addEventListener("resize", resize);
    }
    function resize() {
      if (!cv) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const HEART_P2D = new Path2D(HEART_24);
    const STAR_P2D = new Path2D(STAR_24);
    function shapePath(p) {
      const s = p.size;
      if (p.shape === "heart" || p.shape === "star") {
        const path = new Path2D();
        path.addPath(p.shape === "heart" ? HEART_P2D : STAR_P2D, new DOMMatrix().scale(s / 24, s / 24).translate(-12, -12));
        return path;
      }
      const path = new Path2D();
      if (p.shape === "rect") path.rect(-s / 2, -s / 3.2, s, s / 1.6);
      else path.arc(0, 0, s / 2.2, 0, Math.PI * 2);
      return path;
    }
    function spawn(p) {
      parts.push(p);
      if (!raf && cx) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }
    function burst(x, y, o = {}) {
      if (!cx || reducedMotion()) return;
      const n = o.count == null ? 22 : o.count;
      const speed = o.speed || 7;
      const [s0, s1] = o.size || [8, 16];
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(0, Math.PI * 2);
        const sp = rand(speed * 0.35, speed);
        spawn({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (o.lift == null ? 2.5 : o.lift),
          g: o.gravity == null ? 0.3 : o.gravity,
          drag: 0.985,
          size: rand(s0, s1),
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.18, 0.18),
          color: pick(o.colors || COLORS),
          shape: pick(o.shapes || ["heart", "circle", "star", "rect"]),
          outline: o.outline !== false,
          life: 0,
          ttl: o.ttl || rand(55, 85),
        });
      }
    }
    function burstAt(el, o) {
      if (!el) return;
      const c = center(el);
      burst(c.x, c.y, o);
    }
    const pending = new Set(); // hẹn giờ của confetti chưa rơi, để clear() huỷ được
    function confetti(o = {}) {
      if (!cx || reducedMotion()) return;
      const { duration = 1600, count = 110, colors, shapes } = o;
      for (let i = 0; i < count; i++) {
        const id = setTimeout(() => {
          pending.delete(id);
          spawn({
            x: rand(0, W), y: rand(-40, -10),
            vx: rand(-1.4, 1.4), vy: rand(2.5, 5.5),
            g: 0.05, drag: 0.996,
            size: rand(9, 17), rot: rand(0, 6.28), vr: rand(-0.12, 0.12),
            color: pick(colors || COLORS),
            shape: pick(shapes || ["heart", "rect", "circle", "star"]),
            outline: true, life: 0, ttl: 400, sway: rand(0.02, 0.05), phase: rand(0, 6.28),
          });
        }, rand(0, duration));
        pending.add(id);
      }
    }
    function clear() {
      pending.forEach((id) => clearTimeout(id));
      pending.clear();
      parts = [];
    }
    function tick(now) {
      const dt = Math.min(3, (now - last) / 16.667 || 1);
      last = now;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, W, H);
      parts = parts.filter((p) => {
        p.life += dt;
        const d = Math.pow(p.drag, dt);
        p.vx *= d;
        p.vy = p.vy * d + p.g * dt;
        if (p.sway) p.vx += Math.sin(p.life * p.sway + p.phase) * 0.08 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const alpha = 1 - p.life / p.ttl;
        if (alpha <= 0 || p.y > H + 60) return false;
        cx.save();
        cx.globalAlpha = Math.min(1, alpha * 2);
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        const path = shapePath(p);
        cx.fillStyle = p.color;
        cx.fill(path);
        if (p.outline) {
          cx.lineWidth = Math.max(1.5, p.size * 0.1);
          cx.strokeStyle = INK;
          cx.lineJoin = "round";
          cx.stroke(path);
        }
        cx.restore();
        return true;
      });
      if (parts.length) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        cx.clearRect(0, 0, W, H);
      }
    }
    return { init, burst, burstAt, confetti, clear, COLORS };
  })();
})();
