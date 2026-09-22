/* =====================================================================
   Màn 2 · Đoán ảnh mờ (key: blur)
   Ảnh bị làm mờ nằm trong khung polaroid. Chọn đúng thời điểm chụp:
   ảnh nét dần ra, hiện chú thích, rồi sang ảnh tiếp theo.
   Sai: mất 1 mạng và ảnh rõ hơn một chút (gợi ý).
   ===================================================================== */
(function () {
  "use strict";
  window.Levels = window.Levels || {};

  // Độ mờ (px) theo số lần đoán sai trên cùng một ảnh: 0 sai, 1 sai, 2+ sai
  const BLUR_STEPS = [1.5, 1, 0.5]; // độ mờ (px): ban đầu, sau 1 lần sai, sau 2 lần sai
  // Ảnh được nới ra ngoài khung EDGE x blur mỗi cạnh để mép mờ không lộ viền trong suốt
  const EDGE = 2.6;
  const LETTERS = "ABCDEFGHI";
  const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
  const EASE_BOUNCE = "cubic-bezier(0.34, 1.45, 0.64, 1)";
  const SPARK_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 1.8c.9 5.6 2.6 7.3 8.2 8.2-5.6.9-7.3 2.6-8.2 8.2-.9-5.6-2.6-7.3-8.2-8.2 5.6-.9 7.3-2.6 8.2-8.2z"/></svg>';

  const norm = (s) =>
    String(s == null ? "" : s)
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  function toPhotos(data) {
    const list = data && Array.isArray(data.photos) ? data.photos : [];
    return list.map((p) => {
      const o = typeof p === "string" ? { src: p } : p || {};
      return {
        src: o.src || "",
        options: (Array.isArray(o.options) ? o.options : [])
          .filter((x) => x != null && String(x).trim() !== "")
          .map(String),
        answer: o.answer,
        caption: o.caption ? String(o.caption).trim() : "",
      };
    });
  }

  window.Levels.blur = {
    assets(data) {
      return toPhotos(data).map((p) => p.src).filter(Boolean);
    },

    start(ctx) {
      const { h, pick, replay, shuffle, reducedMotion } = ctx.core;
      const UI = ctx.ui;
      const Sfx = ctx.sfx;
      const Fx = ctx.fx;
      const Mascot = ctx.mascot;
      const Icons = ctx.icons;
      const T = ctx.text || {};
      const data = ctx.data || {};
      const photos = toPhotos(data);
      const total = photos.length;
      const rm = reducedMotion();
      const desktop = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
      const question = data.question || "Ảnh này chụp khi nào?";

      /* ---------- lifecycle bookkeeping ---------- */
      let dead = false;
      const timers = new Set();
      const anims = new Set(); // running (for destroy)
      const mine = new WeakSet(); // every animation this level created (for stopAnims)
      const live = () => !dead && ctx.alive;
      function later(fn, ms) {
        const id = setTimeout(() => {
          timers.delete(id);
          if (live()) fn();
        }, ms);
        timers.add(id);
        return id;
      }
      function unlater(id) {
        if (id == null) return;
        clearTimeout(id);
        timers.delete(id);
      }
      // Resolves after ms (never resolves once the level is gone, callers stop there).
      const wait = (ms) => new Promise((res) => later(res, ms));
      function anim(el, frames, opts) {
        if (!el || !el.animate || dead) return null;
        const a = el.animate(frames, opts);
        anims.add(a);
        mine.add(a);
        const done = () => anims.delete(a);
        a.finished.then(done, done);
        return a;
      }
      // Promise version; resolves false if the animation was cancelled.
      function animP(el, frames, opts) {
        const a = anim(el, frames, opts);
        if (!a) return Promise.resolve(true);
        return a.finished.then(() => true, () => false);
      }
      // Cancels this level's Web Animations on el, including finished ones that still hold
      // their end state (fill: "forwards"). CSS animations/transitions are left alone.
      function stopAnims(el) {
        if (!el || !el.getAnimations) return;
        el.getAnimations().forEach((a) => {
          if (mine.has(a)) a.cancel();
        });
      }

      /* ---------- DOM ---------- */
      const wrap = h("div.blur");
      ctx.root.append(wrap);

      if (!total) {
        console.warn("[blur] CONFIG.levels.blur.photos đang trống, bỏ qua màn này.");
        wrap.append(
          h("div.panel.blur-empty", null,
            h("p", { text: "Chưa có ảnh nào cho màn này." }),
            UI.button(T.next || "Tiếp tục", { tone: "mint", iconRight: "arrowRight", onClick: () => ctx.complete() })
          )
        );
        return { destroy() { dead = true; } };
      }

      const chipNum = h("span.blur-chip__num", { text: "1" });
      const chip = h(
        "div.chip.blur-chip",
        { role: "img", "aria-label": "Ảnh 1/" + total },
        h("span.blur-chip__icon", { html: Icons.image, "aria-hidden": "true" }),
        h("span.blur-chip__label", { "aria-hidden": "true" }, "Ảnh ", chipNum, "/" + total)
      );

      const flash = h("div.blur-flash", { "aria-hidden": "true" });
      const shine = h("div.blur-shine", { "aria-hidden": "true" });
      const win = h("div.blur-win");
      const stripText = h("span.blur-strip__text");
      const strip = h("div.blur-strip", null, stripText, h("span.blur-strip__heart", { html: Icons.heartFill, "aria-hidden": "true" }));
      const sparks = [0, 1, 2, 3].map((i) => h("span.blur-spark.blur-spark--" + i, { html: SPARK_SVG, "aria-hidden": "true" }));
      const frame = h("div.blur-frame", null, win, strip, chip, sparks);
      const holder = h("div.blur-holder", null, frame);
      const stage = h("div.blur-stage", null, holder);

      const mascot = Mascot.el("idle", { size: "var(--blur-mascot-size)", bob: true, cls: "blur-mascot" });
      const bubbleText = h("p.blur-bubble__text", { "aria-live": "polite", text: question });
      const bubble = h("div.blur-bubble", null, bubbleText);
      const ask = h("div.blur-ask", null, mascot, bubble);

      const choicesEl = h("div.choices.blur-choices", { role: "group", "aria-label": question });
      const askLayer = h("div.blur-layer.blur-layer--ask", null, choicesEl);
      const doneLayer = h("div.blur-layer.blur-layer--done", { hidden: true });
      const dock = h("div.blur-dock", null, askLayer, doneLayer);

      // .blur-top: "display: contents" (ảnh trên, lời thoại dưới) on tall screens; on short/wide
      // screens it becomes a row so the portrait 9:16 photo keeps its height (see blur.css)
      const top = h("div.blur-top", null, stage, ask);
      wrap.append(top, dock);

      /* ---------- state ---------- */
      let idx = 0;
      let state = "intro"; // intro | ask | revealing | revealed | leaving
      let wrongs = 0;
      let correctIdx = -1; // -1 = chấp nhận mọi đáp án (answer không khớp)
      let busy = false;
      let moodTimer = null;
      let jumpTimer = null;

      const hints = {
        ask: (n) =>
          desktop
            ? "Đoán sai thì ảnh rõ hơn chút · bấm phím " + Array.from({ length: Math.min(n, 9) }, (_, k) => k + 1).join(" ") + " để chọn"
            : "Mỗi lần đoán sai, ảnh sẽ rõ hơn một chút",
        wrong: "Ảnh rõ hơn chút rồi đó, đoán lại nha!",
        revealing: (answered) => (answered ? "Đúng rồi! Ảnh đang rõ dần nè" : "Ảnh đang rõ dần nè"),
        done: (last) =>
          last
            ? desktop ? "Ngắm ảnh xíu rồi bấm Enter để hoàn thành" : "Ngắm ảnh xíu rồi bấm Hoàn thành nha"
            : desktop ? "Ngắm ảnh xíu rồi bấm Enter để đi tiếp" : "Ngắm ảnh xíu rồi đi tiếp nha",
      };

      function mood(m, backAfter) {
        unlater(moodTimer);
        moodTimer = null;
        Mascot.setMood(mascot, m);
        if (backAfter) moodTimer = later(() => Mascot.setMood(mascot, "idle"), backAfter);
      }
      function jump() {
        if (rm) return;
        unlater(jumpTimer);
        replay(mascot, "mascot--jump");
        jumpTimer = later(() => mascot.classList.remove("mascot--jump"), 720);
      }

      // Text swap (transitions-dev: opacity + 4px + 2px blur, 150ms). mid() runs while the text is hidden.
      async function swapText(el, text, mid) {
        if (rm || !el.isConnected) {
          if (mid) mid();
          el.textContent = text;
          return;
        }
        stopAnims(el);
        await animP(el, [{ opacity: 1, transform: "none", filter: "blur(0)" }, { opacity: 0, transform: "translateY(-4px)", filter: "blur(2px)" }], { duration: 150, easing: "ease-in-out", fill: "forwards" });
        if (!live()) return;
        if (mid) mid();
        el.textContent = text;
        stopAnims(el);
        anim(el, [{ opacity: 0, transform: "translateY(4px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 150, easing: "ease-in-out" });
      }

      /* ---------- photo + blur ---------- */
      const media = () => win.querySelector(".blur-img");
      function setBlur(px, instant) {
        const el = media();
        if (!el || el.classList.contains("img-missing")) return;
        const m = Math.round(px * EDGE);
        if (instant) el.classList.add("is-instant");
        el.style.filter = "blur(" + px + "px)";
        el.style.top = -m + "px";
        el.style.left = -m + "px";
        el.style.width = "calc(100% + " + 2 * m + "px)";
        el.style.height = "calc(100% + " + 2 * m + "px)";
        if (instant) {
          void el.offsetWidth;
          el.classList.remove("is-instant");
        }
      }
      // Khung ảnh luôn dọc 9:16 (--ratio trong CSS); ảnh thật 3:4, 2:3, 9:16... được cắt
      // kiểu cover, giữ phần mặt ở khoảng trên giữa (object-position trong CSS).
      function mountPhoto(p, i) {
        const old = win.querySelector("video");
        if (old) old.pause();
        const el = UI.img(p.src, { alt: "Ảnh " + (i + 1) + " đang bị làm mờ", cls: "blur-img" });
        win.replaceChildren(el, flash, shine);
        setBlur(BLUR_STEPS[0], true);
      }

      /* ---------- one round ---------- */
      function makeNextButton(last) {
        return UI.button(last ? "Hoàn thành" : "Ảnh tiếp theo", {
          tone: last ? "mint" : "pink",
          icon: last ? "check" : null,
          iconRight: last ? null : "arrowRight",
          block: true,
          cls: "blur-next",
          onClick: next,
        });
      }

      function render(i) {
        const p = photos[i];
        wrongs = 0;
        busy = false;
        frame.classList.remove("is-revealing", "is-revealed", "is-flash", "is-labeled");
        win.style.removeProperty("--blur-dur");
        mountPhoto(p, i);

        chip.setAttribute("aria-label", "Ảnh " + (i + 1) + "/" + total);
        if (i === 0 || rm) chipNum.textContent = String(i + 1);
        else UI.digits(chipNum, String(i + 1));

        stopAnims(stripText);
        stopAnims(bubbleText);
        stripText.textContent = "? ? ?";
        strip.classList.remove("is-revealed");
        bubbleText.textContent = question;
        mood("idle");

        let opts = p.options.slice();
        if (data.shuffleOptions) opts = shuffle(opts);
        const want = norm(p.answer);
        correctIdx = opts.findIndex((o) => norm(o) === want);
        if (correctIdx < 0 && opts.length) {
          console.warn('[blur] Ảnh ' + (i + 1) + ': "answer" (' + JSON.stringify(p.answer) + ') không khớp đáp án nào trong "options", tạm chấp nhận mọi đáp án.');
        }
        choicesEl.replaceChildren(
          ...opts.map((o, k) =>
            h(
              "button.choice",
              { type: "button", "aria-keyshortcuts": k < 9 ? k + 1 + " " + LETTERS[k] : null, onClick: () => answer(k) },
              h("span.choice__key", { text: LETTERS[k] || String(k + 1) }),
              h("span.choice__text", { text: o })
            )
          )
        );
        doneLayer.replaceChildren(makeNextButton(i === total - 1));
        stopAnims(askLayer);
        stopAnims(doneLayer);
        askLayer.hidden = !opts.length;
        doneLayer.hidden = true;
        ctx.setHint(opts.length ? hints.ask(opts.length) : hints.revealing(false));
        return opts.length;
      }

      async function answer(k) {
        if (state !== "ask" || busy || !live()) return;
        const btn = choicesEl.children[k];
        if (!btn || btn.disabled) return;
        if (correctIdx < 0 || k === correctIdx) return reveal(btn);

        // Sai: giống màn câu đố + ảnh rõ hơn một nấc
        busy = true;
        wrongs++;
        btn.classList.add("is-wrong");
        btn.disabled = true;
        UI.shake(btn);
        Sfx.wrong();
        UI.floatAt(btn, pick(T.wrong) || "Sai mất rồi!", "coral");
        mood("sad", 1500);
        setBlur(BLUR_STEPS[Math.min(wrongs, BLUR_STEPS.length - 1)]);
        if (!rm) {
          anim(holder, [{ transform: "scale(1)" }, { transform: "scale(1.035) rotate(0.6deg)" }, { transform: "scale(1)" }], { duration: 420, easing: EASE_OUT });
        }
        ctx.setHint(hints.wrong);
        // false = hết mạng: engine đã huỷ màn và hiện modal, dừng ngay
        const alive = await ctx.loseLife(btn);
        if (!alive || !live()) return;
        busy = false;
      }

      async function reveal(btn) {
        state = "revealing";
        unlater(moodTimer);
        const p = photos[idx];
        if (btn) {
          [...choicesEl.children].forEach((b) => {
            b.disabled = true;
            if (b !== btn && !b.classList.contains("is-wrong")) b.classList.add("is-dim");
          });
          btn.classList.add("is-correct");
          const key = btn.querySelector(".choice__key");
          if (key) key.innerHTML = Icons.check;
          Sfx.correct();
          Fx.burstAt(btn, { count: 16, shapes: ["heart", "star", "circle"], speed: 6 });
          UI.floatAt(btn, pick(T.correct) || "Đúng rồi!", "mint");
        }
        ctx.setHint(hints.revealing(!!btn));
        mood("wow");
        await wait(rm ? 120 : 300);

        // Ảnh nét dần: blur -> 0 trong ~1s (đường cong đều theo cảm nhận, xem .is-revealing trong CSS)
        win.style.setProperty("--blur-dur", rm ? "450ms" : "1000ms");
        frame.classList.add("is-revealing");
        setBlur(0);
        later(() => {
          frame.classList.add("is-flash");
          Sfx.tone(1568, 0.16, { type: "sine", vol: 0.08 });
          Sfx.tone(2093, 0.28, { type: "sine", vol: 0.06, at: 0.08 });
          Fx.burstAt(win, { count: 22, shapes: ["star", "heart", "circle"], speed: 8, size: [8, 15] });
          if (!rm) {
            anim(holder, [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(0.985)" }, { transform: "scale(1)" }], { duration: 560, easing: "ease-out" });
          }
        }, rm ? 200 : 640);
        await wait(rm ? 480 : 1060);

        const el = media();
        if (el && el.tagName === "IMG") el.alt = p.caption || p.answer || "Ảnh " + (idx + 1);
        frame.classList.add("is-revealed");
        const label = correctIdx >= 0 ? choicesEl.children[correctIdx].querySelector(".choice__text").textContent : btn ? btn.querySelector(".choice__text").textContent : "";
        swapText(bubbleText, p.caption || pick(T.correct) || "Đúng rồi!");
        mood("love");
        jump();
        await swapDock(true);
        if (!live()) return;
        // The strip grew with the dock swap (.is-labeled); now write the answer on it
        swapText(stripText, label || "", () => strip.classList.add("is-revealed"));
        state = "revealed";
        ctx.setHint(hints.done(idx >= total - 1));
        const nb = doneLayer.querySelector(".btn");
        if (nb && desktop) nb.focus({ preventScroll: true });
      }

      // FLIP, position only: el glides from its old box to the spot the new layout gave it
      // (the mascot + bubble move when the dock changes height; no scale, so text stays crisp)
      function slideFrom(el, before) {
        if (rm || !before || !before.width) return;
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        stopAnims(el);
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        anim(el, [{ transform: "translate(" + dx + "px, " + dy + "px)" }, { transform: "none" }], { duration: 480, easing: EASE_OUT });
      }

      // Đổi lớp dưới cùng (đáp án <-> nút đi tiếp); ảnh co giãn mượt theo chỗ trống (FLIP).
      async function swapDock(toDone) {
        const from = toDone ? askLayer : doneLayer;
        const to = toDone ? doneLayer : askLayer;
        if (!from.hidden && !rm) {
          await animP(from, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(0.98)" }], { duration: 200, easing: "ease-in", fill: "forwards" });
          if (!live()) return;
        }
        const before = holder.getBoundingClientRect();
        const askBefore = ask.getBoundingClientRect();
        from.hidden = true;
        stopAnims(from);
        to.hidden = false;
        frame.classList.toggle("is-labeled", toDone);
        const after = holder.getBoundingClientRect();
        if (rm) return;
        slideFrom(ask, askBefore);
        if (before.width && after.width && Math.abs(before.height - after.height) > 1) {
          const s = before.height / after.height;
          const dx = before.left + before.width / 2 - (after.left + after.width / 2);
          const dy = before.top + before.height / 2 - (after.top + after.height / 2);
          anim(holder, [{ transform: "translate(" + dx + "px, " + dy + "px) scale(" + s + ")" }, { transform: "none" }], { duration: 480, easing: EASE_OUT });
        }
        anim(to, [{ opacity: 0, transform: "translateY(16px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 400, easing: EASE_OUT });
      }

      async function next() {
        if (state !== "revealed" || !live()) return;
        state = "leaving";
        // one press only: no second tap sound, no second click from a held key
        const nb = doneLayer.querySelector(".btn");
        if (nb) nb.disabled = true;
        if (idx >= total - 1) {
          ctx.complete();
          return;
        }
        Sfx.whoosh();
        const out = [];
        if (!rm) {
          out.push(animP(holder, [{ transform: "none", opacity: 1 }, { transform: "translate(-118%, 6%) rotate(-16deg)", opacity: 0 }], { duration: 340, easing: "cubic-bezier(0.55, 0, 0.8, 0.2)", fill: "forwards" }));
          out.push(animP(doneLayer, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px)" }], { duration: 200, easing: "ease-in", fill: "forwards" }));
        }
        await Promise.all(out);
        if (!live()) return;
        idx++;
        const askBefore = ask.getBoundingClientRect();
        const hasOptions = render(idx);
        slideFrom(ask, askBefore);
        stopAnims(holder);
        if (!rm) {
          anim(holder, [{ transform: "translate(118%, -4%) rotate(14deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 560, easing: EASE_BOUNCE });
          [...choicesEl.children].forEach((b, k) => {
            anim(b, [{ opacity: 0, transform: "translateY(18px) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: 140 + k * 70, easing: EASE_BOUNCE, fill: "backwards" });
          });
          anim(bubble, [{ transform: "scale(0.9)" }, { transform: "scale(1.04)" }, { transform: "none" }], { duration: 420, delay: 120, easing: EASE_OUT });
        }
        later(() => Sfx.pop(), rm ? 0 : 240);
        state = "ask";
        if (!hasOptions) reveal(null);
      }

      /* ---------- keyboard ---------- */
      function onKey(e) {
        if (!live() || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (UI.activeModal || document.querySelector(".wipe, .countdown")) return;
        const key = e.key;
        if (state === "ask") {
          let n = -1;
          if (/^[1-9]$/.test(key)) n = Number(key) - 1;
          else if (key && key.length === 1) n = LETTERS.indexOf(key.toUpperCase());
          const b = n >= 0 ? choicesEl.children[n] : null;
          if (b && !b.disabled) {
            e.preventDefault();
            replay(b, "blur-kbd");
            later(() => b.classList.remove("blur-kbd"), 140);
            answer(n);
          }
        } else if (state === "revealed" && (key === "Enter" || key === " ")) {
          const nb = doneLayer.querySelector(".btn");
          if (!nb || document.activeElement === nb) return; // nút đang focus: để trình duyệt tự bấm
          e.preventDefault();
          nb.classList.add("is-pressed");
          later(() => {
            nb.classList.remove("is-pressed");
            nb.click();
          }, 110);
        }
      }
      document.addEventListener("keydown", onKey);

      /* ---------- go ---------- */
      const firstHasOptions = render(0);
      ctx.ready.then(() => {
        if (!live()) return;
        state = "ask";
        if (!rm) {
          anim(holder, [{ transform: "rotate(0)" }, { transform: "rotate(-3deg) scale(1.03)" }, { transform: "rotate(2deg)" }, { transform: "none" }], { duration: 620, easing: "ease-in-out" });
          jump();
        }
        if (!firstHasOptions) reveal(null);
      });

      return {
        destroy() {
          dead = true;
          state = "leaving";
          document.removeEventListener("keydown", onKey);
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          anims.forEach((a) => {
            try { a.cancel(); } catch (e) { /* no-op */ }
          });
          anims.clear();
          const v = win.querySelector("video");
          if (v) v.pause();
        },
      };
    },
  };
})();
