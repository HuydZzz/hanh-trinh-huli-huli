/* =====================================================================
   Màn 1 · Câu đố kỉ niệm (key: quiz)
   Mỗi lần 1 câu hỏi. Sai: mất 1 mạng, trả lời lại câu đó. Đúng: sang câu
   tiếp (hoặc hiện lời nhắn "note" nếu có). Không có đồng hồ.
   Bàn phím: 1-4 hoặc A-D để chọn, Enter để đi tiếp khi đang xem lời nhắn.
   Tab + Enter/Space cũng chơi được (focus tự đi theo người chơi).
   ===================================================================== */
(function () {
  "use strict";
  window.Levels = window.Levels || {};

  const LETTERS = "ABCDEFGHIJ";
  const HEART_COLORS = ["#FF7FA8", "#FFA3C2", "#79E2C3", "#4DD0AB", "#FFFFFF"];
  // Khoá chạm ngắn khi câu mới đang trượt vào (đáp án còn mờ, chạm nhầm sẽ mất mạng oan)
  const ENTER_LOCK = 320;

  // So khớp "gần đúng" (khác hoa thường, dấu cách, chuẩn Unicode NFC/NFD)
  const norm = (s) =>
    String(s == null ? "" : s)
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  // Chuẩn hoá dữ liệu câu hỏi, không bao giờ để em bị kẹt vì lỗi gõ trong config.
  function prepare(data, shuffle) {
    const list = Array.isArray(data && data.questions) ? data.questions : [];
    const out = [];
    list.forEach((raw, i) => {
      if (!raw) return;
      const options = (Array.isArray(raw.options) ? raw.options : [])
        .map((o) => (o == null ? "" : String(o)))
        .filter((o) => o.trim() !== "");
      if (!options.length) {
        console.warn(`[quiz] Câu ${i + 1} không có đáp án nào trong "options", bỏ qua câu này.`);
        return;
      }
      let answer = raw.answer == null ? "" : String(raw.answer);
      let anyOk = false;
      if (!options.includes(answer)) {
        const loose = options.filter((o) => norm(o) === norm(answer));
        if (norm(answer) && loose.length) {
          console.warn(`[quiz] Câu ${i + 1}: "answer" (${answer}) không giống Y HỆT đáp án nào, tạm dùng "${loose[0]}".`);
          answer = loose[0];
        } else {
          console.warn(`[quiz] Câu ${i + 1}: "answer" (${answer}) không khớp đáp án nào trong "options", chấp nhận mọi đáp án.`);
          anyOk = true;
        }
      }
      out.push({
        q: String(raw.q == null ? "" : raw.q),
        options: shuffle ? Core.shuffle(options) : options.slice(),
        answer,
        anyOk,
        note: raw.note == null ? "" : String(raw.note).trim(),
      });
    });
    return out;
  }

  window.Levels.quiz = {
    assets() {
      return [];
    },

    start(ctx) {
      const { h, pick, sleep, reducedMotion, replay } = ctx.core;
      const UI = ctx.ui;
      const Sfx = ctx.sfx;
      const Fx = ctx.fx;
      const Mascot = ctx.mascot;
      const Icons = ctx.icons;
      const T = ctx.text || {};
      const data = ctx.data || {};

      const Q = prepare(data, !!data.shuffleOptions);
      const total = Q.length;
      const fine = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);

      /* ---------- lifecycle bookkeeping ---------- */
      let dead = false;
      const timers = new Set();
      function later(fn, ms) {
        const id = setTimeout(() => {
          timers.delete(id);
          if (!dead && ctx.alive) fn();
        }, ms);
        timers.add(id);
        return id;
      }
      function wait(ms) {
        return new Promise((res) => later(res, ms));
      }
      const gone = () => dead || !ctx.alive;

      /* ---------- state ---------- */
      let qi = 0;
      let phase = "ask"; // ask | enter | wrong | done | note | switch | end
      let page = null;
      let stage = null;
      let buttons = [];
      let nextBtn = null;
      let moodTimer = 0;
      let isReady = false; // phím chỉ nhận sau khi hiệu ứng chuyển cảnh xong
      let kbNav = false; // đang chơi bằng Tab + Enter/Space (giữ focus cho người dùng bàn phím)
      let mood = "idle";
      let artFailed = false;

      /* ---------- static chrome ---------- */
      const chipNum = h("span.quiz-chip__n", { text: "1" });
      const chip = h("span.chip.quiz-chip", null, "Câu ", chipNum, h("span.quiz-chip__of", { text: "/" + Math.max(1, total) }));
      // Nhiều câu thì chấm nhỏ lại, quá nhiều thì chỉ để chip "Câu x/y" để không đè lên linh vật
      const dots = h("div.quiz-dots" + (total > 5 ? ".is-compact" : ""), { role: "img", hidden: total > 8 });
      const dotEls = [];
      for (let i = 0; i < total; i++) {
        const d = h("span.quiz-dot", { html: Icons.check });
        dots.append(d);
        dotEls.push(d);
      }
      const mascot = Mascot.el("idle", { size: "var(--quiz-mascot)", cls: "quiz-mascot" });
      // Ảnh linh vật tự vẽ (CONFIG.art.mascot) bị thiếu: quay về linh vật SVG mặc định thay vì icon ảnh vỡ
      const artImg = mascot.querySelector("img");
      if (artImg) {
        artImg.addEventListener("error", () => {
          if (dead) return;
          artFailed = true;
          mascot.innerHTML = Mascot.svg(mood);
        }, { once: true });
      }
      const mascotWrap = h("div.quiz-mascot-wrap.mascot--bob", { "aria-hidden": "true" }, mascot);
      const top = h("div.quiz-top", null, h("div.quiz-progress", null, chip, dots), mascotWrap);
      const scroller = h("div.quiz-scroll");
      // Đọc câu hỏi cho trình đọc màn hình (vùng live cố định, không bị thay mỗi câu)
      const live = h("p.sr-only", { "aria-live": "polite" });
      const root = h("div.quiz", null, top, scroller, live);
      ctx.root.append(root);
      Promise.resolve(ctx.ready).then(() => { isReady = true; });

      function setHint(kind) {
        if (kind === "note") {
          ctx.setHint(fine ? "Nhấn Enter để đi tiếp nha" : "Đọc lời nhắn rồi đi tiếp nha");
          return;
        }
        const q = Q[qi];
        const n = q ? Math.min(q.options.length, 9) : 4;
        const keys = n > 1 ? `${LETTERS[0]}-${LETTERS[n - 1]} hoặc 1-${n}` : "A hoặc 1";
        ctx.setHint(fine ? `Chọn đáp án đúng nha · bấm phím ${keys} cũng được` : "Chọn đáp án đúng nha");
      }

      function applyMood(m) {
        mood = m;
        if (artFailed) {
          const g = mascot.querySelector(".m-face");
          const tmp = document.createElement("div");
          tmp.innerHTML = Mascot.svg(m);
          const ng = tmp.querySelector(".m-face");
          if (g && ng) g.replaceWith(ng);
          mascot.dataset.mood = m;
        } else {
          Mascot.setMood(mascot, m);
        }
      }
      function setMood(m, ms) {
        applyMood(m);
        clearTimeout(moodTimer);
        timers.delete(moodTimer);
        if (ms) {
          moodTimer = later(() => applyMood("idle"), ms);
        }
      }

      // Nhảy 1 cái rồi gỡ class, để lần rung (UI.shake) sau không kích hoạt lại cú nhảy
      let jumpTimer = 0;
      function jump() {
        if (reducedMotion()) return;
        replay(mascot, "mascot--jump");
        clearTimeout(jumpTimer);
        timers.delete(jumpTimer);
        jumpTimer = later(() => mascot.classList.remove("mascot--jump"), 760);
      }

      function updateDots(current) {
        dotEls.forEach((d, i) => {
          d.classList.toggle("is-done", i < current);
          d.classList.toggle("is-current", i === current);
        });
        dots.setAttribute("aria-label", `Đã xong ${Math.min(current, total)}/${total} câu`);
      }

      /* ---------- one question ---------- */
      function keyLabel(b, state) {
        const base = `${b.dataset.letter}. ${b.dataset.text}`;
        b.setAttribute("aria-label", state ? `${base} (${state})` : base);
      }

      function buildPage(i) {
        const q = Q[i];
        const card = h(
          "div.panel.panel--white.quiz-card",
          null,
          h("span.quiz-card__badge", { html: ctx.badges.quiz, "aria-hidden": "true" }),
          h("p.quiz-q", { text: q.q })
        );
        const list = h("div.choices.quiz-choices", { role: "group", "aria-label": "Các đáp án" });
        buttons = q.options.map((opt, k) => {
          const letter = LETTERS[k] || String(k + 1);
          const b = h(
            "button.choice",
            { type: "button", style: { "--i": k }, dataset: { letter, text: opt, idx: k } },
            h("span.choice__key", { text: letter, "aria-hidden": "true" }),
            h("span.choice__text", { text: opt })
          );
          keyLabel(b);
          list.append(b);
          return b;
        });
        stage = h("div.quiz-stage", null, list);
        return h("div.quiz-page", null, card, stage);
      }

      function focusFirstChoice() {
        if (!kbNav || UI.activeModal) return;
        const b = buttons.find((x) => !x.disabled);
        if (b) {
          try { b.focus(); } catch (e) { /* no-op */ }
        }
      }

      function render(i, animate) {
        const rm = reducedMotion();
        const slide = animate && !rm;
        const topY0 = slide ? top.getBoundingClientRect().top : 0;
        qi = i;
        phase = slide ? "enter" : "ask";
        nextBtn = null;
        const p = buildPage(i);
        scroller.replaceChildren(p);
        scroller.scrollTop = 0;
        page = p;
        updateDots(i);
        if (i === 0) chipNum.textContent = "1";
        else UI.digits(chipNum, String(i + 1));
        live.textContent = `Câu ${i + 1}/${total}. ${Q[i].q}`;
        setHint("ask");
        setMood("idle");
        watchSize();
        updateFade();
        if (slide) {
          // Cả nhóm được căn giữa theo chiều dọc, câu mới cao/thấp hơn làm hàng tiến độ nhảy:
          // FLIP cho hàng tiến độ + linh vật trượt êm tới vị trí mới
          const dy = topY0 - top.getBoundingClientRect().top;
          if (Math.abs(dy) > 1) {
            top.style.transition = "none";
            top.style.transform = `translateY(${dy}px)`;
            void top.offsetWidth;
            top.style.transition = "transform 420ms var(--ease-out)";
            top.style.transform = "";
            later(() => { top.style.transition = ""; }, 440);
          }
          p.classList.add("is-in");
          later(() => p.classList.remove("is-in"), 700);
          later(() => {
            if (phase === "enter") phase = "ask";
            focusFirstChoice();
          }, ENTER_LOCK);
        } else if (animate) {
          focusFirstChoice();
        }
      }

      /* ---------- answering ---------- */
      function setKeyIcon(b, which) {
        const key = b.querySelector(".choice__key");
        if (!key) return;
        if (which === "check") {
          const c = UI.successCheck("quiz-check");
          key.replaceChildren(c);
          c.show();
        } else {
          key.innerHTML = Icons.x;
          replay(key, "quiz-key-pop");
        }
      }

      // kb = bấm bằng Enter/Space khi nút đang được focus (người chơi dùng Tab)
      async function choose(idx, kb) {
        if (gone() || phase !== "ask") return;
        const b = buttons[idx];
        if (!b || b.disabled) return;
        if (page) page.classList.remove("is-in", "is-hello");
        if (kb) kbNav = true;
        const q = Q[qi];
        const text = b.dataset.text;
        const ok = q.anyOk || text === q.answer;
        if (ok) return correct(b);

        // Sai: đánh dấu, rung, trừ mạng, trả lời tiếp câu này
        phase = "wrong";
        b.disabled = true;
        // Nút bị vô hiệu thì mất focus: chuyển focus sang đáp án kế tiếp cho người dùng bàn phím
        if (kb) {
          const rest = buttons.slice(idx + 1).concat(buttons.slice(0, idx)).find((x) => !x.disabled);
          if (rest) {
            try { rest.focus(); } catch (e) { /* no-op */ }
          }
        }
        b.classList.add("is-wrong");
        keyLabel(b, "sai");
        setKeyIcon(b, "x");
        UI.shake(b);
        Sfx.wrong();
        UI.floatAt(b, pick(T.wrong || ["Sai mất rồi!"]), "coral");
        setMood("sad", 1100);
        mascot.classList.remove("mascot--jump");
        UI.shake(mascot);
        const alive = await ctx.loseLife();
        if (!alive || gone()) return; // hết mạng: engine lo phần còn lại
        await wait(180);
        if (gone()) return;
        if (phase === "wrong") phase = "ask";
      }

      function correct(b) {
        phase = "done";
        b.classList.add("is-correct");
        keyLabel(b, "đúng");
        setKeyIcon(b, "check");
        buttons.forEach((x) => {
          x.disabled = true;
          if (x !== b) x.classList.add("is-dim");
        });
        if (!reducedMotion()) replay(b, "quiz-pop");
        Sfx.correct();
        Fx.burstAt(b, { count: 20, shapes: ["heart", "heart", "star", "circle"], colors: HEART_COLORS, speed: 7.5, size: [9, 17] });
        UI.floatAt(b, pick(T.correct || ["Đúng rồi!"]), "mint");
        setMood("happy");
        jump();
        const d = dotEls[qi];
        if (d) {
          d.classList.remove("is-current");
          d.classList.add("is-done");
          if (!reducedMotion()) replay(d, "quiz-dot-pop");
        }
        dots.setAttribute("aria-label", `Đã xong ${qi + 1}/${total} câu`);
        const q = Q[qi];
        live.textContent = `${b.dataset.text}: đúng rồi!`;
        if (q.note) later(() => showNote(b), 750);
        else later(advance, 1050);
      }

      /* ---------- lời nhắn sau câu đúng ---------- */
      async function showNote(b) {
        if (gone() || phase !== "done") return;
        phase = "switch";
        const rm = reducedMotion();
        const others = buttons.filter((x) => x !== b);
        if (!rm) {
          others.forEach((x) => x.classList.add("quiz-fade"));
          await wait(190);
          if (gone()) return;
        }
        const last = qi === total - 1;
        const firstTop = b.getBoundingClientRect().top;
        const h0 = stage.offsetHeight;

        nextBtn = UI.button(last ? "Hoàn thành" : "Câu tiếp theo", {
          tone: last ? "mint" : "pink",
          iconRight: last ? "check" : "arrowRight",
          block: true,
          cls: "quiz-next",
          // Tự phát tiếng để lần bấm thứ 2 (Enter/chạm đúp) không kêu 2 lần
          sound: false,
          onClick: () => {
            if (gone() || phase !== "note") return;
            Sfx.tap();
            advance();
          },
        });
        const note = h(
          "div.quiz-note",
          null,
          h(
            "div.quiz-bubble",
            null,
            h("span.quiz-bubble__heart", { html: Icons.heartFill, "aria-hidden": "true" }),
            h("p.quiz-bubble__text", { text: Q[qi].note })
          ),
          nextBtn
        );
        others.forEach((x) => x.remove());
        stage.append(note);

        if (!rm) {
          // Card resize: khung đáp án co giãn mượt sang chiều cao mới.
          // Giữ chiều cao cũ TRƯỚC khi đo FLIP, nếu không cả nhóm (căn giữa) đã dời chỗ
          // và đáp án đúng bị giật ~25px ở khung hình đầu.
          const h1 = stage.offsetHeight;
          stage.style.transition = "none";
          stage.style.height = h0 + "px";
          // FLIP: đáp án đúng trượt lên vị trí mới
          const dy = firstTop - b.getBoundingClientRect().top;
          if (Math.abs(dy) > 1) {
            b.style.transition = "none";
            b.style.transform = `translateY(${dy}px)`;
          }
          void stage.offsetHeight;
          if (Math.abs(dy) > 1) {
            b.style.transition = "transform 420ms var(--ease-bounce)";
            b.style.transform = "";
          }
          stage.style.transition = "height var(--resize-dur) var(--resize-ease)";
          stage.style.height = h1 + "px";
          note.classList.add("is-in");
          later(() => {
            stage.style.height = "";
            stage.style.transition = "";
            b.style.transition = "";
          }, 460);
        }
        setMood("love");
        jump();
        Sfx.pop();
        phase = "note";
        setHint("note");
        live.textContent = Q[qi].note;
        later(() => {
          revealNote(note, rm);
          // Chỉ focus trên máy tính hoặc khi đang dùng Tab (điện thoại không có bàn phím, tránh viền focus)
          if ((fine || kbNav) && nextBtn && document.contains(nextBtn) && !UI.activeModal) {
            try { nextBtn.focus({ preventScroll: true }); } catch (e) { /* no-op */ }
          }
        }, rm ? 30 : 480);
      }

      // Nếu màn hình thấp, cuộn vừa đủ để thấy nút đi tiếp
      function revealNote(note, rm) {
        const sr = scroller.getBoundingClientRect();
        const nr = note.getBoundingClientRect();
        const over = nr.bottom - sr.bottom + 10;
        if (over > 0) scroller.scrollTo({ top: scroller.scrollTop + over, behavior: rm ? "auto" : "smooth" });
        updateFade();
      }

      // Viền mờ trên/dưới khi vùng câu hỏi có thể cuộn (câu hỏi quá dài, màn hình thấp)
      function updateFade() {
        if (dead) return;
        const max = scroller.scrollHeight - scroller.clientHeight;
        scroller.classList.toggle("is-fade-top", max > 1 && scroller.scrollTop > 2);
        scroller.classList.toggle("is-fade-bottom", max > 1 && max - scroller.scrollTop > 2);
      }
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => updateFade()) : null;
      function watchSize() {
        if (!ro) return;
        ro.disconnect();
        ro.observe(scroller);
        if (page) ro.observe(page);
      }

      async function advance() {
        if (gone() || (phase !== "done" && phase !== "note")) return;
        // Bỏ focus khỏi nút đi tiếp: Enter lần 2 sẽ không "bấm" lại nút đang trượt ra
        if (nextBtn && document.activeElement === nextBtn) nextBtn.blur();
        if (qi >= total - 1) {
          phase = "end";
          ctx.complete();
          return;
        }
        phase = "switch";
        if (!reducedMotion() && page) {
          page.classList.remove("is-in");
          page.classList.add("is-out");
          Sfx.flip();
          await wait(200);
          if (gone()) return;
        }
        render(qi + 1, true);
      }

      /* ---------- input ---------- */
      function onClick(e) {
        const b = e.target.closest && e.target.closest(".choice");
        if (!b || !scroller.contains(b)) return;
        // detail 0 + đang focus = kích hoạt bằng Enter/Space (không phải chuột/chạm)
        choose(+b.dataset.idx, e.detail === 0 && document.activeElement === b);
      }
      // Hiệu ứng "lún" ngay khi chạm (iOS không áp :active nếu không có listener cảm ứng)
      function onDown(e) {
        kbNav = false;
        const b = e.target.closest && e.target.closest(".choice");
        if (!b || b.disabled || phase !== "ask") return;
        b.classList.add("quiz-press");
      }
      function onUp() {
        buttons.forEach((b) => b.classList.remove("quiz-press"));
      }
      function onKey(e) {
        if (gone() || !isReady || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat || e.isComposing) return;
        if (UI.activeModal) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""))) return;
        if (phase === "note") {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (t === nextBtn) return; // nút đang focus: để trình duyệt tự bấm
          e.preventDefault();
          if (nextBtn) {
            nextBtn.classList.add("is-pressed");
            later(() => nextBtn && nextBtn.classList.remove("is-pressed"), 110);
            nextBtn.click();
          }
          return;
        }
        if (phase !== "ask" || !e.key || e.key.length !== 1) return;
        let idx = -1;
        if (/^[1-9]$/.test(e.key)) idx = +e.key - 1;
        else idx = LETTERS.indexOf(e.key.toUpperCase());
        if (idx < 0 || idx >= buttons.length) return;
        e.preventDefault();
        const b = buttons[idx];
        if (b.disabled) return;
        if (!reducedMotion()) {
          b.classList.add("quiz-press");
          later(() => b.classList.remove("quiz-press"), 110);
        }
        choose(idx);
      }

      // iOS Safari chỉ áp :active (nút "Câu tiếp theo" lún xuống) khi có listener touchstart
      const noop = () => {};
      root.addEventListener("touchstart", noop, { passive: true });
      scroller.addEventListener("click", onClick);
      scroller.addEventListener("scroll", updateFade, { passive: true });
      scroller.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      scroller.addEventListener("pointerleave", onUp);
      document.addEventListener("keydown", onKey);

      /* ---------- go ---------- */
      if (!total) {
        console.warn("[quiz] Không có câu hỏi hợp lệ nào, tự qua màn.");
        root.classList.add("is-empty");
        ctx.setHint("");
        Promise.resolve(ctx.ready).then(() => sleep(400)).then(() => {
          if (!gone()) ctx.complete();
        });
      } else {
        render(0, false);
        // Câu 1 đã hiện sẵn dưới hiệu ứng chuyển cảnh, nên chỉ "chào" nhẹ (không ẩn nội dung)
        Promise.resolve(ctx.ready).then(() => {
          if (gone() || !page || phase !== "ask" || qi !== 0 || reducedMotion()) return;
          const p = page;
          p.classList.add("is-hello");
          jump();
          later(() => p.classList.remove("is-hello"), 900);
        });
      }

      return {
        destroy() {
          dead = true;
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          clearTimeout(moodTimer);
          scroller.removeEventListener("click", onClick);
          scroller.removeEventListener("scroll", updateFade);
          if (ro) ro.disconnect();
          root.removeEventListener("touchstart", noop);
          scroller.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          scroller.removeEventListener("pointerleave", onUp);
          document.removeEventListener("keydown", onKey);
          buttons = [];
          nextBtn = null;
        },
      };
    },
  };
})();
