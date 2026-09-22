/* =====================================================================
   Màn 4 · Ghép hình (key: puzzle)
   Swap puzzle g x g: chạm 2 mảnh để đổi chỗ, hoặc kéo thả một mảnh lên
   mảnh khác. Bàn phím: mũi tên di chuyển con trỏ, Enter/Space chọn/đổi.
   Bảng là khung DỌC 9:16 (g x g mảnh, mỗi mảnh cũng dọc 9:16). Ảnh được cắt
   kiểu cover bằng CSS, giữ phần trên giữa ảnh (mặt người), không dùng canvas
   nên chạy được qua file://.
   ===================================================================== */
(function () {
  "use strict";
  window.Levels = window.Levels || {};

  const MOVE_MS = 300; // khớp với --pz-move trong puzzle.css
  const TONES = ["var(--pink-200)", "var(--mint-200)", "var(--butter-200)", "var(--lilac-200)", "var(--sky-200)"];

  // Hoán vị ngẫu nhiên: không phải đáp án, tối đa 1 mảnh nằm sẵn đúng chỗ.
  function makeShuffle(n) {
    const base = Array.from({ length: n }, (_, i) => i);
    for (let tries = 0; tries < 400; tries++) {
      const a = Core.shuffle(base);
      let fixed = 0;
      for (let i = 0; i < n; i++) if (a[i] === i) fixed++;
      if (fixed <= 1) return a; // n >= 4 nên fixed <= 1 cũng có nghĩa là chưa giải
    }
    return base.map((_, i) => (i + 1) % n);
  }

  function cssUrl(src) {
    let abs = src;
    try { abs = new URL(src, document.baseURI).href; } catch (e) { /* giữ nguyên */ }
    return 'url("' + String(abs).replace(/["\\]/g, "\\$&") + '")';
  }

  window.Levels.puzzle = {
    assets(data) {
      return data && data.photo ? [data.photo] : [];
    },

    start(ctx) {
      const { h, clamp, replay, pick } = ctx.core;
      const data = ctx.data || {};
      const T = ctx.text || {};
      const g = clamp(parseInt(data.grid, 10) || 3, 2, 6);
      const n = g * g;
      const seconds = Number(data.seconds) > 0 ? Number(data.seconds) : 60;
      const src = data.photo || "";
      const RM = ctx.core.reducedMotion();
      const finePointer = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);

      /* ---------- vòng đời + timers (dọn sạch trong destroy) ---------- */
      let dead = false;
      let playing = false;
      let finished = false;
      const timeouts = new Set();
      const alive = () => !dead && ctx.alive;
      function later(fn, ms) {
        const id = setTimeout(() => {
          timeouts.delete(id);
          if (!dead) fn();
        }, ms);
        timeouts.add(id);
        return id;
      }
      function cancel(id) {
        if (!id) return;
        clearTimeout(id);
        timeouts.delete(id);
      }
      const wait = (ms) => new Promise((res) => later(res, ms));

      /* ---------- DOM ---------- */
      const root = h("div.puzzle", { style: { "--g": g, "--photo": src ? cssUrl(src) : "none" } });

      const refGrid = h("span.puzzle-ref__grid", { "aria-hidden": "true" });
      for (let i = 0; i < n; i++) refGrid.append(h("span", { text: i + 1 }));
      const ref = h(
        "button.puzzle-ref",
        { type: "button", "aria-label": "Ảnh gốc. Giữ để xem ảnh lớn", title: "Giữ để xem ảnh lớn" },
        h("span.puzzle-ref__img", null, refGrid),
        h("span.puzzle-ref__tag.t-stroke-sm", { text: "Ảnh gốc", "aria-hidden": "true" })
      );

      const countN = h("span.puzzle-count__n", { text: "0" });
      const count = h(
        "div.puzzle-count",
        { role: "status", "aria-live": "polite" },
        h("span.puzzle-count__label", { text: "Đúng chỗ" }),
        h("span.puzzle-count__val.t-stroke-sm", null, countN, h("span.puzzle-count__total", { text: "/" + n }))
      );
      const top = h("div.puzzle-top", null, ref, count);

      const grid = h("div.puzzle-grid");
      for (let s = 0; s < n; s++) {
        grid.append(h("span.puzzle-socket", { "aria-hidden": "true", style: { "--c": s % g, "--r": Math.floor(s / g) } }));
      }
      const tiles = [];
      for (let p = 0; p < n; p++) {
        const tile = h(
          "button.puzzle-tile",
          {
            type: "button",
            tabindex: "-1",
            dataset: { piece: p, slot: p },
            style: { "--pc": p % g, "--pr": Math.floor(p / g), "--tone": TONES[p % TONES.length] },
          },
          h("span.puzzle-tile__face", null, h("span.puzzle-tile__img"), h("span.puzzle-tile__num.t-stroke", { text: p + 1, "aria-hidden": "true" }))
        );
        tiles.push(tile);
        grid.append(tile);
      }
      const peekEl = h("div.puzzle-peek", { "aria-hidden": "true" });
      const shine = h("div.puzzle-shine", { "aria-hidden": "true" });
      const tray = h("div.puzzle-tray.is-whole", { role: "group", "aria-label": "Bảng ghép hình " + g + " x " + g }, grid, peekEl, shine);
      const mascotEl = ctx.mascot.el("idle", { size: "100%", bob: !RM });
      const mascotWrap = h("div.puzzle-mascot", { "aria-hidden": "true" }, mascotEl);
      const board = h("div.puzzle-board", null, tray, mascotWrap);

      root.append(top, board);
      ctx.root.append(root);

      /* ---------- trạng thái ---------- */
      const slotPiece = Array.from({ length: n }, (_, i) => i); // ô -> mảnh
      const pieceSlot = slotPiece.slice(); // mảnh -> ô
      const landToken = new Array(n).fill(0);
      const target = makeShuffle(n);
      let selected = -1; // mảnh đang chọn
      let cursor = Math.floor(n / 2); // ô của con trỏ bàn phím
      let cursorOn = false;
      let drag = null;
      let lastKeyAt = 0;
      let peekTimer = 0;

      function place(p, s) {
        pieceSlot[p] = s;
        slotPiece[s] = p;
        const t = tiles[p];
        t.style.setProperty("--c", s % g);
        t.style.setProperty("--r", Math.floor(s / g));
        t.dataset.slot = s;
        t.setAttribute("aria-label", "Mảnh ở hàng " + (Math.floor(s / g) + 1) + ", cột " + ((s % g) + 1));
      }
      for (let p = 0; p < n; p++) place(p, p);

      const isSolved = () => slotPiece.every((p, s) => p === s);
      const correctCount = () => slotPiece.reduce((c, p, s) => c + (p === s ? 1 : 0), 0);

      let shownCount = -1;
      function renderCount(animate, value) {
        const c = value == null ? correctCount() : value;
        if (c === shownCount) return;
        const up = c > shownCount && shownCount >= 0;
        shownCount = c;
        if (animate && !RM) ctx.ui.digits(countN, String(c));
        else countN.textContent = String(c);
        count.classList.toggle("is-full", c === n);
        if (animate && up && !RM) replay(count, "is-bump");
      }
      // Hiện sẵn số mảnh đúng của thế trận sắp xáo (không hiện 9/9 lúc ảnh còn nguyên)
      renderCount(false, target.reduce((c, p, s) => c + (p === s ? 1 : 0), 0));

      /* ---------- mascot ---------- */
      let moodTimer = 0;
      let lowTime = false;
      const baseMood = () => (lowTime ? "wow" : "idle");
      function mood(m, backMs) {
        cancel(moodTimer);
        moodTimer = 0;
        ctx.mascot.setMood(mascotEl, m);
        if (!RM && (m === "happy" || m === "love")) replay(mascotWrap, "is-jump");
        if (backMs) moodTimer = later(() => { moodTimer = 0; if (!finished) ctx.mascot.setMood(mascotEl, baseMood()); }, backMs);
      }

      /* ---------- chọn + con trỏ ---------- */
      function setSelected(p) {
        if (selected >= 0) {
          tiles[selected].classList.remove("is-selected");
          tiles[selected].removeAttribute("aria-pressed");
        }
        selected = p;
        if (p >= 0) {
          tiles[p].classList.add("is-selected");
          tiles[p].setAttribute("aria-pressed", "true");
        }
      }
      function syncCursor() {
        const at = slotPiece[cursor];
        tiles.forEach((t, p) => {
          t.tabIndex = p === at ? 0 : -1;
          t.classList.toggle("is-cursor", cursorOn && p === at);
        });
      }
      function setCursor(s, focus) {
        cursor = clamp(s, 0, n - 1);
        cursorOn = true;
        syncCursor();
        if (focus) {
          try { tiles[slotPiece[cursor]].focus({ preventScroll: true }); } catch (e) { /* no-op */ }
        }
      }
      function hideCursor() {
        if (!cursorOn) return;
        cursorOn = false;
        syncCursor();
      }
      syncCursor();

      /* ---------- đổi chỗ ---------- */
      function popTile(p) {
        const t = tiles[p];
        if (!RM) replay(t, "is-pop");
        ctx.sfx.pop();
        ctx.core.vibrate(14);
        ctx.fx.burstAt(t, {
          count: 10,
          shapes: ["star", "heart", "circle"],
          colors: ["#79E2C3", "#FFD24A", "#FFFFFF", "#FFA3C2"],
          speed: 5,
          size: [7, 12],
        });
        if (!finished) mood("happy", 900);
      }
      function land(list) {
        list.forEach(({ p, token }) => {
          if (landToken[p] !== token) return; // mảnh đã bị dời tiếp trước khi kịp đáp
          tiles[p].classList.remove("is-moving", "is-hop");
          if (pieceSlot[p] === p) popTile(p);
        });
        renderCount(true);
      }
      function swapSlots(a, b, dropped) {
        if (a === b) return;
        const pa = slotPiece[a];
        const pb = slotPiece[b];
        place(pa, b);
        place(pb, a);
        const list = [pa, pb].map((p) => {
          const t = tiles[p];
          t.classList.add("is-moving");
          if (!RM && p !== dropped) replay(t, "is-hop");
          return { p, token: ++landToken[p] };
        });
        ctx.sfx.swap();
        ctx.core.vibrate(8);
        syncCursor();
        later(() => land(list), RM ? 30 : MOVE_MS);
        if (isSolved()) win();
      }
      function tapTile(p) {
        if (!playing) return;
        if (selected < 0) {
          setSelected(p);
          ctx.sfx.tap();
          return;
        }
        if (selected === p) {
          setSelected(-1);
          ctx.sfx.back();
          return;
        }
        const a = pieceSlot[selected];
        const b = pieceSlot[p];
        setSelected(-1);
        swapSlots(a, b);
      }

      /* ---------- kéo thả + chạm (Pointer Events) ---------- */
      // Tìm ô theo toạ độ (không theo phần tử DOM dưới ngón tay): chạm vào khe hở giữa 2 mảnh,
      // vào mảnh đang bay hay mảnh đang phóng to đều trúng đúng ô em nhìn thấy trên bảng.
      function slotAt(x, y, pad) {
        const r = grid.getBoundingClientRect();
        if (pad == null) pad = 14; // cho phép thả hơi lệch ra ngoài mép bảng
        if (!r.width || x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return -1;
        const c = clamp(Math.floor(((x - r.left) / r.width) * g), 0, g - 1);
        const row = clamp(Math.floor(((y - r.top) / r.height) * g), 0, g - 1);
        return row * g + c;
      }
      function setOver(s) {
        if (!drag || drag.over === s) return;
        if (drag.over >= 0) tiles[slotPiece[drag.over]].classList.remove("is-target");
        drag.over = s;
        if (s >= 0) tiles[slotPiece[s]].classList.add("is-target");
      }
      function clearOver() {
        tiles.forEach((t) => t.classList.remove("is-target"));
      }
      function settleHome(p) {
        const t = tiles[p];
        const token = ++landToken[p];
        t.classList.add("is-moving");
        later(() => { if (landToken[p] === token) t.classList.remove("is-moving"); }, RM ? 30 : MOVE_MS);
      }
      function endDrag(d, s) {
        const t = tiles[d.p];
        clearOver();
        t.classList.remove("is-dragging", "is-pressing");
        t.style.setProperty("--dx", "0px");
        t.style.setProperty("--dy", "0px");
        if (d.moved && playing && s >= 0 && s !== pieceSlot[d.p]) {
          swapSlots(pieceSlot[d.p], s, d.p);
        } else if (d.moved) {
          settleHome(d.p);
          ctx.sfx.back();
        }
      }
      function onDown(e) {
        if (!playing || drag) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const s = slotAt(e.clientX, e.clientY, 12);
        if (s < 0) return;
        e.preventDefault();
        if (peekTimer) endPeek(); // đang xem ảnh gốc (chạm nhanh) thì tắt để thấy mảnh mình chọn
        const p = slotPiece[s];
        const tile = tiles[p];
        drag = { p, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, over: -1, slop: e.pointerType === "mouse" ? 5 : 9 };
        try { tile.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        tile.classList.add("is-pressing");
        hideCursor();
      }
      function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        const t = tiles[drag.p];
        if (!drag.moved) {
          if (Math.hypot(dx, dy) < drag.slop) return;
          drag.moved = true;
          if (selected >= 0) setSelected(-1);
          t.classList.remove("is-pressing");
          t.classList.add("is-dragging");
          ctx.sfx.flip();
        }
        e.preventDefault();
        t.style.setProperty("--dx", dx + "px");
        t.style.setProperty("--dy", dy + "px");
        const s = slotAt(e.clientX, e.clientY);
        setOver(s === pieceSlot[drag.p] ? -1 : s);
      }
      function onUp(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        try { tiles[d.p].releasePointerCapture(d.id); } catch (err) { /* no-op */ }
        if (!d.moved) {
          tiles[d.p].classList.remove("is-pressing");
          tapTile(d.p);
          return;
        }
        endDrag(d, slotAt(e.clientX, e.clientY));
      }
      function abortDrag() {
        if (!drag) return;
        const d = drag;
        drag = null;
        try { tiles[d.p].releasePointerCapture(d.id); } catch (err) { /* no-op */ }
        endDrag(d, -1);
      }
      function onCancel(e) {
        if (drag && e.pointerId === drag.id) abortDrag();
      }
      // Click tổng hợp (trình đọc màn hình, detail === 0). Chạm/chuột đã xử lý ở pointerup.
      function onClick(e) {
        const tile = e.target && e.target.closest ? e.target.closest(".puzzle-tile") : null;
        if (!tile || e.detail !== 0 || performance.now() - lastKeyAt < 400) return;
        tapTile(Number(tile.dataset.piece));
      }
      function onFocusIn(e) {
        const tile = e.target && e.target.closest ? e.target.closest(".puzzle-tile") : null;
        if (!tile || !playing) return;
        let visible = false;
        try { visible = tile.matches(":focus-visible"); } catch (err) { visible = false; }
        if (!visible) return;
        cursor = Number(tile.dataset.slot);
        cursorOn = true;
        syncCursor();
      }
      // Nghe trên cả khay (gồm viền trong quanh lưới) để chạm sát mép vẫn trúng mảnh.
      tray.addEventListener("pointerdown", onDown);
      tray.addEventListener("pointermove", onMove);
      tray.addEventListener("pointerup", onUp);
      tray.addEventListener("pointercancel", onCancel);
      tray.addEventListener("lostpointercapture", onCancel);
      grid.addEventListener("click", onClick);
      grid.addEventListener("focusin", onFocusIn);
      // Rời cửa sổ / ẩn tab giữa chừng: thả mảnh về chỗ cũ, tắt xem ảnh gốc, không kẹt trạng thái.
      function onAway() {
        abortDrag();
        endPeek();
      }
      function onVisibility() {
        if (document.hidden) onAway();
        else if (visibleWaiter) {
          const res = visibleWaiter;
          visibleWaiter = null;
          res();
        }
      }
      let visibleWaiter = null;
      const whenVisible = () => (document.hidden ? new Promise((res) => (visibleWaiter = res)) : Promise.resolve());
      window.addEventListener("blur", onAway);
      document.addEventListener("visibilitychange", onVisibility);

      /* ---------- bàn phím ---------- */
      const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      function onKey(e) {
        if (dead || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        if (document.querySelector(".modal-layer")) return;
        const k = e.key;
        if (ARROWS[k]) {
          if (!playing) return;
          e.preventDefault();
          if (peekTimer) endPeek();
          lastKeyAt = performance.now();
          if (!cursorOn) {
            setCursor(selected >= 0 ? pieceSlot[selected] : cursor, true);
            return;
          }
          const [dx, dy] = ARROWS[k];
          const c = clamp((cursor % g) + dx, 0, g - 1);
          const r = clamp(Math.floor(cursor / g) + dy, 0, g - 1);
          const next = r * g + c;
          if (next !== cursor) {
            setCursor(next, true);
            ctx.sfx.tone(820, 0.045, { type: "sine", vol: 0.05, to: 900 });
          }
          return;
        }
        if (k === "Enter" || k === " " || k === "Spacebar") {
          if (!playing) return;
          const t = e.target;
          const inBoard = t && t.closest && t.closest(".puzzle-grid");
          if (!inBoard && t && t !== document.body && t.closest && t.closest("button, a, input, textarea, select, [contenteditable]")) return;
          e.preventDefault();
          lastKeyAt = performance.now();
          if (e.repeat) return;
          if (!cursorOn) {
            setCursor(selected >= 0 ? pieceSlot[selected] : cursor, true);
            return;
          }
          tapTile(slotPiece[cursor]);
          setCursor(cursor, true);
          return;
        }
        if (k === "Escape" && playing && selected >= 0) {
          setSelected(-1);
          ctx.sfx.back();
        }
      }
      document.addEventListener("keydown", onKey);

      /* ---------- xem ảnh gốc (giữ thumbnail) ---------- */
      let missing = !src;
      function peek(on) {
        if (missing && on) return;
        const was = tray.classList.contains("is-peek");
        tray.classList.toggle("is-peek", on);
        ref.classList.toggle("is-peeking", on);
        if (on && !was) ctx.sfx.flip();
      }
      let peekPointer = null;
      function endPeek() {
        cancel(peekTimer);
        peekTimer = 0;
        if (peekPointer != null) {
          try { ref.releasePointerCapture(peekPointer); } catch (err) { /* no-op */ }
          peekPointer = null;
        }
        peek(false);
      }
      let peekDownAt = 0;
      function peekFor(ms) {
        cancel(peekTimer);
        peek(true);
        peekTimer = later(() => {
          peekTimer = 0;
          peek(false);
        }, ms);
      }
      function onRefDown(e) {
        if (finished || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        peekPointer = e.pointerId;
        peekDownAt = performance.now();
        try { ref.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        cancel(peekTimer);
        peekTimer = 0;
        peek(true);
      }
      function onRefUp(e) {
        if (peekPointer == null || e.pointerId !== peekPointer) return;
        peekPointer = null;
        try { ref.releasePointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        // Chạm nhanh (không giữ) thì vẫn cho xem ảnh thêm một lúc, không chỉ loé lên rồi tắt.
        const held = performance.now() - peekDownAt;
        if (e.type === "pointerup" && held < 380 && !missing && !finished) peekFor(1150 - held);
        else peek(false);
      }
      function onRefClick(e) {
        if (e.detail !== 0 || finished) return; // chuột/chạm đã xử lý bằng pointer
        peekFor(1400);
      }
      ref.addEventListener("pointerdown", onRefDown);
      ref.addEventListener("pointerup", onRefUp);
      ref.addEventListener("pointercancel", onRefUp);
      ref.addEventListener("lostpointercapture", onRefUp);
      ref.addEventListener("click", onRefClick);

      /* ---------- ảnh thiếu: vẫn chơi được bằng số ---------- */
      const HINT = finePointer
        ? "Bấm 2 mảnh để đổi chỗ, kéo thả hoặc dùng phím mũi tên"
        : "Chạm 2 mảnh để đổi chỗ, hoặc kéo thả";
      // Chỉ hiện tên file (rút gọn) ở dòng gợi ý: đường dẫn dài sẽ làm dòng gợi ý
      // xuống 3 dòng và bóp nhỏ bảng trên điện thoại nhỏ. Đường dẫn đầy đủ nằm ở title.
      function shortName(path) {
        const base = String(path).split(/[?#]/)[0].split("/").pop() || String(path);
        return base.length > 26 ? base.slice(0, 12) + "…" + base.slice(-11) : base;
      }
      function applyMissing() {
        if (dead) return;
        missing = true;
        endPeek();
        root.classList.add("is-missing");
        const msg = T.missingImage || "Không tìm thấy ảnh";
        ref.setAttribute("aria-label", msg);
        ref.title = msg + (src ? ": " + src : "");
        ctx.setHint(msg + (src ? " " + shortName(src) : "") + ". Xếp số từ 1 đến " + n + " nha!");
      }
      ctx.setHint(HINT);
      if (!src) applyMissing();
      else ctx.core.loadImage(src).then((ok) => { if (!ok && !dead) applyMissing(); });

      /* ---------- thắng ---------- */
      function jingle() {
        ctx.sfx.match();
        ctx.sfx.tone(1568, 0.4, { type: "sine", vol: 0.06, at: 0.24 });
        ctx.sfx.tone(2093, 0.35, { type: "sine", vol: 0.04, at: 0.32 });
      }
      async function win() {
        if (finished || dead) return;
        finished = true;
        playing = false;
        timer.stop();
        abortDrag();
        setSelected(-1);
        hideCursor();
        endPeek();
        board.classList.remove("is-playing");
        const ae = document.activeElement;
        if (ae && root.contains(ae)) ae.blur();
        await wait(RM ? 40 : MOVE_MS + 40); // chờ mảnh cuối đáp xuống
        tray.classList.add("is-whole");
        board.classList.add("is-solved");
        mood("love");
        renderCount(true);
        await wait(RM ? 40 : 360); // khe hở khép lại
        if (!RM) replay(shine, "is-on");
        ctx.fx.burstAt(tray, { count: 34, shapes: ["heart", "star", "circle"], speed: 10, size: [9, 17] });
        jingle();
        const tr = tray.getBoundingClientRect();
        const fl = ctx.ui.float(pick(T.correct) || "Giỏi quá!", tr.left + tr.width / 2, tr.top + tr.height * 0.18, "mint");
        if (fl && fl.classList) fl.classList.add("puzzle-float"); // câu dài thì xuống dòng, không tràn màn hình
        await wait(RM ? 450 : 650);
        if (alive()) ctx.complete();
      }

      /* ---------- đồng hồ + bắt đầu ---------- */
      const timer = ctx.timer({
        seconds,
        onTick(sec) {
          const low = sec <= 10 && sec > 0;
          if (low !== lowTime) {
            lowTime = low;
            if (!moodTimer && !finished && playing) ctx.mascot.setMood(mascotEl, baseMood());
          }
        },
        onEnd() {
          if (finished || dead) return;
          finished = true;
          playing = false;
          abortDrag();
          setSelected(-1);
          hideCursor();
          board.classList.remove("is-playing");
          mood("sad");
          ctx.fail("timeout");
        },
      });

      (async () => {
        await ctx.ready;
        if (!alive() || finished) return;
        await wait(RM ? 120 : 420); // cho em nhìn ảnh nguyên vẹn một chút
        if (!alive() || finished) return;
        tray.classList.remove("is-whole"); // tách thành từng mảnh
        ctx.sfx.pop();
        await wait(RM ? 40 : 320);
        if (!alive() || finished) return;
        target.forEach((p, s) => {
          if (!RM) tiles[p].style.setProperty("--delay", p * 24 + "ms"); // bay đi theo thứ tự đọc
          tiles[p].classList.add("is-moving");
          place(p, s);
        });
        syncCursor();
        ctx.sfx.whoosh();
        await wait(RM ? 40 : MOVE_MS + n * 24 + 120);
        tiles.forEach((t) => {
          t.style.removeProperty("--delay");
          t.classList.remove("is-moving");
        });
        if (!alive() || finished) return;
        renderCount(true);
        await ctx.countdown();
        if (!alive() || finished) return;
        // Em chuyển app/tab lúc đang đếm ngược: chỉ bắt đầu tính giờ khi quay lại,
        // nếu không đồng hồ sẽ trừ luôn khoảng thời gian tab bị ẩn.
        await whenVisible();
        if (!alive() || finished) return;
        playing = true;
        board.classList.add("is-playing");
        timer.start();
      })();

      /* ---------- API cho engine + QA ---------- */
      return {
        destroy() {
          dead = true;
          playing = false;
          timeouts.forEach((id) => clearTimeout(id));
          timeouts.clear();
          if (drag) {
            try { tiles[drag.p].releasePointerCapture(drag.id); } catch (err) { /* no-op */ }
            drag = null;
          }
          if (peekPointer != null) {
            try { ref.releasePointerCapture(peekPointer); } catch (err) { /* no-op */ }
            peekPointer = null;
          }
          visibleWaiter = null;
          document.removeEventListener("keydown", onKey);
          document.removeEventListener("visibilitychange", onVisibility);
          window.removeEventListener("blur", onAway);
          tray.removeEventListener("pointerdown", onDown);
          tray.removeEventListener("pointermove", onMove);
          tray.removeEventListener("pointerup", onUp);
          tray.removeEventListener("pointercancel", onCancel);
          tray.removeEventListener("lostpointercapture", onCancel);
          grid.removeEventListener("click", onClick);
          grid.removeEventListener("focusin", onFocusIn);
          ref.removeEventListener("pointerdown", onRefDown);
          ref.removeEventListener("pointerup", onRefUp);
          ref.removeEventListener("pointercancel", onRefUp);
          ref.removeEventListener("lostpointercapture", onRefUp);
          ref.removeEventListener("click", onRefClick);
        },
        debug: {
          // Đưa mọi mảnh về đúng chỗ bằng các lượt đổi thật, rồi chạy hiệu ứng thắng.
          solve() {
            if (dead || finished) return false;
            abortDrag();
            setSelected(-1);
            for (let s = 0; s < n; s++) {
              if (slotPiece[s] === s) continue;
              const from = pieceSlot[s];
              const other = slotPiece[s];
              place(s, s);
              place(other, from);
              [s, other].forEach((p) => {
                tiles[p].classList.add("is-moving");
                const token = ++landToken[p];
                later(() => { if (landToken[p] === token) tiles[p].classList.remove("is-moving"); }, RM ? 30 : MOVE_MS);
              });
            }
            syncCursor();
            ctx.sfx.swap();
            win();
            return true;
          },
          swap(a, b) {
            if (!playing) return false;
            swapSlots(a, b);
            return true;
          },
          state() {
            return { slots: slotPiece.slice(), playing, finished, selected, cursor: cursorOn ? cursor : -1, correct: correctCount() };
          },
        },
      };
    },
  };
})();
