/* =====================================================================
   ui.js · Thành phần giao diện dùng chung (không cần sửa)
   Global: UI
   ===================================================================== */
(function () {
  "use strict";
  const { h, sleep, cssMs, replay, center, clamp, reducedMotion } = Core;
  const T = () => (window.CONFIG && CONFIG.text) || {};

  const STAR_SVG =
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="star__body" d="${Icons.STAR_PATH}"/>` +
    `<ellipse class="star__shine" cx="9.7" cy="8.9" rx="1.4" ry=".8" transform="rotate(-50 9.7 8.9)"/></svg>`;
  const LIFE_SVG =
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="life__body" d="${Icons.HEART_PATH}"/>` +
    `<ellipse class="life__shine" cx="7.3" cy="7.7" rx="1.9" ry="1.1" transform="rotate(-38 7.3 7.7)"/></svg>`;

  /* ---------------- Buttons ---------------- */
  // UI.button("Chơi!", { tone: "pink|mint|butter|coral|lilac|cream", size: "lg|sm|xs", shape: "round|square",
  //   icon: "play", iconRight: "arrowRight", block: true, onClick, sound: true, ariaLabel })
  function button(label, o = {}) {
    const { tone = "pink", size, shape, icon, iconRight, block, onClick, sound = true, ariaLabel, cls, tilt } = o;
    const classes = ["btn", tone !== "pink" && "btn--" + tone, size && "btn--" + size, shape && "btn--" + shape, block && "btn--block", cls]
      .filter(Boolean)
      .join(" ");
    const b = h("button", { type: "button", class: classes, "aria-label": ariaLabel || null });
    if (tilt != null) b.style.setProperty("--tilt", tilt + "deg");
    if (icon) b.append(h("span", { html: Icons[icon] || icon, "aria-hidden": "true", style: { display: "contents" } }));
    if (label) b.append(h("span", { text: label }));
    if (iconRight) b.append(h("span", { html: Icons[iconRight] || iconRight, "aria-hidden": "true", style: { display: "contents" } }));
    b.addEventListener("click", (e) => {
      if (sound) Sfx.tap();
      if (onClick) onClick(e);
    });
    return b;
  }

  function plate(text, tone = "pink", o = {}) {
    const cls = ["plate", tone !== "pink" && "plate--" + tone, o.size && "plate--" + o.size, o.cls].filter(Boolean).join(" ");
    return h("div", { class: cls }, h("span.t-stroke-sm", { text }));
  }

  /* ---------------- Modal (transitions-dev t-modal) ---------------- */
  let active = null;
  // UI.modal({ plate, tone, art, title, body, buttons: [{label, value, tone, size, icon}], closable, cls })
  // → { el, close(value), result: Promise<value> }
  function modal(o = {}) {
    const { plate: plateText, tone = "pink", art, title, body, buttons = [], closable = false, cls, label } = o;
    if (active) active.close(null, true);
    const layer = h("div.modal-layer");
    const backdrop = h("div.modal-backdrop");
    const box = h("div", {
      class: "modal panel t-modal" + (cls ? " " + cls : ""),
      role: "dialog",
      "aria-modal": "true",
      "aria-label": label || plateText || title || "",
    });
    let resolve;
    const result = new Promise((r) => (resolve = r));
    let closed = false;
    const openedAt = performance.now();
    const api = { el: box, layer, result, close };
    function onKey(e) {
      if (e.key === "Escape" && closable) close(null);
      else if (e.key === "Enter") {
        // Giữ phím Enter từ màn trước (auto-repeat) hoặc bấm ngay lúc modal vừa bật: bỏ qua,
        // để không lỡ bấm nút chính trước khi kịp đọc (và không bỏ qua hiệu ứng sao).
        if (e.repeat || e.isComposing || performance.now() - openedAt < 250) {
          e.preventDefault();
          return;
        }
        // Đang focus vào một nút trong modal (ví dụ "Để sau" hoặc nút X): để trình duyệt tự bấm
        // đúng nút đó, không ép thành nút đầu tiên.
        const a = document.activeElement;
        if (a && box.contains(a) && a.closest("button")) return;
        const first = box.querySelector(".modal__actions .btn");
        if (first) { e.preventDefault(); first.click(); }
      }
    }
    function close(value, instant) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      box.classList.remove("is-open");
      box.classList.add("is-closing");
      layer.classList.remove("is-open");
      const ms = instant ? 0 : cssMs("--modal-close-dur", 160);
      setTimeout(() => { box.classList.remove("is-closing"); layer.remove(); }, ms + (instant ? 0 : 120));
      if (active === api) active = null;
      resolve(value);
    }
    if (plateText) box.append(plate(plateText, tone, { size: "lg", cls: "modal__plate" }));
    if (closable) {
      box.append(button("", { icon: "x", shape: "round", size: "xs", tone: "coral", cls: "modal__x", ariaLabel: T().close || "Đóng", onClick: () => close(null) }));
      backdrop.addEventListener("click", () => close(null));
    }
    if (art) box.append(h("div.modal__art", null, art));
    if (title) box.append(h("h2.modal__title", { text: title }));
    if (body) box.append(h("div.modal__body", null, typeof body === "string" ? h("p", { text: body }) : body));
    if (buttons.length) {
      const acts = h("div.modal__actions");
      buttons.forEach((b) => {
        const { onClick, value, ...rest } = b;
        acts.append(button(b.label, { ...rest, block: b.block !== false, onClick: (e) => { if (onClick) onClick(e); close(value != null ? value : b.label); } }));
      });
      box.append(acts);
    }
    layer.append(backdrop, box);
    (document.getElementById("modal-root") || document.body).append(layer);
    void box.offsetWidth;
    layer.classList.add("is-open");
    box.classList.add("is-open");
    document.addEventListener("keydown", onKey);
    const first = box.querySelector(".modal__actions .btn");
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
    active = api;
    return api;
  }

  /* ---------------- Stars ---------------- */
  function stars(n = 0, o = {}) {
    const el = h("div", { class: "stars" + (o.small ? " stars--sm" : ""), role: "img", "aria-label": n + "/3 sao" });
    for (let i = 0; i < 3; i++) el.append(h("span", { class: "star" + (i < n ? " is-on" : ""), html: STAR_SVG }));
    return el;
  }
  async function animateStars(el, n) {
    const list = el.querySelectorAll(".star");
    list.forEach((s) => s.classList.remove("is-on"));
    for (let i = 0; i < 3; i++) {
      await sleep(i === 0 ? 260 : 340);
      if (i < n) {
        list[i].classList.add("is-on");
        replay(list[i], "is-pop");
        Sfx.star(i);
        Fx.burstAt(list[i], { count: 14, shapes: ["star", "circle"], colors: ["#FFD24A", "#FFE27A", "#FFFFFF"], speed: 6 });
      }
    }
  }

  function lifeIcon(empty) {
    return h("span", { class: "life" + (empty ? " is-empty" : ""), html: LIFE_SVG });
  }
  function heartsRow(n, max) {
    const el = h("div.lives", { role: "img", "aria-label": n + " mạng" });
    for (let i = 0; i < max; i++) el.append(lifeIcon(i >= n));
    return el;
  }

  /* ---------------- Timer bar ---------------- */
  // const t = UI.timer({ seconds: 60, onEnd, onTick(sec) }); mount t.el; t.start(); t.pause(); t.stop()
  function timer(o = {}) {
    const { seconds = 60, onEnd, onTick, lowAt = 10 } = o;
    const total = seconds * 1000;
    const fill = h("div.timerbar__fill");
    const text = h("span.timerbar__text.t-stroke-sm");
    const el = h("div.timerbar", { role: "timer" }, h("div.timerbar__icon", { html: Icons.clock }), h("div.timerbar__track", null, fill, text));
    let remaining = total;
    let running = false;
    let ended = false;
    let autoPaused = false;
    let lastT = 0;
    let raf = 0;
    let lastSec = null;
    const fmtTime = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    function render() {
      fill.style.width = clamp(remaining / total, 0, 1) * 100 + "%";
      const s = Math.ceil(remaining / 1000);
      if (s !== lastSec) {
        lastSec = s;
        text.textContent = fmtTime(s);
        el.classList.toggle("is-low", s <= lowAt);
        if (running && s <= 5 && s > 0) Sfx.tick();
        if (onTick) onTick(s);
      }
    }
    function loop(t) {
      if (!running) return;
      // Chặn bước nhảy lớn (tab bị treo / máy lag) để không mất oan cả mấy giây một lúc
      remaining -= Math.min(Math.max(0, t - lastT), 250);
      lastT = t;
      if (remaining <= 0) {
        remaining = 0;
        running = false;
        ended = true;
        render();
        document.removeEventListener("visibilitychange", vis);
        if (onEnd) onEnd();
        return;
      }
      render();
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || ended) return;
      // Tab đang ẩn (ví dụ đếm ngược xong khi em chuyển app): chờ quay lại rồi mới chạy giờ
      if (document.hidden) {
        autoPaused = true;
        return;
      }
      running = true;
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function pause() {
      running = false;
      autoPaused = false;
      cancelAnimationFrame(raf);
    }
    function stop() {
      pause();
      ended = true;
      document.removeEventListener("visibilitychange", vis);
    }
    function vis() {
      if (document.hidden) {
        if (running) { pause(); autoPaused = true; }
      } else if (autoPaused) {
        autoPaused = false;
        start();
      }
    }
    document.addEventListener("visibilitychange", vis);
    render();
    return {
      el, start, pause, stop,
      resume: start,
      get remaining() { return remaining / 1000; },
      get running() { return running; },
      get ended() { return ended; },
    };
  }

  /* ---------------- Countdown 3-2-1 ---------------- */
  // Chờ tới khi tab hiện lại (tự gỡ listener)
  function whenVisible() {
    if (!document.hidden) return Promise.resolve();
    return new Promise((res) => {
      const on = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", on);
        res();
      };
      document.addEventListener("visibilitychange", on);
    });
  }
  // Engine gỡ lớp .countdown khi huỷ màn: vòng lặp dừng luôn, không phát tiếng vào lớp đã gỡ.
  // Tab bị ẩn giữa chừng: chờ em quay lại rồi đếm lại từ đầu.
  async function countdown() {
    const t = T();
    const words = [...(t.countdown || ["3", "2", "1"]), t.go || "Bắt đầu!"];
    const layer = h("div.countdown", { "aria-live": "assertive" });
    document.body.append(layer);
    let i = 0;
    while (i < words.length) {
      if (!layer.isConnected) return;
      if (document.hidden) {
        layer.replaceChildren();
        await whenVisible();
        i = 0;
        continue;
      }
      const last = i === words.length - 1;
      layer.replaceChildren(h("div", { class: "countdown__num t-stroke-lg" + (last ? " is-go" : ""), text: words[i] }));
      if (last) Sfx.go();
      else Sfx.count();
      await sleep(last ? 620 : 680);
      if (!document.hidden) i++;
    }
    if (!layer.isConnected) return;
    layer.classList.add("is-leaving");
    await sleep(200);
    layer.remove();
  }

  /* ---------------- Floating text + flashes ---------------- */
  // Chữ bay lên tại (x, y). Tự kéo vào trong màn hình để không bị cắt ở mép (câu dài thì xuống dòng, xem base.css).
  function float(text, x, y, tone = "pink") {
    const el = h("div", { class: "float-text t-stroke float-text--" + tone, text, style: { left: x + "px", top: y + "px" } });
    document.body.append(el);
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const w = el.offsetWidth;
    const fh = el.offsetHeight;
    const half = (w * 1.15) / 2 + 8; // keyframe float-up phóng to 1.15 lần
    el.style.left = (half * 2 >= vw ? vw / 2 : clamp(x, half, vw - half)) + "px";
    el.style.top = Math.max(y, fh * 1.4 + 6) + "px"; // bay lên ~1.4 lần chiều cao chữ khi còn rõ
    setTimeout(() => el.remove(), 1050);
    return el;
  }
  function floatAt(target, text, tone) {
    if (!target) return;
    const c = center(target);
    return float(text, c.x, c.y, tone);
  }
  function hurtFlash() {
    const el = h("div.hurt-flash");
    document.body.append(el);
    setTimeout(() => el.remove(), 560);
  }
  // Error shake on any element (transitions-dev error-state keyframes)
  function shake(el) {
    if (!el) return;
    el.classList.add("t-shake");
    el.classList.remove("is-shaking");
    void el.offsetWidth;
    el.classList.add("is-shaking");
    const ms = cssMs("--shake-dur-a", 80) * 2 + cssMs("--shake-dur-b", 60) * 2;
    setTimeout(() => el.classList.remove("is-shaking"), ms + 20);
  }

  /* ---------------- Success check (transitions-dev) ---------------- */
  function successCheck(cls = "") {
    const el = h("span", {
      class: "t-success-check" + (cls ? " " + cls : ""),
      "data-state": "out",
      "aria-hidden": "true",
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    });
    el.show = () => {
      el.setAttribute("data-state", "out");
      void el.offsetWidth;
      el.setAttribute("data-state", "in");
    };
    return el;
  }

  /* ---------------- Number pop-in (transitions-dev) ---------------- */
  function digits(group, str) {
    group.classList.add("t-digit-group");
    group.classList.remove("is-animating");
    group.replaceChildren();
    const chars = String(str).split("");
    chars.forEach((ch, i) => {
      const span = h("span.t-digit", { text: ch });
      if (chars.length > 2) {
        if (i === chars.length - 2) span.dataset.stagger = "1";
        else if (i === chars.length - 1) span.dataset.stagger = "2";
      }
      group.append(span);
    });
    void group.offsetHeight;
    group.classList.add("is-animating");
  }

  /* ---------------- Screen wipe transition ---------------- */
  async function wipe(mid) {
    const rm = reducedMotion();
    const w = h("div.wipe", null, Mascot.el("happy", { size: 110, cls: "wipe__mascot" }));
    document.body.append(w);
    void w.offsetWidth;
    Sfx.whoosh();
    w.classList.add("is-in");
    await sleep(rm ? 20 : 470);
    try { if (mid) await mid(); } catch (e) { console.error(e); }
    await sleep(rm ? 10 : 240);
    w.classList.remove("is-in");
    await sleep(rm ? 10 : 460);
    w.remove();
  }

  /* ---------------- Images with fallback ---------------- */
  function missing(src) {
    return h("div.img-missing", null, h("span", null, T().missingImage || "Không tìm thấy ảnh", h("br"), src || ""));
  }
  // UI.img(src, { alt, cls }) → <img> (or <video> for .mp4) that turns into a readable
  // "missing image" box when the file cannot be found.
  function img(src, o = {}) {
    const { alt = "", cls = "" } = o;
    if (!src) return missing(src);
    if (Core.isVideo(src)) {
      const v = h("video", { class: cls || null, src, playsinline: true, muted: true, loop: true, autoplay: true, preload: "auto" });
      v.muted = true;
      v.playsInline = true;
      v.addEventListener("error", () => { const m = missing(src); if (cls) m.classList.add(...cls.split(" ")); v.replaceWith(m); }, { once: true });
      return v;
    }
    const el = h("img", { class: cls || null, src, alt, draggable: "false", decoding: "async" });
    el.addEventListener("error", () => { const m = missing(src); if (cls) m.classList.add(...cls.split(" ")); el.replaceWith(m); }, { once: true });
    return el;
  }

  /* ---------------- Loading chip ---------------- */
  function loading(show) {
    let el = document.querySelector(".loading");
    if (!show) { if (el) el.remove(); return; }
    if (el) return;
    el = h("div.loading", null, h("div.chip", null, h("span.loading__dot"), h("span.loading__dot"), h("span.loading__dot"), h("span", { text: T().loading || "Đang tải..." })));
    document.body.append(el);
  }

  window.UI = {
    button, plate, modal, stars, animateStars, lifeIcon, heartsRow, timer, countdown, float, floatAt,
    hurtFlash, shake, successCheck, digits, wipe, img, missing, loading, STAR_SVG, LIFE_SVG,
    get activeModal() { return active; },
  };
})();
