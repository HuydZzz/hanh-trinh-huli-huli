/* =====================================================================
   finale.js · Màn cuối (không cần sửa)
   Phần 1: "Hoàn thành nhiệm vụ!" + điểm + số ngày bên nhau + lá thư
   Phần 2: trình chiếu ảnh polaroid rơi chồng lên nhau, lặp mãi
   Global: Finale
   ===================================================================== */
(function () {
  "use strict";

  const DROP_MS = 760; // khớp với animation finale-drop trong finale.css
  const KEEP = 3; // số polaroid giữ lại trong chồng (ảnh hiện tại + 2 ảnh bên dưới)
  const VIDEO_MAX_MS = 25000; // video dài quá thì tự chuyển sau chừng này
  const LOAD_TIMEOUT_MS = 10000;

  const SKY_COLORS = ["var(--pink-300)", "var(--pink-400)", "var(--pink-200)", "var(--mint-300)", "var(--butter-300)", "var(--lilac-300)", "var(--paper)"];
  const TAPES = ["mint", "pink", "butter", "lilac"];

  /* ---------------- small pure helpers ---------------- */
  function normPhotos(list) {
    return (Array.isArray(list) ? list : [])
      .map((p) => {
        if (typeof p === "string") return { src: p.trim(), caption: "" };
        if (p && typeof p === "object") return { src: String(p.src || "").trim(), caption: p.caption ? String(p.caption).trim() : "" };
        return null;
      })
      .filter((p) => p && p.src);
  }
  // 1069 -> "1.069" (vi-VN), independent of the browser's ICU data
  const dots = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // Split a list of words into n balanced lines at word boundaries (smallest longest line).
  // Returns arrays of word indexes. Works on indexes so the caller can reuse existing word nodes.
  function balance(words, n) {
    const len = words.map((w) => String(w).length);
    const count = len.length;
    n = Math.max(1, Math.min(n, count));
    const span = (a, b) => { let s = b - a - 1; for (let i = a; i < b; i++) s += len[i]; return s; };
    let best = null;
    let bestMax = Infinity;
    (function walk(start, left, acc, curMax) {
      if (curMax >= bestMax) return;
      if (left === 1) {
        const m = Math.max(curMax, span(start, count));
        if (m < bestMax) { bestMax = m; best = acc.concat([[start, count]]); }
        return;
      }
      for (let end = start + 1; end <= count - left + 1; end++) walk(end, left - 1, acc.concat([[start, end]]), Math.max(curMax, span(start, end)));
    })(0, n, [], 0);
    return (best || [[0, count]]).map(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  }
  // Split a title into 2 balanced lines at a word boundary
  function titleLines(title) {
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [words];
    return balance(words, 2).map((line) => line.map((i) => words[i]));
  }

  window.Finale = {
    start(ctx) {
      const { h, fmt, rand, pick, replay, sleep, reducedMotion, isVideo, INK } = ctx.core;
      const UI = ctx.ui;
      const Sfx = ctx.sfx;
      const Fx = ctx.fx;
      const Icons = ctx.icons;
      const Mascot = ctx.mascot;
      const T = ctx.text || {};
      const data = ctx.data || {};
      const root = ctx.root;
      const RM = reducedMotion();

      /* ---------------- lifecycle plumbing ---------------- */
      let alive = true;
      const timers = new Set();
      function later(fn, ms) {
        const id = setTimeout(() => {
          timers.delete(id);
          if (alive) fn();
        }, ms);
        timers.add(id);
        return id;
      }
      function cancel(id) {
        if (!id) return;
        clearTimeout(id);
        timers.delete(id);
      }
      const onFinale = () => document.body.dataset.screen === "finale";
      // Arrived through the gift (a tap happened, the wipe is covering us)?
      const fromGift = !!document.querySelector(".wipe");
      const ua = navigator.userActivation;
      const canSound = fromGift || !!(ua && ua.hasBeenActive);
      const sfx = (fn) => { if (canSound || (ua && ua.hasBeenActive)) { try { fn(); } catch (e) { /* no-op */ } } };

      /* =============================================================
         Background sky: gentle hearts (fall on part 1, rise on part 2)
         ============================================================= */
      const HEART_SVG =
        `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${Icons.HEART_PATH}" fill="currentColor" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
        `<ellipse cx="7.3" cy="7.7" rx="1.9" ry="1.1" transform="rotate(-38 7.3 7.7)" fill="#fff" opacity=".75"/></svg>`;
      function skyLayer(kind, count) {
        const layer = h("div.finale-sky__layer.finale-sky__layer--" + kind);
        for (let i = 0; i < count; i++) {
          const size = rand(14, 30);
          const dur = rand(10, 18);
          layer.append(
            h("span.finale-sky__heart", {
              html: HEART_SVG,
              style: {
                "--x": rand(1, 97).toFixed(1) + "%",
                "--s": size.toFixed(1) + "px",
                "--d": dur.toFixed(2) + "s",
                "--delay": (-rand(0, dur)).toFixed(2) + "s",
                "--sway": rand(-46, 46).toFixed(0) + "px",
                "--r": rand(-28, 28).toFixed(0) + "deg",
                "--o": rand(0.55, 0.95).toFixed(2),
                "--c": pick(SKY_COLORS),
              },
            })
          );
        }
        return layer;
      }
      // The sky spans the whole viewport, so scale the number of hearts with its width
      // (about 13 on a phone, up to 34 on a wide desktop).
      const skyCount = Math.round(Math.min(34, Math.max(13, (window.innerWidth || 390) / 28)));
      const sky = h("div.finale-sky", { "aria-hidden": "true" }, skyLayer("fall", skyCount), skyLayer("rise", skyCount - 1));
      for (let i = 0, n = Math.round(skyCount / 2); i < n; i++) {
        sky.append(
          h("span.finale-sky__spark", {
            html: Icons.sparkle,
            style: {
              "--x": rand(3, 95).toFixed(1) + "%",
              "--y": rand(4, 90).toFixed(1) + "%",
              "--s": rand(14, 26).toFixed(0) + "px",
              "--d": rand(2.2, 3.8).toFixed(2) + "s",
              "--delay": (-rand(0, 4)).toFixed(2) + "s",
            },
          })
        );
      }

      /* =============================================================
         Part 1 · Hoàn thành nhiệm vụ!
         ============================================================= */
      const titleText = String(data.title || "").trim() || "Hoàn thành nhiệm vụ!";
      const title = h("h2.finale-title.t-stroke-lg", { "aria-label": titleText });
      // One inline-block per word (per-letter boxes would let each letter's ink outline
      // paint over its neighbour), popped in one after another.
      const titleWords = String(titleText).trim().split(/\s+/).filter(Boolean);
      const wordEls = titleWords.map((w, i) => h("span.finale-title__word", { text: w, style: { "--i": i } }));
      let titleRows = 0;
      // Lay the words out on n balanced lines; the last line is the butter-yellow one.
      function layoutTitle(n) {
        n = Math.max(1, Math.min(n, wordEls.length));
        if (n === titleRows) return;
        titleRows = n;
        const rows = balance(titleWords, n);
        title.replaceChildren(
          ...rows.map((idx, li) => {
            const line = h("span.finale-title__line" + (li && li === rows.length - 1 ? ".is-alt" : ""), { "aria-hidden": "true" });
            idx.forEach((i, k) => {
              if (k) line.append(" ");
              line.append(wordEls[i]);
            });
            return line;
          })
        );
      }
      layoutTitle(2);

      const mascot = Mascot.el("love", { size: "var(--finale-mascot)" });
      const hero = h(
        "div.finale-hero",
        null,
        h("div.finale-mascot.finale-anim", { style: { "--d": "80ms" } }, h("div.finale-mascot__hop", null, mascot), h("span.finale-mascot__shadow", { "aria-hidden": "true" })),
        title
      );

      // Score: total stars + lives left
      const totalStars = Math.max(0, ctx.totalStars | 0);
      const maxStars = Math.max(0, ctx.maxStars | 0);
      const lives = Math.max(0, ctx.lives | 0);
      const maxLives = Math.max(1, ctx.maxLives | 0);
      const starNum = h("span.finale-chip__big", { text: String(totalStars) });
      const starChip = h(
        "div.finale-chip",
        { role: "img", "aria-label": `${totalStars}/${maxStars} sao` },
        h("span.star.is-on.finale-chip__star", { html: UI.STAR_SVG }),
        h("span.finale-chip__num", { "aria-hidden": "true" }, starNum, h("span.finale-chip__max", { text: "/" + maxStars }))
      );
      const livesRow = UI.heartsRow(lives, maxLives);
      livesRow.classList.add("finale-lives");
      livesRow.setAttribute("aria-label", `Còn ${lives}/${maxLives} mạng`);
      const score = h("div.finale-score.finale-anim", { style: { "--d": "520ms" } }, starChip, livesRow);

      // Days together badge
      let daysEl = null;
      let daysNum = null;
      const daysStr = typeof ctx.days === "number" && isFinite(ctx.days) ? dots(ctx.days) : null;
      if (daysStr) {
        const tpl = T.daysTogether || "Tụi mình đã bên nhau {days} ngày";
        const parts = String(tpl).split("{days}");
        daysNum = h("span.finale-days__num.t-stroke-sm", { text: daysStr });
        daysEl = h(
          "div.finale-days.finale-anim",
          { style: { "--d": "760ms" } },
          h("span.sr-only", { text: fmt(tpl, { days: daysStr }) }),
          h("span.finale-days__icon", { "aria-hidden": "true" }, UI.lifeIcon(false)),
          h("span.finale-days__text", { "aria-hidden": "true" }, parts[0], parts.length > 1 ? daysNum : null, parts.slice(1).join(daysStr))
        );
      }

      // Letter
      const message = String(data.message || "").replace(/\\n/g, "\n").trim();
      const signature = String(data.signature || "").trim();
      // No message and no signature: leave the card out instead of showing an empty strip of paper.
      const letter =
        message || signature
          ? h(
              "article.finale-letter.panel.finale-anim",
              { style: { "--d": "1000ms" }, "aria-label": "Lời chúc" },
              h("span.finale-letter__tape", { "aria-hidden": "true" }),
              message ? h("p.finale-letter__text", { text: message }) : null,
              signature
                ? h("p.finale-letter__sign", null, h("span", { text: signature }), h("span.finale-letter__heart", { "aria-hidden": "true" }, UI.lifeIcon(false)))
                : null
            )
          : null;

      // Long letters scroll inside the card; fade the bottom edge while there is more to read.
      const letterText = letter && letter.querySelector(".finale-letter__text");
      let letterRO = null;
      function checkMore() {
        if (!letterText || !alive) return;
        letterText.classList.toggle("is-more", letterText.scrollHeight - letterText.clientHeight - letterText.scrollTop > 4);
      }
      if (letterText) {
        letterText.addEventListener("scroll", checkMore, { passive: true });
        if (window.ResizeObserver) {
          letterRO = new ResizeObserver(checkMore);
          letterRO.observe(letterText);
        }
      }

      const cta = UI.button(T.watchMemories || "Xem kỉ niệm", { size: "lg", icon: "play", block: true, cls: "finale-cta", onClick: onWatch });
      const ctaWrap = h("div.finale-cta-wrap.finale-anim", { style: { "--d": "1250ms" } }, cta);

      // .is-pre keeps the animated pieces hidden until the entrance starts, so nothing flashes
      // at full opacity while the gift wipe is still uncovering the edges of the screen.
      const pageDone = h("section.finale-page.finale-done.is-pre", { "aria-label": titleText }, hero, score, daysEl, letter, ctaWrap);

      /* =============================================================
         Part 2 · Những khoảnh khắc đẹp nhất
         ============================================================= */
      let pageSlides = null;
      let stage = null;
      let stack = null;
      let hint = null;
      let live = null;
      let againBtn = null;
      let hintGone = false;

      function buildSlides() {
        // Title plate as a balanced 2-line sign so the plate hugs the text on every width
        const plateText = T.slideshowTitle || "Những khoảnh khắc đẹp nhất";
        const plateLines = plateText.trim().split(/\s+/).length >= 3 ? titleLines(plateText) : [[plateText]];
        const plateSpan = h("span.t-stroke-sm");
        plateLines.forEach((ws, i) => { if (i) plateSpan.append(h("br")); plateSpan.append(ws.join(" ")); });
        // long custom titles get a smaller plate font so the photos keep most of the height
        const plate = h("div.plate.plate--mint.plate--lg.finale-slides__plate" + (plateText.trim().length > 34 ? ".is-long" : ""), { role: "heading", "aria-level": "2" }, plateSpan);
        // Every frame is the same portrait 9:16 (css). When no photo has a caption, all cards get the
        // slim bottom margin (with a little heart mark) instead of an empty caption strip; one
        // captioned photo keeps the full caption band on every card so the stack stays uniform.
        const slim = photos.length > 0 && photos.every((p) => !p.caption);
        stack = h("div.finale-stack" + (slim ? ".is-slim" : ""));
        stage = h(
          "div.finale-stage",
          { role: "button", tabindex: "0", "aria-label": "Xem ảnh tiếp theo" },
          stack
        );
        const fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
        hint = h("p.finale-hint", { text: fine ? "Bấm vào ảnh hoặc phím → để xem tiếp" : "Chạm vào ảnh để xem tiếp" });
        if (photos.length < 2) hint.classList.add("is-gone");
        live = h("p.sr-only", { "aria-live": "polite" });
        const back = UI.button("Xem lại lời chúc", { tone: "cream", size: "sm", icon: "heartFill", cls: "finale-ctl finale-ctl--letter", onClick: goLetter });
        const again = UI.button(T.replayAll || "Chơi lại từ đầu", {
          tone: "cream",
          size: "sm",
          icon: "refresh",
          cls: "finale-ctl finale-ctl--replay",
          ariaLabel: T.replayAll || "Chơi lại từ đầu",
          onClick: askRestart,
        });
        again.querySelector("span:last-child").classList.add("finale-ctl__label");
        againBtn = again;
        pageSlides = h(
          "section.finale-page.finale-slides",
          { "aria-label": T.slideshowTitle || "Những khoảnh khắc đẹp nhất", hidden: true },
          h("div.finale-slides__head", null, plate),
          stage,
          hint,
          live,
          h("div.finale-controls", null, back, again)
        );
        wrap.append(pageSlides);

        // Tap / click / swipe on the stage = next photo (Pointer Events: touch + mouse + pen)
        let down = null;
        stage.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          down = { id: e.pointerId, x: e.clientX, y: e.clientY };
        });
        stage.addEventListener("pointerup", (e) => {
          if (!down || e.pointerId !== down.id) return;
          const dx = e.clientX - down.x;
          const dy = e.clientY - down.y;
          down = null;
          if (Math.hypot(dx, dy) < 16 || (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy))) advance(true);
        });
        stage.addEventListener("pointercancel", () => { down = null; });
        // (css: touch-action pan-y on the stage, so a horizontal swipe reaches us instead of being cancelled)
        // a mouse click should not park a keyboard focus ring on the whole stage
        stage.addEventListener("mousedown", (e) => e.preventDefault());
        stage.addEventListener("pointerleave", () => { down = null; });
        stage.addEventListener("keydown", (e) => {
          if (leaving || busy || UI.activeModal || e.repeat) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            advance(true);
          }
        });
      }

      /* =============================================================
         DOM mount
         ============================================================= */
      const wrap = h("div.finale", null, pageDone);
      root.append(sky, wrap);

      let view = "done";
      let busy = false;
      let leaving = false; // restart confirmed: the engine is about to tear us down

      /* ---------------- Title fit ----------------
         The default title sits on 2 whole lines. A long custom title (config.js) first scales
         down until its widest line fits; if that would go below 72% it is re-balanced onto 3,
         then 4 lines. Only as a last resort (scale 55%) do the lines wrap by themselves. */
      const heroMascot = hero.firstElementChild;
      function fitTitle() {
        if (!alive || pageDone.hidden || !pageDone.clientWidth) return;
        const row = getComputedStyle(hero).flexDirection === "row";
        const avail = pageDone.clientWidth - 18 - (row ? heroMascot.offsetWidth + 4 : 0);
        if (avail <= 0) return;
        title.classList.add("is-measure");
        title.style.setProperty("--fit", "1");
        // Measure every word once at full size (the butter line is drawn 1.06x bigger), then work
        // out each candidate layout arithmetically, so the word nodes are only moved (which would
        // replay their pop-in) when the number of lines really changes.
        const fs = parseFloat(getComputedStyle(title).fontSize) || 32;
        const base = wordEls.map((el) => el.offsetWidth / (el.parentElement && el.parentElement.classList.contains("is-alt") ? 1.06 : 1));
        const space = fs * 0.3;
        const widest = (rows) =>
          Math.max(...rows.map((idx, li) => (idx.reduce((s, i) => s + base[i], 0) + space * (idx.length - 1)) * (li && li === rows.length - 1 ? 1.06 : 1)));
        const maxRows = Math.min(4, wordEls.length);
        let rowsN = Math.min(2, maxRows);
        let fit = 1;
        for (let n = rowsN; n <= maxRows; n++) {
          const need = widest(balance(titleWords, n));
          rowsN = n;
          fit = need > avail ? avail / need : 1;
          if (fit >= 0.72) break;
        }
        layoutTitle(rowsN);
        title.style.setProperty("--fit", Math.max(0.55, fit).toFixed(3));
        title.classList.remove("is-measure");
      }
      fitTitle();
      let fitRO = null;
      if (window.ResizeObserver) {
        fitRO = new ResizeObserver(() => fitTitle());
        fitRO.observe(wrap);
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTitle());

      // Keyboard users keep their place: when the focused control (reached with the keyboard) gets
      // hidden by a page swap, focus moves to the new page instead of falling back to <body>.
      // Mouse and touch users are left alone, so no focus ring pops up on the photo stage.
      function kbFocusIn(pageEl) {
        const a = document.activeElement;
        if (!a || !pageEl.contains(a)) return false;
        try { return a.matches(":focus-visible"); } catch (e) { return false; }
      }
      function focusIn(el) {
        if (el && alive) { try { el.focus({ preventScroll: true }); } catch (e) { /* no-op */ } }
      }

      /* ---------------- Part 1 entrance ---------------- */
      function enterDone(soft) {
        pageDone.classList.remove("is-enter", "is-soft");
        void pageDone.offsetWidth;
        pageDone.classList.add(soft ? "is-soft" : "is-enter");
        pageDone.classList.remove("is-pre");
        sky.classList.remove("is-rise");
        if (soft) {
          later(() => Fx.burstAt(letter || title, { count: 16, shapes: ["heart"], colors: ["#FF7FA8", "#FFA3C2", "#FFFFFF"], speed: 7 }), 260);
          return;
        }
        if (!RM) {
          Fx.confetti({ duration: 2400, count: 140 });
          later(() => Fx.burstAt(title, { count: 26, shapes: ["heart", "star"], speed: 9 }), 420);
          later(() => Fx.confetti({ duration: 1400, count: 60, shapes: ["heart"], colors: ["#FF7FA8", "#FFA3C2", "#FFC8DB", "#FFFFFF"] }), 2600);
        }
        later(() => {
          UI.digits(starNum, String(totalStars));
          sfx(() => Sfx.star(1));
          livesRow.querySelectorAll(".life:not(.is-empty)").forEach((l, i) => {
            l.style.animationDelay = i * 110 + "ms";
            replay(l, "is-refill");
          });
        }, RM ? 0 : 640);
        if (daysNum) {
          later(() => {
            UI.digits(daysNum, daysStr);
            sfx(() => Sfx.pop());
          }, RM ? 0 : 900);
        }
        later(() => sfx(() => Sfx.flip()), RM ? 0 : 1120);
        later(() => sfx(() => Sfx.star(2)), RM ? 0 : 1420);
      }

      // Wait until the gift wipe is uncovering the screen, then celebrate.
      (function whenRevealed(t0) {
        const w = document.querySelector(".wipe");
        if (!w || performance.now() - t0 > 2600) enterDone(false);
        else if (!w.classList.contains("is-in")) later(() => enterDone(false), RM ? 0 : 200); // receding
        else later(() => whenRevealed(t0), 40);
      })(performance.now());

      /* ---------------- page switching ---------------- */
      function swapPage(from, to) {
        from.classList.remove("is-leaving");
        if (RM) {
          from.hidden = true;
          to.hidden = false;
          return;
        }
        from.classList.add("is-leaving");
        later(() => {
          from.hidden = true;
          from.classList.remove("is-leaving");
        }, 200);
        to.hidden = false;
        replay(to, "is-entering");
      }

      function onWatch() {
        ctx.playMusic(); // phải gọi ngay trong lượt chạm (iOS)
        if (busy || leaving || view !== "done") return;
        busy = true;
        const hadFocus = kbFocusIn(pageDone);
        const first = !pageSlides;
        if (first) buildSlides();
        view = "slides";
        sky.classList.add("is-rise");
        if (first) {
          const firstSrc = photos.length ? photos[0].src : null;
          UI.wipe(async () => {
            if (firstSrc) await Promise.race([loadMeta(firstSrc), sleep(1400)]);
            if (!alive) return;
            pageDone.hidden = true;
            pageSlides.hidden = false;
            if (hadFocus) focusIn(stage);
            playing = true;
            later(() => { busy = false; resumeShow(); }, RM ? 0 : 360);
          });
        } else {
          swapPage(pageDone, pageSlides);
          if (hadFocus) focusIn(stage);
          playing = true;
          later(() => { busy = false; resumeShow(); }, RM ? 0 : 240);
        }
      }

      function goLetter() {
        if (busy || leaving || view !== "slides") return;
        busy = true;
        const hadFocus = kbFocusIn(pageSlides);
        view = "done";
        playing = false;
        pauseShow();
        swapPage(pageSlides, pageDone);
        fitTitle(); // the window may have been resized while the letter was hidden
        if (hadFocus) focusIn(cta);
        enterDone(true);
        later(() => { busy = false; }, 260);
      }

      /* =============================================================
         Slideshow engine
         ============================================================= */
      const photos = normPhotos(data.photos);
      const slideMs = Math.max(1200, (Number(data.slideSeconds) || 3.5) * 1000);
      const meta = new Map();
      let idx = -1;
      let playing = false;
      let inflight = false;
      let seq = 0;
      let slideTimer = 0;
      let slideStart = 0;
      let slideDur = 0;
      let pendingMs = null;
      let lastAdvance = 0;
      let z = 1;
      let prevTilt = 0;
      let curVideo = null;
      let curVideoStart = 0;

      function loadMeta(src) {
        if (meta.has(src)) return meta.get(src);
        const p = new Promise((resolve) => {
          let done = false;
          let to = 0;
          const finish = (m) => {
            if (done) return;
            done = true;
            cancel(to);
            resolve(m);
          };
          to = later(() => finish({ ok: true, ar: 0.8, guess: true }), LOAD_TIMEOUT_MS);
          if (isVideo(src)) {
            const v = document.createElement("video");
            v.muted = true;
            v.playsInline = true;
            v.preload = "metadata";
            v.onloadedmetadata = () => finish({ ok: true, video: true, ar: v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9 });
            v.onerror = () => finish({ ok: false, ar: 0.8 });
            v.src = src;
          } else {
            const im = new Image();
            im.decoding = "async";
            im.onload = () => finish({ ok: true, ar: im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1 });
            im.onerror = () => finish({ ok: false, ar: 0.8 });
            im.src = src;
          }
        });
        meta.set(src, p);
        return p;
      }

      function clearSlideTimer() {
        cancel(slideTimer);
        slideTimer = 0;
      }
      // Hold the loop: letter showing, tab hidden, confirm dialog open, restart under way, or not on this screen.
      const held = () => !playing || leaving || !!confirmBox || document.hidden || !onFinale();
      function scheduleNext(ms) {
        clearSlideTimer();
        if (photos.length < 2) return;
        if (held()) {
          pendingMs = ms;
          return;
        }
        pendingMs = null;
        slideStart = performance.now();
        slideDur = ms;
        slideTimer = later(() => {
          slideTimer = 0;
          advance(false);
        }, ms);
      }
      function pauseShow() {
        if (slideTimer) {
          pendingMs = Math.max(500, slideDur - (performance.now() - slideStart));
          clearSlideTimer();
        }
        if (curVideo) { try { curVideo.pause(); } catch (e) { /* no-op */ } }
      }
      function resumeShow() {
        if (!alive || held()) return;
        if (curVideo && curVideo.isConnected) {
          const p = curVideo.play();
          if (p && p.catch) p.catch(() => {});
        }
        if (!photos.length) {
          if (stack && !stack.children.length) drop({ placeholder: true, caption: "Kỉ niệm của tụi mình" }, { ok: true, ar: 0.8 }, false);
          return;
        }
        if (idx < 0) {
          if (!inflight) advance(false);
          return;
        }
        if (slideTimer || inflight) return;
        scheduleNext(pendingMs != null ? pendingMs : slideMs);
      }

      function nudgeTop() {
        const top = stack && stack.lastElementChild;
        if (!top) return;
        replay(top, "is-nudge");
        Fx.burstAt(top, { count: 14, shapes: ["heart"], colors: ["#FF7FA8", "#FFA3C2", "#FFFFFF"], speed: 7 });
      }

      async function advance(manual) {
        if (!alive || !pageSlides || leaving) return;
        if (!photos.length) {
          if (manual) nudgeTop();
          return;
        }
        if (manual) {
          const now = performance.now();
          if (now - lastAdvance < 280) return;
          lastAdvance = now;
          sfx(() => Sfx.flip());
          if (!hintGone && idx >= 0) {
            hintGone = true;
            hint.classList.add("is-gone");
          }
        }
        if (photos.length === 1 && idx === 0) {
          if (manual) nudgeTop();
          return;
        }
        clearSlideTimer();
        pendingMs = null;
        const token = ++seq;
        const next = (idx + 1) % photos.length;
        inflight = true;
        const m = await loadMeta(photos[next].src);
        if (!alive || token !== seq) return;
        inflight = false;
        if (!playing || leaving || confirmBox || !onFinale()) {
          pendingMs = 200; // resume quickly when the viewer comes back
          return;
        }
        idx = next;
        drop(photos[next], m, manual);
        if (photos.length > 1) loadMeta(photos[(next + 1) % photos.length].src); // preload the next one
        scheduleNext(m.ok && m.video ? VIDEO_MAX_MS : slideMs);
        if (manual && live) live.textContent = `Ảnh ${idx + 1}/${photos.length}` + (photos[idx].caption ? ": " + photos[idx].caption : "");
      }

      function stopMedia(el) {
        el.querySelectorAll("video").forEach((v) => {
          try {
            v.pause();
            v.removeAttribute("src");
            v.load();
          } catch (e) { /* no-op */ }
        });
      }

      function drop(item, m, manual) {
        // random tilt in -7..7, visibly different from the previous card
        let tilt = rand(2.5, 7) * (prevTilt > 0 ? -1 : 1);
        if (Math.random() < 0.25) tilt = -tilt;
        if (Math.abs(tilt - prevTilt) < 3.5) tilt = -tilt;
        prevTilt = tilt;
        // (the frame is always portrait 9:16, see --ar in finale.css; photos are cover-cropped)
        const fig = h("figure.finale-pola", {
          style: {
            "--rot": tilt.toFixed(2) + "deg",
            "--mark-rot": rand(-16, 10).toFixed(0) + "deg",
            "--dx": rand(-10, 10).toFixed(1) + "px",
            "--dy": rand(-8, 8).toFixed(1) + "px",
            "--tape-rot": rand(-8, 8).toFixed(1) + "deg",
            zIndex: String(++z),
          },
          dataset: { tape: pick(TAPES) },
        });
        const photo = h("div.finale-pola__photo");
        let media;
        if (item.placeholder) media = h("div.finale-pola__empty", null, Mascot.el("love", { size: "100%" }));
        else if (!m.ok) media = UI.missing(item.src);
        else {
          media = UI.img(item.src, { alt: item.caption || "Ảnh kỉ niệm của tụi mình", cls: "finale-pola__media" });
          if (media.tagName === "VIDEO") {
            media.loop = false;
            media.removeAttribute("loop");
            curVideo = media;
            curVideoStart = performance.now();
            const vid = media;
            const p = vid.play();
            // Muted autoplay can still be refused (e.g. iOS Low Power Mode): then the clip just sits
            // on its first frame, so give it normal photo timing instead of the long video cap.
            if (p && p.catch) {
              p.catch((err) => {
                if (err && err.name === "NotAllowedError" && alive && curVideo === vid) scheduleNext(slideMs);
              });
            }
            media.addEventListener("ended", () => {
              if (!alive || curVideo !== media) return;
              if (performance.now() - curVideoStart < slideMs) {
                media.currentTime = 0;
                const p = media.play();
                if (p && p.catch) p.catch(() => {});
              } else advance(false);
            });
            // A broken video turns into the "missing" box: fall back to the normal photo timing.
            media.addEventListener("error", () => { if (alive && curVideo === media) { curVideo = null; scheduleNext(slideMs); } }, { once: true });
          }
        }
        if (!m.ok || media.tagName !== "VIDEO") curVideo = null;
        photo.append(media);
        const cap = h("figcaption.finale-pola__cap");
        if (item.caption) cap.append(h("span.finale-pola__text", { text: item.caption }));
        else cap.append(h("span.finale-pola__doodle", { "aria-hidden": "true" }, UI.lifeIcon(false)));
        fig.append(h("span.finale-pola__tape", { "aria-hidden": "true" }), photo, cap);

        const under = Array.from(stack.children);
        under.forEach((c, i) => {
          c.classList.toggle("is-under", true);
          c.classList.toggle("is-deep", i < under.length - 1);
          // a clip that slid under the new card stops playing (no hidden playback eating battery)
          c.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch (e) { /* no-op */ } });
        });
        stack.append(fig);
        if (RM) fig.classList.add("is-in");
        else replay(fig, "is-dropping");

        later(() => {
          // landed: small dust puff + nudge the cards underneath, then trim the stack
          if (!RM) {
            const r = fig.getBoundingClientRect();
            const y = r.bottom - 6;
            Fx.burst(r.left + 10, y, { count: 5, shapes: ["circle", "heart"], colors: ["#FFFFFF", "#FFC8DB"], speed: 3.2, size: [6, 11], angle: Math.PI * 0.95, spread: 0.5, lift: 1, gravity: 0.12 });
            Fx.burst(r.right - 10, y, { count: 5, shapes: ["circle", "heart"], colors: ["#FFFFFF", "#FFC8DB"], speed: 3.2, size: [6, 11], angle: Math.PI * 0.05, spread: 0.5, lift: 1, gravity: 0.12 });
            under.slice(-2).forEach((c) => replay(c, "is-jolt"));
          }
          const all = Array.from(stack.children);
          while (all.length > KEEP) {
            const old = all.shift();
            stopMedia(old);
            old.remove();
          }
        }, RM ? 0 : Math.round(DROP_MS * 0.56));
      }

      /* ---------------- restart (with a friendly confirm) ---------------- */
      let confirmBox = null;
      function askRestart() {
        if (confirmBox || leaving || busy || view !== "slides") return;
        pauseShow();
        confirmBox = UI.modal({
          plate: (T.retry || "Chơi lại") + "?",
          tone: "mint",
          art: Mascot.el("wow", { size: 84 }),
          body: "Hành trình sẽ bắt đầu lại từ màn 1 đó. Em muốn chơi lại từ đầu hả?",
          closable: true,
          label: T.replayAll || "Chơi lại từ đầu",
          buttons: [
            { label: T.retry || "Chơi lại", value: "yes", tone: "mint", icon: "refresh" },
            { label: T.later || "Để sau", value: "no", tone: "cream", size: "sm" },
          ],
        });
        const layer = confirmBox.layer;
        confirmBox.result.then((v) => {
          confirmBox = null;
          if (!alive) return;
          if (v === "yes") {
            leaving = true;
            playing = false;
            pauseShow();
            ctx.restart();
            return;
          }
          resumeShow();
          // the dialog button that had focus is about to be removed: hand focus back to the opener
          const a = document.activeElement;
          if (!a || a === document.body || (layer && layer.contains(a))) focusIn(againBtn);
        });
      }

      /* ---------------- document listeners ---------------- */
      function onKey(e) {
        if (!alive) return;
        // Restart dialog: Enter is left to UI.modal, which lets a focused dialog button ("Để sau" or
        // the X) act on itself (never forced to "Chơi lại") and ignores a held/auto-repeated Enter.
        if (confirmBox && e.key === "Enter") return;
        if (leaving || !onFinale() || UI.activeModal || busy) return;
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.repeat && e.key !== "ArrowRight" && e.key !== "PageDown") return;
        const t = e.target;
        const onControl = t && t.closest && t.closest("button, a, input, textarea, select, [role='button']");
        if (view === "slides") {
          if (e.key === "ArrowRight" || e.key === "PageDown") {
            e.preventDefault();
            advance(true);
          } else if ((e.key === " " || e.key === "Enter") && !onControl) {
            e.preventDefault();
            advance(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            goLetter();
          }
        } else if (e.key === "Enter" && !onControl) {
          e.preventDefault();
          cta.click();
        }
      }
      function onVis() {
        if (!alive) return;
        if (document.hidden) pauseShow();
        else if (view === "slides") resumeShow();
      }
      document.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVis);

      return {
        destroy() {
          if (!alive) return;
          alive = false;
          playing = false;
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          document.removeEventListener("keydown", onKey);
          document.removeEventListener("visibilitychange", onVis);
          if (confirmBox) {
            const box = confirmBox;
            confirmBox = null;
            box.close(null, true);
          }
          if (letterRO) letterRO.disconnect();
          if (fitRO) fitRO.disconnect();
          stopMedia(wrap);
          curVideo = null;
          if (Fx.clear) Fx.clear();
          sky.remove();
          wrap.remove();
        },
      };
    },
  };
})();
