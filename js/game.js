/* =====================================================================
   game.js · Engine: màn khoá, bản đồ, mạng, luồng màn chơi (không cần sửa)
   Global: Game (dùng cho kiểm thử)
   ===================================================================== */
(function () {
  "use strict";
  const C = window.CONFIG;
  const T = C.text || {};
  const { $, h, sleep, fmt, pick, Store, preload, vibrate, replay, reducedMotion, cssMs } = Core;

  const ORDER = (C.order || ["quiz", "blur", "memory", "puzzle", "hearts"]).filter((k) => C.levels && C.levels[k]);
  const N = ORDER.length;
  const MAX = Math.max(1, C.lives || 3);
  const params = new URLSearchParams(location.search);
  const DEV = params.has("dev");

  const fresh = () => ({ v: 1, unlocked: false, level: 1, lives: MAX, stars: [], lost: [], seenRules: false, done: false, muted: false });
  let S = Object.assign(fresh(), Store.get() || {});
  if (!(S.lives > 0)) S.lives = MAX;
  S.level = Math.min(Math.max(1, S.level | 0), N + 1);
  const save = () => Store.set(S);

  const els = {
    scene: $("#scene"),
    hud: $("#hud"),
    lock: $("#screen-lock"),
    map: $("#screen-map"),
    level: $("#screen-level"),
    finale: $("#screen-finale"),
  };
  let screen = null;
  let run = null;
  let finaleApi = null;
  let lockKeyHandler = null;
  let MAP_AR = 9 / 16;

  function show(name) {
    // Rời màn cuối (ví dụ nút dev Map/M1..M5): dọn luôn vòng lặp ảnh, phím, nền tim
    if (name !== "finale" && finaleApi) {
      try { if (finaleApi.destroy) finaleApi.destroy(); } catch (e) { console.error(e); }
      finaleApi = null;
    }
    ["lock", "map", "level", "finale"].forEach((k) => els[k].classList.toggle("is-active", k === name));
    screen = name;
    document.body.dataset.screen = name;
    Hud.mode(name);
  }

  /* =================================================================
     Background scene
     ================================================================= */
  const CLOUD =
    '<svg viewBox="0 0 190 80" aria-hidden="true"><path d="M40 72c-18 0-30-11-30-25 0-15 13-26 28-25 4-17 20-28 38-28 17 0 31 10 36 25 4-2 9-3 14-3 18 0 32 12 32 28s-14 28-32 28z" fill="#fff"/></svg>';
  function buildScene() {
    const sc = els.scene;
    const art = C.art || {};
    if (art.background) {
      sc.style.setProperty("--bg-img", `url("${art.background}")`);
      sc.classList.add("has-art");
    }
    if (art.backgroundMobile) {
      sc.style.setProperty("--bg-img-m", `url("${art.backgroundMobile}")`);
      sc.classList.add("has-art-m");
    }
    const def = h("div.scene__default");
    [
      { top: 6, w: 200, dur: 95, delay: -20 },
      { top: 18, w: 140, dur: 120, delay: -80 },
      { top: 30, w: 170, dur: 105, delay: -55 },
      { top: 12, w: 110, dur: 140, delay: -120 },
    ].forEach((c) => {
      def.append(h("div.scene__cloud", { html: CLOUD, style: { top: c.top + "%", width: c.w + "px", height: c.w * 0.42 + "px", animationDuration: c.dur + "s", animationDelay: c.delay + "s" } }));
    });
    def.append(
      h("div.scene__hills", {
        html:
          '<svg viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">' +
          '<path d="M0 150C200 60 380 70 560 130S900 60 1100 110 1360 90 1440 120V320H0Z" fill="#C6F3E2"/>' +
          '<path d="M0 222C180 160 360 170 520 210S860 150 1060 200 1340 170 1440 190V320H0Z" fill="#9BE8CD"/>' +
          '<path d="M0 222C180 160 360 170 520 210S860 150 1060 200 1340 170 1440 190" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" vector-effect="non-scaling-stroke"/>' +
          "</svg>",
      })
    );
    sc.append(def);
    const petals = h("div.scene__petals");
    for (let i = 0; i < 16; i++) {
      const s = Core.rand(0.7, 1.4);
      petals.append(
        h("span.petal", {
          style: {
            left: Core.rand(-5, 100) + "%",
            width: 10 * s + "px",
            height: 7 * s + "px",
            animationDuration: Core.rand(9, 17) + "s",
            animationDelay: -Core.rand(0, 17) + "s",
          },
        })
      );
    }
    sc.append(petals);
  }

  /* =================================================================
     HUD: mạng + nhãn giữa + nút âm thanh
     ================================================================= */
  const Hud = (() => {
    let livesEl;
    let centerEl;
    function build() {
      els.hud.replaceChildren();
      livesEl = h("div.lives", { role: "status" });
      for (let i = 0; i < MAX; i++) livesEl.append(UI.lifeIcon(false));
      centerEl = h("div.hud__center");
      const swap = h(
        "span.t-icon-swap",
        { "data-state": S.muted ? "b" : "a" },
        h("span.t-icon", { "data-icon": "a", html: Icons.soundOn }),
        h("span.t-icon", { "data-icon": "b", html: Icons.soundOff })
      );
      const sound = h("button", { type: "button", class: "btn btn--mint btn--round hud__sound", "aria-label": "Bật/tắt âm thanh", "aria-pressed": String(!S.muted) }, swap);
      sound.addEventListener("click", () => {
        S.muted = !S.muted;
        save();
        Sfx.setMuted(S.muted);
        swap.dataset.state = S.muted ? "b" : "a";
        sound.setAttribute("aria-pressed", String(!S.muted));
        if (!S.muted) Sfx.tap();
        Music.sync();
      });
      els.hud.append(livesEl, centerEl, sound);
      setLives(S.lives);
    }
    function setLives(n, anim) {
      const list = livesEl.querySelectorAll(".life");
      list.forEach((l, i) => {
        const empty = i >= n;
        if (anim === "lose" && i === n) {
          l.classList.remove("is-empty");
          replay(l, "is-breaking");
          setTimeout(() => l.classList.add("is-empty"), 280);
        } else if (anim === "refill" && !empty && l.classList.contains("is-empty")) {
          l.classList.remove("is-empty");
          l.style.animationDelay = i * 90 + "ms";
          replay(l, "is-refill");
        } else l.classList.toggle("is-empty", empty);
      });
      livesEl.setAttribute("aria-label", `Còn ${n}/${MAX} mạng`);
    }
    const lifeEl = (i) => livesEl.querySelectorAll(".life")[i];
    function setCenter(node) {
      centerEl.replaceChildren();
      if (node) centerEl.append(node);
    }
    function starsChip() {
      const total = S.stars.reduce((a, b) => a + (b || 0), 0);
      return h("div.chip", { "aria-label": `${total} sao` }, h("div.stars.stars--sm", null, h("span.star.is-on", { html: UI.STAR_SVG })), h("span", { text: `${total}/${N * 3}` }));
    }
    function mode(name) {
      els.hud.hidden = name === "lock";
      livesEl.hidden = name === "finale";
      if (name === "map") setCenter(starsChip());
      if (name === "finale") setCenter(null);
    }
    return { build, setLives, lifeEl, setCenter, mode, get livesEl() { return livesEl; } };
  })();

  /* =================================================================
     Màn khoá · mật mã 4 số
     ================================================================= */
  function showLock() {
    stopRun(run);
    renderLock();
    show("lock");
  }
  function renderLock() {
    const root = els.lock;
    root.replaceChildren();
    const art = C.art || {};
    const brand = h("div.brand");
    if (art.logo) brand.append(UI.img(art.logo, { alt: C.title, cls: "logo-img" }));
    else {
      const words = String(C.title || "").split(" ");
      const cut = words.length >= 4 ? 2 : Math.ceil(words.length / 2);
      brand.append(
        h("h1.logo.t-stroke-lg", null, h("span", { text: words.slice(0, cut).join(" ") }), words.length > cut ? h("span.logo__l2", { text: words.slice(cut).join(" ") }) : null)
      );
    }
    if (C.subtitle) brand.append(UI.plate(C.subtitle, "mint"));

    const slots = [0, 1, 2, 3].map(() => h("div.pin-slot", null, h("span.t-digit-group")));
    const pin = h("div.pin.t-input", { "aria-hidden": "true" }, slots);
    const msg = h("p.pin-msg.t-error-msg", { text: T.lockWrong });
    const wrap = h("div.pin-wrap.t-input-wrap", null, pin, msg);
    const hint = h("p.pin-hint", { hidden: true, text: C.passcodeHint || "" });
    const live = h("p.sr-only", { "aria-live": "polite" });
    const keypad = h("div.keypad", { role: "group", "aria-label": "Bàn phím số" });
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].forEach((k) => {
      if (!k) keypad.append(h("span.key.key--blank", { "aria-hidden": "true" }));
      else if (k === "del") keypad.append(h("button.key.key--del", { type: "button", "aria-label": "Xoá", html: Icons.backspace, dataset: { k: "del" }, onClick: del }));
      else keypad.append(h("button.key", { type: "button", text: k, dataset: { k }, onClick: () => press(k) }));
    });
    const panel = h(
      "div.panel.lock-panel",
      null,
      Mascot.el("idle", { size: 64, cls: "lock-mascot" }),
      h("p.lock-prompt", { text: T.lockPrompt }),
      h("p.lock-sub", { text: T.lockSub }),
      wrap,
      hint,
      keypad,
      live
    );
    root.append(h("div.lock", null, brand, panel));

    let code = "";
    let wrong = 0;
    let busy = false;
    const shakeMs = cssMs("--shake-dur-a", 80) * 2 + cssMs("--shake-dur-b", 60) * 2;

    function render() {
      slots.forEach((s, i) => {
        s.classList.toggle("is-active", i === code.length && !busy);
        const g = s.firstChild;
        const ch = code[i] || "";
        if (g.dataset.v !== ch) {
          g.dataset.v = ch;
          if (ch) UI.digits(g, ch);
          else g.replaceChildren();
        }
      });
      live.textContent = code.length ? `${code.length}/4` : "";
    }
    function clearError() {
      wrap.classList.remove("is-error");
      pin.classList.remove("is-error");
    }
    function press(d) {
      if (busy || code.length >= 4) return;
      Sfx.unlock();
      Sfx.key();
      clearError();
      code += d;
      render();
      if (code.length === 4) check();
    }
    function del() {
      if (busy || !code) return;
      Sfx.back();
      code = code.slice(0, -1);
      render();
    }
    function check() {
      busy = true;
      if (code === String(C.passcode).trim()) success();
      else setTimeout(fail, 180);
    }
    async function success() {
      Music.play(C.music && C.music.game); // phải gọi ngay trong lượt chạm (iOS)
      pin.classList.add("is-ok");
      wrap.classList.add("is-ok");
      const check = UI.successCheck("lock-check");
      msg.replaceChildren(check, document.createTextNode(T.lockOk || "Chính xác!"));
      check.show();
      render();
      Sfx.unlocked();
      Fx.burstAt(pin, { count: 30 });
      live.textContent = T.lockOk || "";
      S.unlocked = true;
      save();
      await sleep(950);
      removeLockKeys();
      await UI.wipe(() => showMap());
      maybeRules();
    }
    function fail() {
      wrong++;
      Sfx.wrong();
      vibrate([60, 40, 60]);
      msg.textContent = T.lockWrong;
      wrap.classList.add("is-error");
      pin.classList.add("is-error");
      pin.classList.remove("is-shaking");
      void pin.offsetWidth;
      pin.classList.add("is-shaking");
      setTimeout(() => pin.classList.remove("is-shaking"), shakeMs + 20);
      if (wrong >= 3 && C.passcodeHint) hint.hidden = false;
      setTimeout(() => {
        code = "";
        busy = false;
        render();
      }, 480);
      clearTimeout(wrap._revert);
      wrap._revert = setTimeout(clearError, shakeMs + cssMs("--revert-hold", 2200));
    }
    function flashKey(k) {
      const b = keypad.querySelector(`[data-k="${k}"]`);
      if (!b) return;
      b.classList.add("is-pressed");
      setTimeout(() => b.classList.remove("is-pressed"), 110);
    }
    removeLockKeys();
    lockKeyHandler = (e) => {
      if (screen !== "lock" || UI.activeModal) return;
      if (/^[0-9]$/.test(e.key)) {
        flashKey(e.key);
        press(e.key);
      } else if (e.key === "Backspace") {
        flashKey("del");
        del();
      }
    };
    document.addEventListener("keydown", lockKeyHandler);
    render();
  }
  function removeLockKeys() {
    if (lockKeyHandler) document.removeEventListener("keydown", lockKeyHandler);
    lockKeyHandler = null;
  }

  async function maybeRules() {
    if (S.seenRules) return;
    S.seenRules = true;
    save();
    const list = h("ul.rules", null, (T.rules || []).map((r) => h("li", { text: fmt(r, { lives: MAX }) })));
    await UI.modal({ plate: T.rulesTitle, tone: "mint", art: UI.heartsRow(MAX, MAX), body: list, buttons: [{ label: T.rulesCta, tone: "pink", size: "lg" }] }).result;
  }

  /* =================================================================
     Bản đồ 6 điểm
     ================================================================= */
  let mapRefs = null;
  function mapPoints() {
    const src = (C.map && C.map.points) || [];
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const p = src[i];
      if (p && isFinite(p.x) && isFinite(p.y)) pts.push({ x: +p.x, y: +p.y });
      else pts.push({ x: i % 2 ? 70 : 30, y: 88 - (i * 76) / N });
    }
    return pts;
  }
  function defaultMapArt(W, H) {
    const tree = (x, y, s = 1) =>
      `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-9" y="-6" width="18" height="46" rx="7" fill="#C98B6B" stroke="#3A2340" stroke-width="6"/>` +
      `<circle cx="0" cy="-34" r="46" fill="#4DD0AB" stroke="#3A2340" stroke-width="6"/><circle cx="-14" cy="-50" r="14" fill="#A8EFD8"/></g>`;
    const flower = (x, y, c = "#FFA3C2") =>
      `<g transform="translate(${x} ${y})"><circle r="11" cx="-10" fill="${c}" stroke="#3A2340" stroke-width="4"/><circle r="11" cx="10" fill="${c}" stroke="#3A2340" stroke-width="4"/>` +
      `<circle r="11" cy="-10" fill="${c}" stroke="#3A2340" stroke-width="4"/><circle r="11" cy="10" fill="${c}" stroke="#3A2340" stroke-width="4"/><circle r="8" fill="#FFD24A" stroke="#3A2340" stroke-width="4"/></g>`;
    const tuft = (x, y) => `<path d="M${x - 16} ${y}q6-18 10-2q6-22 12 0q6-18 10 2" fill="none" stroke="#2DB590" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    const island =
      "M120 200C260 110 420 150 520 120 640 85 800 120 880 210 960 300 930 430 950 560 975 720 920 860 950 1010 980 1160 930 1300 945 1440 960 1580 860 1690 720 1695 580 1700 460 1665 330 1690 200 1715 80 1640 60 1500 40 1360 90 1220 60 1080 30 940 80 800 55 660 30 520 70 380 60 300 55 250 80 220 120 200Z";
    return (
      `<svg class="map__art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">` +
      `<path d="${island}" transform="translate(0 44)" fill="#2DB590" stroke="#3A2340" stroke-width="8" stroke-linejoin="round"/>` +
      `<path d="${island}" fill="#A8EFD8" stroke="#3A2340" stroke-width="8" stroke-linejoin="round"/>` +
      `<path d="M150 260C300 190 440 230 560 190 700 150 820 200 860 280" fill="none" stroke="#D3F8EB" stroke-width="22" stroke-linecap="round"/>` +
      `<ellipse cx="160" cy="820" rx="96" ry="52" fill="#C4E7FF" stroke="#3A2340" stroke-width="7"/><ellipse cx="136" cy="808" rx="40" ry="12" fill="#fff" opacity=".7"/>` +
      tree(830, 1590, 1) + tree(135, 1300, 0.9) + tree(860, 1060, 0.85) + tree(845, 575, 1) + tree(175, 300, 0.8) +
      flower(520, 1660) + flower(590, 1690, "#C9B6FF") + flower(120, 560, "#FFD24A") + flower(880, 1400) + flower(140, 1060, "#C9B6FF") + flower(830, 330, "#FFA3C2") +
      tuft(380, 1640) + tuft(200, 1480) + tuft(620, 1170) + tuft(880, 860) + tuft(250, 690) + tuft(700, 480) + tuft(420, 330) + tuft(760, 1520) +
      "</svg>"
    );
  }
  function segD(P) {
    const d = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i];
      const p1 = P[i];
      const p2 = P[i + 1];
      const p3 = P[i + 2] || P[i + 1];
      const k = 1 / 5;
      const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
      const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
      d.push(`M${p1.x.toFixed(1)} ${p1.y.toFixed(1)}C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
    }
    return d;
  }
  function nodeStateFor(i, lvl) {
    if (i === N) return lvl > N ? "ready" : "locked";
    const n = i + 1;
    return n < lvl ? "done" : n === lvl ? "current" : "locked";
  }
  function paintNode(btn, i, state) {
    const isGift = i === N;
    btn.className = "node" + (isGift ? " node--gift" : "") + " is-" + state;
    btn.replaceChildren();
    if (isGift) btn.insertAdjacentHTML("beforeend", Badges.gift.replace("<svg ", '<svg class="node__gift" '));
    else btn.append(h("span.node__num", { text: i + 1 }));
    if (state === "locked") btn.append(h("span.node__lock", { html: Icons.lock }));
    if (state === "done") {
      const st = UI.stars(S.stars[i] || 1, { small: true });
      st.classList.add("node__stars");
      btn.append(st);
    }
    const name = isGift ? T.giftLabel : C.levels[ORDER[i]].name;
    const label = { done: T.mapDone, current: T.play, locked: T.mapLocked, ready: T.giftCta }[state];
    btn.setAttribute("aria-label", `${isGift ? "" : fmt(T.levelLabel, { n: i + 1 }) + ": "}${name} · ${label}`);
    btn.dataset.state = state;
  }
  function mapCard(lvl) {
    if (lvl <= N) {
      const key = ORDER[lvl - 1];
      const d = C.levels[key];
      return h(
        "div.panel.map-card",
        null,
        h(
          "div.map-card__top",
          null,
          h("div.map-card__badge", { html: Badges[key] || "" }),
          h("div.map-card__info", null, UI.plate(fmt(T.levelLabel, { n: lvl }), "mint"), h("h2.map-card__name.t-display", { text: d.name }), h("p.map-card__desc", { text: d.desc }))
        ),
        UI.button(T.play, { tone: "pink", icon: "play", cls: "map-card__cta", onClick: () => startLevel(lvl) })
      );
    }
    return h(
      "div.panel.map-card.map-card--gift",
      null,
      h(
        "div.map-card__top",
        null,
        h("div.map-card__badge", { html: Badges.gift }),
        h("div.map-card__info", null, UI.plate(T.giftLabel, "butter"), h("h2.map-card__name.t-display", { text: T.giftReady }), h("p.map-card__desc", { text: T.giftDesc }))
      ),
      UI.button(T.giftCta, { tone: "butter", icon: "gift", cls: "map-card__cta", onClick: openGift, sound: false })
    );
  }
  function showMap(opts = {}) {
    stopRun(run);
    renderMap(opts);
    show("map");
  }
  function renderMap(opts = {}) {
    const lvl = opts.fromLevel || S.level;
    const root = els.map;
    root.replaceChildren();
    const W = 1000;
    const H = Math.round(W / MAP_AR);
    const P = mapPoints().map((p) => ({ x: (p.x * W) / 100, y: (p.y * H) / 100 }));
    const box = h("div.map", { style: { "--map-ar": `${W} / ${H}`, "--map-ar-n": String(W / H) } });
    if (C.art && C.art.map) box.style.backgroundImage = `url("${C.art.map}")`;
    else box.insertAdjacentHTML("beforeend", defaultMapArt(W, H));

    // Con đường
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "map__road");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const mk = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };
    const ds = segD(P);
    const segs = [];
    const doneEls = [];
    const showPath = !C.map || C.map.showPath !== false;
    const defs = mk("defs", {});
    svg.append(defs);
    const gBase = mk("g", {});
    const gFill = mk("g", {});
    const gDots = mk("g", {});
    const gDone = mk("g", {});
    ds.forEach((d, i) => {
      const base = mk("path", { d, class: "road-base", "stroke-width": 46 });
      segs.push(base);
      if (showPath) {
        gBase.append(base);
        gFill.append(mk("path", { d, class: "road-fill", "stroke-width": 32 }));
        gDots.append(mk("path", { d, class: "road-dash", "stroke-width": 12, "stroke-dasharray": "0.1 30" }));
        const done = mk("path", { d, class: "road-done", "stroke-width": 13, "stroke-dasharray": "0.1 30" });
        done.style.display = i < lvl - 1 ? "" : "none";
        doneEls.push(done);
        gDone.append(done);
      } else {
        base.style.visibility = "hidden";
        gBase.append(base);
      }
    });
    svg.append(gBase, gFill, gDots, gDone);
    box.append(svg);

    // Các điểm
    const pct = mapPoints();
    const nodes = pct.map((p, i) => {
      const btn = h("button", { type: "button", style: { "--x": p.x, "--y": p.y } });
      paintNode(btn, i, nodeStateFor(i, lvl));
      btn.addEventListener("click", () => onNode(i, btn));
      box.append(btn);
      return btn;
    });

    // Nhân vật
    const mIdx = Math.min(lvl, N + 1) - 1;
    const mascotEl = Mascot.el("idle", { size: "100%", bob: true });
    const inner = h("div.map-mascot__inner", null, mascotEl);
    const mascot = h("div.map-mascot", { style: { "--x": pct[mIdx].x, "--y": pct[mIdx].y } }, inner);
    box.append(mascot);

    const card = mapCard(lvl);
    root.append(h("div.mapscreen", null, h("div.map-wrap", null, box), card));
    mapRefs = { box, svg, segs, doneEls, defs, nodes, mascot, inner, mascotEl, card, W, H, root };
  }
  function onNode(i, btn) {
    const state = btn.dataset.state;
    if (state === "current") startLevel(i + 1);
    else if (state === "ready") openGift();
    else if (state === "done") {
      Sfx.tap();
      UI.floatAt(btn, T.mapDone, "mint");
    } else {
      Sfx.back();
      replay(btn, "is-shake");
      setTimeout(() => btn.classList.remove("is-shake"), 400);
      UI.floatAt(btn, T.mapLocked, "coral");
    }
  }
  async function walk(fromN) {
    const m = mapRefs;
    if (!m) return;
    const i = fromN - 1;
    const seg = m.segs[i];
    const nodeFrom = m.nodes[i];
    const nodeTo = m.nodes[i + 1];
    if (!seg || !nodeTo) return;
    paintNode(nodeFrom, i, "done");
    replay(nodeFrom, "is-pop");
    setTimeout(() => nodeFrom.classList.remove("is-pop"), 650);
    Sfx.pop();
    Fx.burstAt(nodeFrom, { count: 12, shapes: ["star"], colors: ["#FFD24A", "#fff"] });
    await sleep(420);

    const len = seg.getTotalLength();
    const done = m.doneEls[i];
    let maskPath = null;
    if (done) {
      const id = "reveal-" + i + "-" + Date.now();
      const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
      mask.setAttribute("id", id);
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      maskPath.setAttribute("d", seg.getAttribute("d"));
      maskPath.setAttribute("fill", "none");
      maskPath.setAttribute("stroke", "#fff");
      maskPath.setAttribute("stroke-width", "60");
      maskPath.setAttribute("stroke-dasharray", String(len + 2));
      maskPath.setAttribute("stroke-dashoffset", String(len + 2));
      mask.append(maskPath);
      m.defs.append(mask);
      done.setAttribute("mask", `url(#${id})`);
      done.style.display = "";
    }
    m.mascotEl.classList.add("is-walking");
    const dur = reducedMotion() ? 10 : 1500;
    const t0 = performance.now();
    let prevX = null;
    await new Promise((res) => {
      function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const p = seg.getPointAtLength(len * e);
        m.mascot.style.setProperty("--x", (p.x / m.W) * 100);
        m.mascot.style.setProperty("--y", (p.y / m.H) * 100);
        if (prevX != null && Math.abs(p.x - prevX) > 0.4) m.mascot.classList.toggle("is-flip", p.x < prevX);
        prevX = p.x;
        if (maskPath) maskPath.setAttribute("stroke-dashoffset", String((len + 2) * (1 - e)));
        if (k < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
    m.mascotEl.classList.remove("is-walking");
    m.mascot.classList.remove("is-flip");
    replay(m.inner, "mascot--jump");
    const toState = nodeStateFor(i + 1, S.level);
    paintNode(nodeTo, i + 1, toState);
    replay(nodeTo, "is-pop");
    setTimeout(() => nodeTo.classList.remove("is-pop"), 650);
    Sfx.pop();
    Fx.burstAt(nodeTo, { count: 18 });
    const newCard = mapCard(S.level);
    m.card.replaceWith(newCard);
    m.card = newCard;
    replay(newCard, "is-enter");
    Hud.setCenter(null);
    Hud.mode("map");
  }

  /* =================================================================
     Chạy màn chơi
     ================================================================= */
  let starting = false;
  async function startLevel(n) {
    if (starting || n < 1 || n > N) return;
    starting = true;
    try {
      const key = ORDER[n - 1];
      const L = window.Levels && window.Levels[key];
      if (!L) {
        console.error("[game] Chưa có màn:", key);
        return;
      }
      const assets = L.assets ? L.assets(C.levels[key], C) || [] : [];
      const t = setTimeout(() => UI.loading(true), 250);
      await preload(assets);
      clearTimeout(t);
      UI.loading(false);
      await enter(n);
    } finally {
      starting = false;
    }
  }
  async function enter(n) {
    let r = null;
    await UI.wipe(() => {
      r = launch(n);
    });
    if (r) r.markReady();
    return r;
  }
  function launch(n) {
    stopRun(run);
    const key = ORDER[n - 1];
    const L = window.Levels && window.Levels[key];
    const data = C.levels[key];
    show("level");
    Hud.setCenter(UI.plate(fmt(T.levelLabel, { n }), "mint"));
    const root = els.level;
    root.replaceChildren();
    const head = h("div.level-head", null, h("h2.level-head__name.t-stroke", { text: data.name }));
    const timerSlot = h("div.level-timer");
    const body = h("div.level-body");
    const hint = h("p.level-hint", { "aria-live": "polite" });
    root.append(h("div.level", { dataset: { level: key } }, head, timerSlot, body, hint));

    let readyResolve;
    const ready = new Promise((res) => (readyResolve = res));
    const r = { n, key, alive: true, api: null, timers: [], cleanups: [], markReady: () => readyResolve() };
    run = r;
    const ctx = {
      root: body,
      timerSlot,
      hintEl: hint,
      headEl: head,
      index: n,
      key,
      data,
      config: C,
      text: T,
      ready,
      get alive() { return r.alive && run === r; },
      get lives() { return S.lives; },
      setHint(t) { hint.textContent = t || ""; },
      loseLife: (fromEl) => loseLife(r, fromEl),
      fail: (reason) => fail(r, reason),
      complete: () => complete(r),
      countdown: () => (r.alive ? UI.countdown() : Promise.resolve()),
      timer: (o) => {
        const t = UI.timer(o);
        timerSlot.append(t.el);
        r.timers.push(t);
        return t;
      },
      onCleanup: (fn) => r.cleanups.push(fn),
      sfx: Sfx, fx: Fx, ui: UI, core: Core, mascot: Mascot, icons: Icons, badges: Badges, music: Music,
    };
    if (!L) {
      body.append(h("div.panel", { text: "Màn này chưa sẵn sàng." }));
      return r;
    }
    try {
      r.api = L.start(ctx) || null;
    } catch (e) {
      console.error("[level " + key + "]", e);
    }
    return r;
  }
  function stopRun(r) {
    if (!r || !r.alive) return;
    r.alive = false;
    r.timers.forEach((t) => { try { t.stop(); } catch (e) { /* no-op */ } });
    try {
      if (typeof r.api === "function") r.api();
      else if (r.api && typeof r.api.destroy === "function") r.api.destroy();
    } catch (e) {
      console.error(e);
    }
    r.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    document.querySelectorAll(".countdown").forEach((el) => el.remove());
  }

  function takeLife(r) {
    S.lives = Math.max(0, S.lives - 1);
    S.lost[r.n - 1] = (S.lost[r.n - 1] || 0) + 1;
    save();
    Sfx.lifeLost();
    vibrate(120);
    UI.hurtFlash();
    Hud.setLives(S.lives, "lose");
    const heart = Hud.lifeEl(S.lives);
    if (heart) {
      // Bay lên từ ngay dưới trái tim vừa mất (trái tim nằm sát mép trên nên bay từ tâm sẽ bị cắt)
      const c = Core.center(heart);
      UI.float(T.lifeLost, c.x, c.y + 34, "coral");
      Fx.burstAt(heart, { count: 10, shapes: ["heart"], colors: ["#FF7FA8", "#EFE3EA"], speed: 5 });
    }
    return S.lives > 0;
  }
  async function loseLife(r) {
    if (!r.alive || run !== r) return false;
    const alive = takeLife(r);
    if (!alive) {
      stopRun(r);
      await sleep(800);
      gameOver(r.n);
      return false;
    }
    return true;
  }
  async function fail(r, reason) {
    if (!r.alive || run !== r) return;
    stopRun(r);
    const alive = takeLife(r);
    await sleep(700);
    if (!alive) return gameOver(r.n);
    const timeout = reason !== "custom";
    await UI.modal({
      plate: timeout ? T.timeoutTitle : pick(T.wrong),
      tone: "coral",
      art: Mascot.el("sad", { size: 96 }),
      body: T.timeoutBody,
      buttons: [{ label: T.retry, tone: "mint", size: "lg", icon: "refresh" }],
    }).result;
    await enter(r.n);
  }
  async function complete(r) {
    if (!r.alive || run !== r) return;
    stopRun(r);
    const i = r.n - 1;
    const stars = Math.max(1, 3 - (S.lost[i] || 0));
    S.stars[i] = Math.max(S.stars[i] || 0, stars);
    const advanced = S.level === r.n;
    if (S.level <= r.n) S.level = r.n + 1;
    save();
    Sfx.win();
    Fx.confetti({ duration: 900, count: 70 });
    await sleep(450);
    const st = UI.stars(0);
    const m = UI.modal({
      plate: fmt(T.levelDoneTitle, { n: r.n }),
      tone: "mint",
      art: st,
      // (tuỳ chọn) levels.<key>.doneBody: lời khen riêng cho màn đó, không có thì dùng text.levelDoneBody
      body: pick((C.levels[r.key] && C.levels[r.key].doneBody) || T.levelDoneBody),
      buttons: [{ label: T.next, tone: "pink", size: "lg", iconRight: "arrowRight" }],
    });
    UI.animateStars(st, stars);
    await m.result;
    await UI.wipe(() => showMap({ fromLevel: advanced ? r.n : 0 }));
    if (advanced) await walk(r.n);
  }
  async function gameOver(n) {
    Sfx.lose();
    await UI.modal({
      plate: T.gameOverTitle,
      tone: "coral",
      art: Mascot.el("sad", { size: 100 }),
      body: fmt(T.gameOverBody, { lives: MAX }),
      buttons: [{ label: T.retry, tone: "mint", size: "lg", icon: "refresh" }],
    }).result;
    S.lives = MAX;
    if (C.onGameOver === "all") {
      S.level = 1;
      S.stars = [];
      S.lost = [];
      save();
      await UI.wipe(() => showMap());
      Hud.setLives(S.lives, "refill");
      return;
    }
    save();
    await enter(n);
    Hud.setLives(S.lives, "refill");
    Sfx.pop();
  }

  /* =================================================================
     Món quà · màn cuối
     ================================================================= */
  async function openGift() {
    if (S.level <= N) return;
    Music.play(C.music && C.music.finale); // ngay trong lượt chạm (iOS)
    Sfx.win();
    S.done = true;
    save();
    await UI.wipe(() => showFinale());
  }
  function daysTogether() {
    if (!C.anniversary) return null;
    const d = new Date(String(C.anniversary) + "T00:00:00");
    if (isNaN(d)) return null;
    return Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000) + 1);
  }
  function showFinale() {
    stopRun(run);
    if (finaleApi && finaleApi.destroy) finaleApi.destroy();
    finaleApi = null;
    show("finale");
    const root = els.finale;
    root.replaceChildren();
    const ctx = {
      root,
      config: C,
      text: T,
      data: C.finale,
      lives: S.lives,
      maxLives: MAX,
      stars: S.stars.slice(),
      totalStars: S.stars.reduce((a, b) => a + (b || 0), 0),
      maxStars: N * 3,
      days: daysTogether(),
      sfx: Sfx, fx: Fx, ui: UI, core: Core, mascot: Mascot, icons: Icons, badges: Badges, music: Music,
      playMusic: () => Music.play(C.music && C.music.finale),
      restart: restartAll,
    };
    const F = window.Finale;
    if (F && F.start) {
      try { finaleApi = F.start(ctx) || null; } catch (e) { console.error("[finale]", e); }
    } else root.append(h("div.panel", { text: C.finale.title }));
  }
  async function restartAll() {
    const muted = S.muted;
    S = fresh();
    S.unlocked = true;
    S.seenRules = true;
    S.muted = muted;
    save();
    Music.stop();
    await UI.wipe(() => {
      if (finaleApi && finaleApi.destroy) finaleApi.destroy();
      finaleApi = null;
      Hud.setLives(S.lives);
      showMap();
    });
  }

  /* =================================================================
     Kiểm tra config + dev tools
     ================================================================= */
  function validate() {
    const warn = [];
    if (!/^\d{4}$/.test(String(C.passcode).trim())) warn.push("passcode phải gồm đúng 4 chữ số");
    const q = C.levels.quiz;
    if (q) (q.questions || []).forEach((x, i) => { if (!(x.options || []).includes(x.answer)) warn.push(`Màn 1, câu ${i + 1}: "answer" không giống đáp án nào trong "options"`); });
    const b = C.levels.blur;
    if (b) (b.photos || []).forEach((x, i) => { if (!(x.options || []).includes(x.answer)) warn.push(`Màn 2, ảnh ${i + 1}: "answer" không giống đáp án nào trong "options"`); });
    if (C.map && C.map.points && C.map.points.length < N + 1) warn.push(`map.points cần đủ ${N + 1} điểm`);
    warn.forEach((w) => console.warn("[CONFIG] " + w));
    if (warn.length) {
      document.body.append(h("div.config-warn", { role: "alert" }, h("b", { text: "Cần sửa file js/config.js:" }), h("ul", null, warn.map((w) => h("li", { text: w })))));
    }
    return warn;
  }
  function devbar() {
    const bar = h("div.devbar");
    const add = (label, fn) => bar.append(h("button", { type: "button", text: label, onClick: fn }));
    add("Reset", () => { Store.clear(); location.href = location.pathname + "?dev"; });
    add("Khoá", () => showLock());
    add("Map", () => { S.unlocked = true; save(); showMap(); });
    for (let n = 1; n <= N; n++) {
      add("M" + n, () => {
        S.unlocked = true;
        S.seenRules = true;
        S.done = false;
        S.level = n;
        if (S.lives <= 0) S.lives = MAX;
        save();
        Hud.setLives(S.lives);
        launch(n).markReady();
      });
    }
    add("Thắng", () => { if (run && run.alive) complete(run); });
    add("-1 mạng", () => { if (run && run.alive) loseLife(run); });
    add("Đầy mạng", () => { S.lives = MAX; save(); Hud.setLives(S.lives, "refill"); });
    add("Quà", () => { S.unlocked = true; S.level = N + 1; save(); openGift(); });
    document.body.append(bar);
  }

  function imageSize(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  async function boot() {
    Fx.init();
    buildScene();
    Hud.build();
    Sfx.setMuted(S.muted || params.has("mute"));
    if (params.has("reset")) {
      Store.clear();
      S = fresh();
      save();
      params.delete("reset");
      history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : ""));
      Hud.build();
    }
    validate();
    if (C.art && C.art.map) {
      const s = await imageSize(C.art.map);
      if (s && s.w && s.h) MAP_AR = s.w / s.h;
    }
    // Lượt chạm đầu tiên: mở khoá âm thanh và bật nhạc nền nếu đã qua màn khoá (ví dụ khi tải lại trang)
    document.addEventListener(
      "pointerdown",
      () => {
        Sfx.unlock();
        const M = C.music || {};
        if (S.unlocked && !S.muted && !Music.playing) Music.play(S.done ? M.finale || M.game : M.game);
      },
      { once: true, capture: true }
    );
    // iOS Safari chỉ áp :active (nút chunky lún xuống) khi trang có listener touchstart
    document.addEventListener("touchstart", () => {}, { passive: true });
    if (DEV) devbar();

    const lv = parseInt(params.get("level"), 10);
    const sc = params.get("screen");
    if (lv >= 1 && lv <= N) {
      S.unlocked = true;
      S.seenRules = true;
      S.done = false;
      S.level = lv;
      save();
      Hud.setLives(S.lives);
      launch(lv).markReady();
    } else if (sc === "lock" || (!S.unlocked && !sc)) showLock();
    else if (sc === "finale" || (S.done && !sc)) {
      S.unlocked = true;
      S.done = true;
      save();
      showFinale();
    } else {
      S.unlocked = true;
      save();
      showMap();
      maybeRules();
    }
    document.documentElement.classList.add("is-ready");
  }

  window.Game = {
    ORDER,
    get state() { return JSON.parse(JSON.stringify(S)); },
    get screen() { return screen; },
    get run() { return run; },
    launch: (n) => launch(n).markReady(),
    startLevel,
    showMap,
    showLock,
    openGift,
    complete: () => run && run.alive && complete(run),
  };

  boot();
})();
