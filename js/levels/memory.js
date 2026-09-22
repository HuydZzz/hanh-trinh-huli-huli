/* =====================================================================
   Màn 3 · Lật thẻ (key: memory)
   20 thẻ dọc 9:16 úp sẵn (10 cặp ảnh). Mỗi lượt lật 2 thẻ:
   - giống nhau: cặp đó sáng mint một nhịp rồi "bụp" biến mất khỏi bàn.
     Ô của 2 thẻ đó để trống (viền nét đứt mờ), các thẻ khác KHÔNG dời chỗ;
   - khác nhau: úp lại. Lật sai KHÔNG mất mạng, chỉ hết giờ mới mất mạng.
   Dọn sạch bàn (hết thẻ) là thắng.
   Bố cục: 4 cột x 5 hàng hoặc 5 x 4, hàng mascot + chip đếm cặp nằm trên
   bàn thẻ hoặc bên trái (khi vùng chơi thấp mà còn dư bề ngang). JS thử
   từng cách và giữ cách cho thẻ to nhất, đo lại mỗi khi đổi kích thước
   (xem chooseLayout). Kích thước thẻ tính bằng cqw/cqh trong memory.css.
   Bàn phím: Tab / phím mũi tên để chọn thẻ (bỏ qua ô trống), Enter hoặc
   Space để lật.
   Trong lúc đang so 2 thẻ không lật thêm được, nhưng lượt chạm (tối đa 2)
   được nhớ lại và lật ngay khi so xong, nên chơi nhanh không bị "nuốt" chạm.
   Cặp vừa ghép đang sáng / đang biến mất không chặn lượt tiếp theo.
   ===================================================================== */
(function () {
  "use strict";
  window.Levels = window.Levels || {};

  const FLIP_MS = 380; // khớp --memory-flip-dur trong memory.css (+ một chút)
  const PEEK_MS = 700; // 2 thẻ khác nhau mở bao lâu (tính từ lúc lật thẻ thứ 2)
  const BEAT_MS = 450; // cặp đúng sáng mint bao lâu trước khi biến mất
  const VANISH_MS = 420; // khớp animation memory-vanish trong memory.css
  const HINT = "Lật 2 thẻ giống nhau, trúng thì cặp đó biến mất";
  const BURST_COLORS = ["#FF7FA8", "#FFA3C2", "#79E2C3", "#4DD0AB", "#FFFFFF"];

  // Trái tim trắng viền mực ở mặt sau thẻ
  const heartSVG = (path) =>
    '<svg class="memory-card__heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    `<path class="memory-heart__body" d="${path}"/>` +
    '<ellipse class="memory-heart__shine" cx="7.4" cy="7.8" rx="1.9" ry="1.05" transform="rotate(-38 7.4 7.8)"/></svg>';

  const photoList = (data) => (Array.isArray(data && data.photos) ? data.photos : []).filter((p) => p != null);

  window.Levels.memory = {
    assets(data, config) {
      const list = photoList(data).slice();
      const back = config && config.art && config.art.cardBack;
      if (back) list.push(back);
      return list;
    },

    start(ctx) {
      const { h, shuffle, replay, reducedMotion, pick, rand } = ctx.core;
      const UI = ctx.ui;
      const Sfx = ctx.sfx;
      const Fx = ctx.fx;
      const data = ctx.data || {};
      const text = ctx.text || {};
      const photos = photoList(data);
      const pairs = photos.length;
      const seconds = Number(data.seconds) > 0 ? Number(data.seconds) : 60;
      const cardBack = (ctx.config && ctx.config.art && ctx.config.art.cardBack) || "";
      const rm = reducedMotion();

      /* ---------- timers (dọn sạch trong destroy) ---------- */
      let dead = false;
      const timeouts = new Set();
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          timeouts.delete(id);
          if (!dead) fn();
        }, ms);
        timeouts.add(id);
        return id;
      };
      const wait = (ms) => new Promise((res) => later(res, ms));
      const alive = () => !dead && ctx.alive;

      /* ---------- state ---------- */
      let playing = false;
      let finished = false;
      let busy = false;
      let found = 0; // số cặp đã ghép
      let gone = 0; // số cặp đã biến mất khỏi bàn
      let streak = 0;
      let opened = [];
      let queue = []; // chạm trong lúc đang so 2 thẻ: nhớ lại, lật khi mở khoá (không nuốt mất lượt chạm)
      let moodTimer = 0;
      let offVis = null;
      let ro = null;
      let offResize = null;

      // Cùng một file ảnh (lỡ ghi trùng trong config) thì luôn ghép được với nhau
      const keyOf = photos.map((src) => photos.indexOf(src));

      /* ---------- layout ---------- */
      const n = pairs * 2;
      const tall = { c: Math.max(1, Math.min(4, n)), r: 1 };
      tall.r = Math.max(1, Math.ceil(n / tall.c));
      const wide = tall.r > tall.c ? { c: tall.r, r: tall.c } : tall;
      // Các cách xếp được thử (thứ tự = ưu tiên khi thẻ to bằng nhau)
      const shapes = [{ shape: "tall", c: tall.c, r: tall.r }];
      if (wide !== tall) shapes.push({ shape: "wide", c: wide.c, r: wide.r });
      const LAYOUTS = [];
      ["top", "side"].forEach((hud) => shapes.forEach((s) => LAYOUTS.push({ hud, ...s })));
      let layout = LAYOUTS[0];

      const countNum = h("span.memory-count__num", { text: "0" });
      const chip = h(
        "div.chip.memory-count",
        { role: "status", "aria-live": "polite", "aria-atomic": "true" },
        UI.lifeIcon(),
        h("span.memory-count__label", { text: "Cặp" }),
        h("span.memory-count__val", null, countNum, h("span", { text: "/" + pairs }))
      );
      const mascot = ctx.mascot.el("idle", { size: "var(--top-h)", cls: "memory-mascot" });
      const top = h("div.memory-top", null, mascot, chip);

      const grid = h("div.memory-grid", {
        role: "group",
        "aria-label": "Bàn thẻ, " + n + " thẻ",
        style: { "--tc": tall.c, "--tr": tall.r, "--wc": wide.c, "--wr": wide.r },
      });
      const wrap = h("div.memory-level", { dataset: { hud: layout.hud } }, top, grid);
      grid.dataset.shape = layout.shape;
      ctx.root.append(wrap);

      /* ---------- cards ---------- */
      const deck = shuffle(photos.flatMap((_, i) => [i, i]));
      const cards = deck.map((photo, idx) => makeCard(photo, idx));
      grid.append(...cards.map((c) => c.el));
      grid.inert = true; // chưa cho chạm trước khi đếm ngược xong

      function makeCard(photo, idx) {
        const src = photos[photo];
        const pair = keyOf[photo];
        const el = h("button.memory-card", {
          type: "button",
          dataset: { pair: String(pair) },
          style: { "--tilt": rand(-10, 10).toFixed(1) + "deg" },
        });
        const card = { el, pair, idx, open: false, matched: false, removed: false, pt: 0 };

        // Mặt sau
        const back = h("span.memory-card__face.memory-card__back");
        if (cardBack) {
          back.classList.add("has-art");
          const art = h("img.memory-card__art", { src: cardBack, alt: "", draggable: "false", decoding: "async" });
          // Ảnh mặt sau lỗi thì quay về mẫu mặc định (trái tim)
          art.addEventListener("error", () => { back.classList.remove("has-art"); art.remove(); back.insertAdjacentHTML("beforeend", heartSVG(ctx.icons.HEART_PATH)); }, { once: true });
          back.append(h("span.memory-card__art-wrap", null, art));
        } else {
          back.insertAdjacentHTML("beforeend", heartSVG(ctx.icons.HEART_PATH));
        }

        // Mặt trước: ảnh trong khung trắng
        const media = UI.img(src, { alt: "", cls: "memory-card__img" });
        // Thiếu ảnh: giữ ô báo lỗi của UI.img nhưng bỏ đường dẫn (thẻ quá nhỏ, chỉ còn
        // "ảnh..." bị cắt), để lại dòng báo lỗi + số thứ tự ảnh trong config (to, ở giữa).
        // Đường dẫn đầy đủ nằm ở title (rê chuột trên máy tính) và trong console (lỗi 404).
        const markMissing = () => {
          el.classList.add("is-missing");
          const box = el.querySelector(".img-missing");
          if (box) box.replaceChildren(h("span.memory-miss__msg", { text: text.missingImage || "Không tìm thấy ảnh" }));
          if (src) el.title = src;
        };
        const front = h(
          "span.memory-card__face.memory-card__front",
          null,
          h("span.memory-card__photo", null, media),
          // Số của cặp, chỉ hiện khi thiếu ảnh để vẫn chơi được
          h("span.memory-card__num.t-stroke-sm", { text: String(pair + 1), "aria-hidden": "true" })
        );

        const check = UI.successCheck("memory-card__check");
        const badge = h("span.memory-card__badge", { "aria-hidden": "true" }, check);
        card.check = check;
        card.lift = h("span.memory-card__lift", null, h("span.memory-card__inner", null, back, front), badge);
        el.append(card.lift);
        if (media.classList.contains("img-missing")) markMissing();
        else media.addEventListener("error", markMissing, { once: true });

        el.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          card.pt = performance.now();
          tryFlip(card);
        });
        // Bàn phím (Enter/Space, detail = 0) và trình đọc màn hình: chỉ có "click".
        // Click do chuột/ngón tay sinh ra ngay sau pointerdown thì bỏ qua (đã lật rồi).
        el.addEventListener("click", (e) => {
          if (e.detail !== 0 && performance.now() - card.pt < 1500) return;
          tryFlip(card);
        });
        label(card);
        return card;
      }

      function label(c) {
        const k = "Thẻ " + (c.idx + 1);
        let s;
        if (c.matched) s = k + ": ảnh " + (c.pair + 1) + ", đã ghép cặp";
        else if (c.open) s = k + ": ảnh " + (c.pair + 1);
        else s = k + ": đang úp, bấm để lật";
        c.el.setAttribute("aria-label", s);
        if (c.matched) c.el.setAttribute("aria-disabled", "true");
      }

      /* ---------- chọn bố cục cho thẻ to nhất ----------
         Thử từng cách (4x5 / 5x4, hàng trên / cột trái) rồi đo bề ngang thẻ thật
         do CSS tính ra, nên JS và CSS không bao giờ lệch nhau. .memory-level có
         container-type: size nên đổi bố cục không làm đổi kích thước của nó
         (không gây vòng lặp ResizeObserver). */
      let lastW = -1;
      let lastH = -1;
      function applyLayout(l) {
        wrap.dataset.hud = l.hud;
        grid.dataset.shape = l.shape;
      }
      function chooseLayout(force) {
        if (dead || !wrap.isConnected) return;
        const W = wrap.clientWidth;
        const H = wrap.clientHeight;
        if (!W || !H || (!force && W === lastW && H === lastH)) return;
        lastW = W;
        lastH = H;
        const probe = cards[0] && cards[0].el;
        if (!probe || LAYOUTS.length < 2) return;
        let best = null;
        for (const l of LAYOUTS) {
          applyLayout(l);
          const w = probe.getBoundingClientRect().width;
          if (!best || w > best.w + 0.5) best = { l, w };
        }
        layout = best.l;
        applyLayout(layout);
      }
      chooseLayout(true);
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver(() => chooseLayout(false));
        ro.observe(wrap);
      } else {
        const onResize = () => chooseLayout(false);
        window.addEventListener("resize", onResize);
        offResize = () => window.removeEventListener("resize", onResize);
      }

      function setMood(mood, backMs) {
        ctx.mascot.setMood(mascot, mood);
        if (!rm) replay(mascot, "is-bounce");
        if (moodTimer) { clearTimeout(moodTimer); timeouts.delete(moodTimer); moodTimer = 0; }
        if (backMs) moodTimer = later(() => { moodTimer = 0; ctx.mascot.setMood(mascot, "idle"); }, backMs);
      }

      function anim(c, cls) {
        c.lift.classList.remove("is-squash", "is-match", "is-hop");
        if (!rm) replay(c.lift, cls);
      }

      /* ---------- gameplay ---------- */
      function tryFlip(c, queued) {
        if (!playing || finished || c.open || c.matched || c.removed) return;
        if (busy) {
          // Đang so 2 thẻ: không lật thêm, nhưng nhớ lượt chạm (tối đa 2 thẻ) để lật ngay khi mở khoá
          if (queue.length < 2 && !queue.includes(c)) {
            queue.push(c);
            anim(c, "is-squash");
          }
          return;
        }
        c.open = true;
        c.el.classList.add("is-open");
        if (!queued) anim(c, "is-squash");
        Sfx.flip();
        label(c);
        opened.push(c);
        if (opened.length < 2) return;

        const [a, b] = opened;
        opened = [];
        busy = true;
        if (a.pair === b.pair) {
          a.matched = b.matched = true;
          found++;
          // Cặp cuối lật kịp trước khi hết giờ thì tính thắng ngay (không để đồng hồ về 0 trong lúc thẻ đang lật)
          if (found >= pairs) {
            finished = true;
            playing = false;
            queue = [];
            timer.stop();
          }
          later(() => onMatch(a, b), FLIP_MS);
        } else {
          streak = 0;
          later(() => {
            [a, b].forEach((x) => { x.el.classList.add("is-wrong"); UI.shake(x.el); });
            Sfx.back();
            setMood("sad", 900);
          }, FLIP_MS);
          later(() => {
            [a, b].forEach((x) => {
              x.open = false;
              x.el.classList.remove("is-open", "is-wrong");
              label(x);
            });
            Sfx.flip();
            release();
          }, Math.max(PEEK_MS, FLIP_MS + 200));
        }
      }

      // Mở khoá sau khi so xong, rồi lật các thẻ đã chạm trong lúc chờ
      function release() {
        busy = false;
        const q = queue;
        queue = [];
        q.forEach((x) => tryFlip(x, true));
      }

      // Đúng cặp: sáng mint + tick một nhịp (BEAT_MS) rồi biến mất. Không chặn lượt tiếp theo.
      function onMatch(a, b) {
        streak++;
        [a, b].forEach((x) => {
          x.el.classList.add("is-matched");
          anim(x, "is-match");
          x.check.show();
          label(x);
        });
        Sfx.match();
        UI.digits(countNum, String(found));
        replay(chip, "is-bump");
        if (streak >= 2 && found < pairs && !rm) floatBetween(a, b, pick(text.correct) || "Giỏi quá!");
        later(() => vanish(a, b), BEAT_MS);
        if (found >= pairs) {
          busy = false;
          setMood("love");
          return;
        }
        setMood("happy", 1100);
        release();
      }

      // Thẻ còn chơi được (chưa ghép, chưa biến mất)
      const live = (c) => !c.matched && !c.removed;

      // Cặp "bụp" biến mất: phồng lên chút rồi thu nhỏ + mờ dần, bắn tim ở mỗi thẻ.
      // Ô của thẻ vẫn giữ chỗ (không dời bàn), chỉ còn viền nét đứt mờ.
      function vanish(a, b) {
        const pair = [a, b];
        // Đang focus (bàn phím) vào thẻ sắp biến mất: chuyển focus sang thẻ gần nhất còn lại,
        // làm TRƯỚC khi disabled để focus không rơi về <body>.
        const focused = pair.find((x) => x.el === document.activeElement);
        if (focused) focusNear(focused.idx);
        pair.forEach((x) => {
          x.removed = true;
          x.el.disabled = true;
          x.el.setAttribute("aria-hidden", "true");
          x.el.classList.add("is-removed");
        });
        // Tiếng "bụp" + tim bắn ra đúng lúc thẻ phồng to nhất rồi bắt đầu thu nhỏ
        later(() => {
          Sfx.pop();
          pair.forEach((x, i) =>
            Fx.burstAt(x.el, { count: i ? 14 : 12, shapes: i ? ["heart", "star"] : ["heart", "circle"], colors: BURST_COLORS, speed: 5.5, size: [7, 14] })
          );
        }, rm ? 0 : 110);
        gone++;
        const left = n - gone * 2;
        grid.setAttribute("aria-label", left > 0 ? "Bàn thẻ, còn " + left + " thẻ" : "Bàn thẻ, đã dọn sạch");
        if (gone >= pairs) later(win, rm ? 60 : VANISH_MS);
      }

      function focusNear(i) {
        let t = null;
        for (let k = i + 1; k < cards.length && !t; k++) if (live(cards[k])) t = cards[k];
        for (let k = i - 1; k >= 0 && !t; k--) if (live(cards[k])) t = cards[k];
        if (t) {
          t.el.focus({ preventScroll: true });
        } else {
          // Hết thẻ: giữ focus trong bàn (engine sẽ chuyển focus sang nút của modal)
          grid.tabIndex = -1;
          grid.focus({ preventScroll: true });
        }
      }

      // Chữ bay lên giữa 2 thẻ vừa ghép, luôn nằm trọn trong màn hình (câu dài thì thu nhỏ chữ)
      function floatBetween(a, b, str) {
        const p = ctx.core.center(a.el);
        const q = ctx.core.center(b.el);
        const x = (p.x + q.x) / 2;
        const el = UI.float(str, x, Math.min(p.y, q.y), "mint");
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const max = (vw - 24) / 1.15; // keyframe float-up phóng to 1.15 lần
        let w = el.offsetWidth;
        if (w > max) {
          const fs = Math.max(16, Math.floor((26 * max) / w));
          el.style.fontSize = fs + "px";
          w = el.offsetWidth;
          if (w > max) {
            // Câu quá dài: cho xuống dòng trong bề ngang màn hình
            Object.assign(el.style, { whiteSpace: "normal", width: Math.floor(max) + "px", textAlign: "center", lineHeight: "1.1" });
            w = el.offsetWidth;
          }
        }
        const half = (w * 1.15) / 2 + 8;
        el.style.left = Math.min(Math.max(x, half), vw - half) + "px";
      }

      // Bàn đã trống: ô trống gợn sóng + trái tim lớn giữa bàn, rồi báo thắng cho engine
      async function win() {
        finished = true;
        playing = false;
        queue = [];
        timer.stop();
        grid.classList.remove("is-playing");
        setMood("love");
        cards.forEach((c, i) => {
          const pos = gridPos(i);
          c.el.style.setProperty("--d", (pos.row + pos.col) * 55 + "ms");
        });
        const heart = h("span.memory-cheer__heart", null, UI.lifeIcon());
        const cheer = h(
          "div.memory-cheer",
          { "aria-hidden": "true" },
          heart,
          h("span.memory-cheer__text.t-stroke", { text: "Đủ " + pairs + " cặp rồi!" })
        );
        grid.append(cheer);
        grid.classList.add("is-done");
        Sfx.unlocked();
        later(() => {
          Fx.burstAt(heart, { count: 26, shapes: ["heart", "star", "circle"], colors: BURST_COLORS, speed: 8, size: [8, 16] });
        }, rm ? 0 : 200);
        await wait(rm ? 450 : 1150);
        if (!alive()) return;
        ctx.complete();
      }

      /* ---------- keyboard: phím mũi tên đi giữa các thẻ, bỏ qua ô trống ---------- */
      const cols = () => layout.c;
      function gridPos(i) {
        const c = cols();
        return { row: Math.floor(i / c), col: i % c };
      }
      // Thẻ còn chơi được trong hàng `row`, gần cột `col` nhất
      function nearestInRow(row, col, c) {
        let best = -1;
        let bd = Infinity;
        for (let k = row * c; k < Math.min(cards.length, (row + 1) * c); k++) {
          if (!live(cards[k])) continue;
          const d = Math.abs((k % c) - col);
          if (d < bd) { bd = d; best = k; }
        }
        return best;
      }
      grid.addEventListener("keydown", (e) => {
        const i = cards.findIndex((c) => c.el === document.activeElement);
        if (i < 0) return;
        const c = cols();
        const rows = Math.ceil(cards.length / c);
        const row = Math.floor(i / c);
        const col = i % c;
        let j = -1;
        if (e.key === "ArrowRight") {
          for (let k = i + 1; k < cards.length && j < 0; k++) if (live(cards[k])) j = k;
        } else if (e.key === "ArrowLeft") {
          for (let k = i - 1; k >= 0 && j < 0; k--) if (live(cards[k])) j = k;
        } else if (e.key === "ArrowDown") {
          for (let r = row + 1; r < rows && j < 0; r++) j = nearestInRow(r, col, c);
        } else if (e.key === "ArrowUp") {
          for (let r = row - 1; r >= 0 && j < 0; r--) j = nearestInRow(r, col, c);
        } else if (e.key === "Home") {
          j = cards.findIndex(live);
        } else if (e.key === "End") {
          for (let k = cards.length - 1; k >= 0 && j < 0; k--) if (live(cards[k])) j = k;
        } else return;
        e.preventDefault();
        if (j >= 0) cards[j].el.focus();
      });

      /* ---------- timer + start ---------- */
      // Tạo thanh thời gian ngay (đứng yên ở 1:00) để bố cục không bị nhảy khi bắt đầu.
      const timer = ctx.timer({
        seconds,
        onTick: (sec) => {
          if (sec === 10 && playing && seconds > 15) setMood("wow", 1400);
        },
        onEnd: () => {
          if (finished || dead) return;
          playing = false;
          grid.classList.remove("is-playing");
          ctx.fail("timeout");
        },
      });
      ctx.setHint(data.hint || HINT);

      (async () => {
        await ctx.ready;
        if (!alive()) return;
        if (!pairs) { ctx.complete(); return; }
        chooseLayout(true); // phòng khi kích thước đổi trong lúc chuyển cảnh
        // Sóng nhỏ "sẵn sàng" chạy cùng lúc với đếm ngược
        if (!rm) cards.forEach((c, i) => {
          const p = gridPos(i);
          c.el.style.setProperty("--d", (p.row + p.col) * 45 + "ms");
          anim(c, "is-hop");
        });
        await ctx.countdown();
        if (!alive()) return;
        // Em chuyển tab / khoá máy trong lúc đếm ngược: chờ quay lại rồi đếm lại,
        // không cho đồng hồ chạy khi màn hình đang ẩn.
        while (document.hidden) {
          await whenVisible();
          if (!alive()) return;
          await ctx.countdown();
          if (!alive()) return;
        }
        playing = true;
        grid.inert = false;
        grid.classList.add("is-playing");
        timer.start();
      })();

      function whenVisible() {
        return new Promise((res) => {
          if (!document.hidden) return res();
          const on = () => {
            if (document.hidden) return;
            off();
            res();
          };
          const off = () => {
            document.removeEventListener("visibilitychange", on);
            offVis = null;
          };
          offVis = off;
          document.addEventListener("visibilitychange", on);
        });
      }

      return {
        destroy() {
          dead = true;
          playing = false;
          queue = [];
          if (offVis) offVis();
          if (ro) { ro.disconnect(); ro = null; }
          if (offResize) { offResize(); offResize = null; }
          timeouts.forEach((id) => clearTimeout(id));
          timeouts.clear();
          try { timer.stop(); } catch (e) { /* engine cũng tự dừng */ }
        },
      };
    },
  };
})();
