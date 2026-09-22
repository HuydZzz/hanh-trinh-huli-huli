/* =====================================================================
   Màn 5 · Hứng tim (key: hearts)
   Canvas game: kéo giỏ hứng tim hồng, né tim vỡ.
   - Vẽ bằng canvas (DPR aware, ResizeObserver), sprite dựng sẵn 1 lần / resize
   - Điều khiển: kéo (Pointer Events), rê chuột, phím ← → / A D
   - ?autoplay: giỏ tự chạy theo tim để test tự động
   ===================================================================== */
(function () {
  "use strict";
  window.Levels = window.Levels || {};

  const TAU = Math.PI * 2;
  // Đường nứt zigzag chạy dọc trái tim (toạ độ viewBox 24 của Icons.HEART_PATH)
  const CRACK = [[12, 6.3], [10.4, 9.1], [13.4, 11.8], [10.6, 14.5], [13, 17.2], [12, 20.5]];
  // Vị trí các tim nhỏ chất trong giỏ (đơn vị giỏ: rộng 100)
  const PILE = [
    { x: 50, y: 15, r: 0.05 },
    { x: 33, y: 17, r: -0.4 },
    { x: 67, y: 17, r: 0.38 },
    { x: 41, y: 9.5, r: -0.18 },
    { x: 59, y: 9.5, r: 0.22 },
    { x: 50, y: 4, r: -0.06 },
  ];
  // Hộp sprite của giỏ (đơn vị giỏ): x -6..106, y -4..80 ; gốc vẽ = (50, 75) là đáy chân
  const CAT_BOX = { x: -6, y: -4, w: 112, h: 84, ox: 50, oy: 75 };
  // Lời khen mỗi 5 tim
  const CHEERS = ["Giỏi quá!", "Khéo tay ghê!", "Quá đỉnh!", "Nhanh tay ghê!"];

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutBack = (t) => {
    const c = 1.9;
    const x = t - 1;
    return 1 + (c + 1) * x * x * x + c * x * x;
  };
  function mulberry(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, f) => (cs.getPropertyValue(n) || "").trim() || f;
    return {
      ink: v("--ink", "#3a2340"),
      muted: v("--muted", "#efe3ea"),
      pink200: v("--pink-200", "#ffc8db"),
      pink300: v("--pink-300", "#ffa3c2"),
      pink400: v("--pink-400", "#ff7fa8"),
      pink500: v("--pink-500", "#f25c8f"),
      pink600: v("--pink-600", "#d9427a"),
      mint200: v("--mint-200", "#a8efd8"),
      mint300: v("--mint-300", "#79e2c3"),
      mint400: v("--mint-400", "#4dd0ab"),
      mint500: v("--mint-500", "#2db590"),
      butter200: v("--butter-200", "#fff0b3"),
      butter300: v("--butter-300", "#ffe27a"),
      butter400: v("--butter-400", "#ffd24a"),
      butter500: v("--butter-500", "#f2b825"),
      lilac200: v("--lilac-200", "#e4daff"),
      lilac300: v("--lilac-300", "#c9b6ff"),
      lilacLo: v("--lilac-500", "#a58ff0"),
      sky200: v("--sky-200", "#c4e7ff"),
    };
  }

  // Offscreen canvas đã nhân DPR, vẽ bằng đơn vị CSS px
  function makeLayer(w, h, dpr) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.lineJoin = "round";
    g.lineCap = "round";
    return { c, g, w, h };
  }

  /* ---------------- Sprite: trái tim ---------------- */
  function paintHeart(g, P, lw, col, shine) {
    // nền tối = vệt bóng dưới phải; lớp sáng dịch lên trái đè lên
    g.fillStyle = col.lo;
    g.fill(P);
    g.save();
    g.clip(P);
    const gr = g.createLinearGradient(0, 3.5, 0, 20.5);
    gr.addColorStop(0, col.hi);
    gr.addColorStop(0.55, col.mid);
    gr.addColorStop(1, col.mid);
    g.translate(-1.2, -1.5);
    g.fillStyle = gr;
    g.fill(P);
    g.restore();
    if (shine) {
      g.save();
      g.translate(7.5, 7.7);
      g.rotate(-0.66);
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.beginPath();
      g.ellipse(0, 0, 2.2, 1.25, 0, 0, TAU);
      g.fill();
      g.restore();
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.beginPath();
      g.arc(5.2, 10.9, 0.78, 0, TAU);
      g.fill();
    }
    g.lineWidth = lw;
    g.strokeStyle = col.ink;
    g.stroke(P);
  }

  // Trả về { c, box, size }: sprite vuông cạnh `box` px, trái tim rộng `size` px ở giữa
  function heartSprite(size, broken, dpr, T, P, img) {
    const pad = Math.ceil(size * 0.2);
    const box = size + pad * 2;
    const L = makeLayer(box, box, dpr);
    const g = L.g;
    if (img && img.naturalWidth) {
      const r = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * r;
      const h = img.naturalHeight * r;
      g.drawImage(img, (box - w) / 2, (box - h) / 2, w, h);
      return { c: L.c, box, size };
    }
    const k = size / 19.5;
    g.translate(box / 2, box / 2);
    g.scale(k, k);
    g.translate(-12, -12.1);
    const lw = Core.clamp(size * 0.075, 2.1, 3.6) / k;
    if (!broken) {
      paintHeart(g, P, lw, { hi: T.pink300, mid: T.pink400, lo: T.pink500, ink: T.ink }, true);
      return { c: L.c, box, size };
    }
    // Tim vỡ: 2 nửa tách theo đường zigzag, xoay nhẹ quanh mũi tim
    const crack = new Path2D();
    crack.moveTo(CRACK[0][0], CRACK[0][1]);
    for (let i = 1; i < CRACK.length; i++) crack.lineTo(CRACK[i][0], CRACK[i][1]);
    const half = (side) => {
      const p = new Path2D();
      p.moveTo(side, -6);
      p.lineTo(12, -6);
      CRACK.forEach((pt) => p.lineTo(pt[0], pt[1]));
      p.lineTo(12, 30);
      p.lineTo(side, 30);
      p.closePath();
      return p;
    };
    const col = { hi: T.muted, mid: T.lilac300, lo: T.lilacLo, ink: T.ink };
    [[half(-6), -0.13, -0.75, true], [half(30), 0.13, 0.75, false]].forEach(([poly, rot, dx, shine]) => {
      g.save();
      g.translate(12 + dx, 20.5);
      g.rotate(rot);
      g.translate(-12, -20.5);
      g.save();
      g.clip(poly);
      paintHeart(g, P, lw, col, shine);
      g.save();
      g.clip(P);
      g.lineWidth = lw * 2;
      g.strokeStyle = T.ink;
      g.stroke(crack);
      g.restore();
      g.restore();
      g.restore();
    });
    return { c: L.c, box, size };
  }

  /* ---------------- Sprite: giỏ hứng (mặt trước theo cảm xúc + lòng giỏ) ---------------- */
  function catcherSprites(u, dpr, T) {
    const layer = () => {
      const L = makeLayer(CAT_BOX.w * u, CAT_BOX.h * u, dpr);
      L.g.scale(u, u);
      L.g.translate(-CAT_BOX.x, -CAT_BOX.y);
      return L;
    };
    const LW = 3.6 / u; // viền mực ~3.6px
    const FW = 2.9 / u; // nét mặt ~2.9px

    // Lòng giỏ (vẽ trước, tim chất lên trên, rồi mặt trước đè lên)
    const back = layer();
    {
      const g = back.g;
      const rimG = g.createLinearGradient(0, 7, 0, 33);
      rimG.addColorStop(0, T.butter200);
      rimG.addColorStop(1, T.butter300);
      g.beginPath();
      g.ellipse(50, 20, 49, 13, 0, 0, TAU);
      g.fillStyle = rimG;
      g.fill();
      g.lineWidth = LW;
      g.strokeStyle = T.ink;
      g.stroke();
      const inG = g.createLinearGradient(0, 12, 0, 29);
      inG.addColorStop(0, T.butter500);
      inG.addColorStop(1, T.butter400);
      g.beginPath();
      g.ellipse(50, 20.5, 41, 8.6, 0, 0, TAU);
      g.fillStyle = inG;
      g.fill();
      g.fillStyle = "rgba(58,35,64,0.16)";
      g.beginPath();
      g.ellipse(50, 18.2, 38, 5.6, 0, Math.PI, 0);
      g.fill();
      g.lineWidth = LW * 0.7;
      g.stroke(pathEllipse(50, 20.5, 41, 8.6));
    }

    function pathEllipse(x, y, rx, ry) {
      const p = new Path2D();
      p.ellipse(x, y, rx, ry, 0, 0, TAU);
      return p;
    }

    const body = new Path2D();
    body.moveTo(1, 20);
    body.lineTo(9, 20.5);
    body.ellipse(50, 20.5, 41, 8.6, 0, Math.PI, 0, true);
    body.lineTo(99, 20);
    body.bezierCurveTo(99, 50, 80, 71, 50, 71);
    body.bezierCurveTo(20, 71, 1, 50, 1, 20);
    body.closePath();
    const lip = new Path2D();
    lip.moveTo(1, 20);
    lip.ellipse(50, 20, 49, 13, 0, Math.PI, 0, true);
    lip.lineTo(91, 20.5);
    lip.ellipse(50, 20.5, 41, 8.6, 0, 0, Math.PI, false);
    lip.closePath();
    const lipEdge = new Path2D();
    lipEdge.ellipse(50, 20, 49, 13, 0, Math.PI * 0.97, Math.PI * 0.03, true);

    function drawBody(g) {
      // chân
      [34, 66].forEach((x) => {
        g.beginPath();
        g.ellipse(x, 70.5, 9.5, 4.8, 0, 0, TAU);
        g.fillStyle = T.butter500;
        g.fill();
        g.lineWidth = LW * 0.85;
        g.strokeStyle = T.ink;
        g.stroke();
      });
      // thân: nền tối + lớp sáng dịch lên trái = khối 3D
      g.fillStyle = T.butter500;
      g.fill(body);
      g.save();
      g.clip(body);
      const bg = g.createLinearGradient(0, 20, 0, 71);
      bg.addColorStop(0, T.butter300);
      bg.addColorStop(0.5, T.butter400);
      bg.addColorStop(1, T.butter400);
      g.translate(-2.6, -3.4);
      g.fillStyle = bg;
      g.fill(body);
      g.restore();
      // miệng giỏ (viền trước)
      const lg = g.createLinearGradient(0, 20, 0, 33);
      lg.addColorStop(0, T.butter200);
      lg.addColorStop(1, T.butter300);
      g.fillStyle = lg;
      g.fill(lip);
      g.lineWidth = LW * 0.75;
      g.strokeStyle = T.ink;
      g.stroke(lipEdge);
      // vệt bóng
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = 3.6 / u;
      g.beginPath();
      g.moveTo(9.5, 35);
      g.quadraticCurveTo(10.5, 48, 19, 57);
      g.stroke();
      g.lineWidth = 2.4 / u;
      g.beginPath();
      g.ellipse(50, 20.5, 45, 11, 0, Math.PI * 0.74, Math.PI * 0.9);
      g.stroke();
      // viền ngoài
      g.lineWidth = LW;
      g.strokeStyle = T.ink;
      g.stroke(body);
    }

    function eye(g, x, y, s) {
      g.fillStyle = T.ink;
      g.beginPath();
      g.ellipse(x, y, 3.3 * s, 4.1 * s, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(x + 1.2 * s, y - 1.6 * s, 1.25 * s, 0, TAU);
      g.fill();
    }
    function blush(g) {
      g.fillStyle = T.pink500;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.ellipse(27.5, 52.5, 6, 3.3, 0, 0, TAU);
      g.ellipse(72.5, 52.5, 6, 3.3, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    function line(g, d) {
      g.lineWidth = FW;
      g.strokeStyle = T.ink;
      g.stroke(new Path2D(d));
    }
    function openMouth(g) {
      const m = new Path2D("M43.5 51.5Q50 62.5 56.5 51.5Z");
      g.fillStyle = T.ink;
      g.fill(m);
      g.lineWidth = FW * 0.7;
      g.strokeStyle = T.ink;
      g.stroke(m);
      g.save();
      g.clip(m);
      g.fillStyle = T.pink400;
      g.beginPath();
      g.ellipse(50, 58.8, 3.9, 2.4, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    const heartP = new Path2D(Icons.HEART_PATH);
    function heartEye(g, x, y) {
      g.save();
      g.translate(x, y);
      g.scale(0.5, 0.5);
      g.translate(-12, -12);
      g.fillStyle = T.pink600;
      g.fill(heartP);
      g.lineWidth = 3.4;
      g.strokeStyle = T.ink;
      g.stroke(heartP);
      g.restore();
    }
    const faces = {
      idle(g) {
        eye(g, 39.5, 45.5, 1.13);
        eye(g, 60.5, 45.5, 1.13);
        blush(g);
        line(g, "M45 51.5Q50 57 55 51.5");
      },
      blink(g) {
        line(g, "M35.5 46.5Q39.5 50 43.5 46.5");
        line(g, "M56.5 46.5Q60.5 50 64.5 46.5");
        blush(g);
        line(g, "M45 51.5Q50 57 55 51.5");
      },
      happy(g) {
        line(g, "M35 47.5Q39.5 40.5 44 47.5");
        line(g, "M56 47.5Q60.5 40.5 65 47.5");
        blush(g);
        openMouth(g);
      },
      sad(g) {
        eye(g, 39.5, 46.5, 1.02);
        eye(g, 60.5, 46.5, 1.02);
        line(g, "M33.5 40L42.5 37.2");
        line(g, "M66.5 40L57.5 37.2");
        blush(g);
        line(g, "M44.5 57Q50 51.5 55.5 57");
        const tear = new Path2D("M68 48.5q2.8 4.4 0 6.3q-2.8-1.9 0-6.3z");
        g.fillStyle = T.sky200;
        g.fill(tear);
        g.lineWidth = 1.5 / u;
        g.strokeStyle = T.ink;
        g.stroke(tear);
      },
      love(g) {
        heartEye(g, 39.5, 45.5);
        heartEye(g, 60.5, 45.5);
        blush(g);
        openMouth(g);
      },
    };
    const front = {};
    Object.keys(faces).forEach((m) => {
      const L = layer();
      drawBody(L.g);
      faces[m](L.g);
      front[m] = L.c;
    });
    return { back: back.c, front };
  }

  window.Levels.hearts = {
    assets(data, config) {
      const art = (config && config.art) || {};
      return [art.catcher, art.heart, art.brokenHeart].filter(Boolean);
    },

    start(ctx) {
      const { h, clamp, rand, pick, replay } = ctx.core;
      const UI = ctx.ui;
      const Sfx = ctx.sfx;
      const Fx = ctx.fx;
      const data = ctx.data || {};
      const art = (ctx.config && ctx.config.art) || {};
      const T = readTokens();
      const HEART_P = new Path2D(ctx.icons.HEART_PATH);

      const target = Math.max(1, Math.round(Number(data.target) || 20));
      const brokenChance = clamp(Number(data.brokenChance != null ? data.brokenChance : 0.25) || 0, 0, 0.7);
      const speed = clamp(Number(data.speed) || 1, 0.4, 3);
      const AUTO = /[?&]autoplay\b/.test(location.search);
      const rm = ctx.core.reducedMotion();
      const finePointer = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);

      /* ---------- DOM ---------- */
      const fill = h("div.hearts-meter__fill");
      const num = h("span.hearts-meter__num", { text: "0" });
      const meterIcon = h("div.hearts-meter__icon", null, UI.lifeIcon(false));
      const meter = h(
        "div.hearts-meter",
        { role: "progressbar", "aria-label": "Số tim đã hứng", "aria-valuemin": "0", "aria-valuemax": String(target), "aria-valuenow": "0" },
        meterIcon,
        h("div.hearts-meter__track", null, fill, h("span.hearts-meter__text.t-stroke-sm", null, h("span", { text: "Tim" }), num, h("span", { text: "/" + target })))
      );
      (ctx.timerSlot || ctx.root).append(meter);

      const canvas = h("canvas.hearts-canvas", { "aria-hidden": "true" });
      const CLOUD =
        '<svg viewBox="0 0 190 80" aria-hidden="true"><path d="M40 72c-18 0-30-11-30-25 0-15 13-26 28-25 4-17 20-28 38-28 17 0 31 10 36 25 4-2 9-3 14-3 18 0 32 12 32 28s-14 28-32 28z"/></svg>';
      const legendIcon = (broken) => {
        const img = broken ? art.brokenHeart : art.heart;
        // vẽ ở 28px rồi co theo cỡ chữ của thẻ (thẻ to hơn trên màn rộng)
        const s = heartSprite(28, broken, Math.min(3, window.devicePixelRatio || 1), T, HEART_P, null);
        s.c.style.width = s.c.style.height = "100%";
        const el = h("span.hearts-legend__icon", null, s.c);
        if (img) {
          // có ảnh tự vẽ thì dùng luôn cho chú thích
          const im = h("img", { src: img, alt: "", draggable: "false", style: { width: "74%", height: "74%", objectFit: "contain" } });
          im.addEventListener("load", () => el.replaceChildren(im), { once: true });
        }
        return el;
      };
      const legend = h(
        "div.hearts-legend",
        { "aria-hidden": "true" },
        h("span.hearts-legend__item", null, legendIcon(false), h("span", { text: "Hứng tim hồng" })),
        h("span.hearts-legend__sep"),
        h("span.hearts-legend__item", null, legendIcon(true), h("span", { text: "Né tim vỡ" }))
      );
      const arena = h(
        "div.hearts-arena",
        { role: "application", "aria-label": "Khu hứng tim. Kéo, rê chuột hoặc dùng phím mũi tên trái phải để di chuyển giỏ." },
        h("div.hearts-cloud.hearts-cloud--a", { html: CLOUD }),
        h("div.hearts-cloud.hearts-cloud--b", { html: CLOUD }),
        canvas,
        legend
      );
      ctx.root.append(arena);
      arena.hearts = { get info() { return { x: cx, tx, W, H, state, items: items.length, invulnerable: invT > 0 }; } };
      ctx.setHint(finePointer ? "Rê chuột hoặc bấm ← → để hứng tim, né tim vỡ nha" : "Kéo giỏ hứng tim, né tim vỡ nha");
      const g = canvas.getContext("2d");

      /* ---------- State ---------- */
      let destroyed = false;
      let raf = 0;
      let last = 0;
      let state = "intro"; // intro | play | won | dead
      let W = 0;
      let H = 0;
      let dpr = 1;
      let cw = 100; // chiều rộng giỏ (px)
      let u = 1; // px / đơn vị giỏ
      let hs = 40; // kích thước tim (px)
      let gy = 0; // mép trên mặt cỏ
      let baseY = 0; // đáy chân giỏ
      let mouthOff = 54; // khoảng từ đáy chân tới miệng giỏ
      let catchHalf = 41; // nửa bề rộng vùng hứng
      let minX = 0;
      let maxX = 0;
      let cx = 0; // vị trí giỏ
      let tx = 0; // vị trí mục tiêu
      let vx = 0;
      let tilt = 0;
      let sq = 0; // squash spring
      let sqV = 0;
      let bob = 0;
      let mood = "idle";
      let moodT = 0;
      let blinkT = 0;
      let nextBlink = rand(1.8, 3.6);
      let shakeT = 0;
      let invT = 0;
      let t = 0;
      let playT = 0;
      let spawnT = 0;
      let spawned = 0;
      let brokenRun = 0;
      let caught = 0;
      let moved = false;
      let arrowsA = 1;
      let items = [];
      const pileAt = [];
      let sprGood = null;
      let sprBroken = null;
      let cat = null;
      let catArt = null; // { c, w, h } khi có CONFIG.art.catcher
      let ground = null;
      let arrowP = null;
      const imgs = {};
      const timers = new Set();
      const keys = { l: false, r: false };
      let dragId = null;
      let rect = null;
      let rectAt = -1e9;

      function later(fn, ms) {
        const id = setTimeout(() => {
          timers.delete(id);
          if (!destroyed) fn();
        }, ms);
        timers.add(id);
      }
      function getRect(force) {
        const now = performance.now();
        if (force || !rect || now - rectAt > 300) {
          rect = canvas.getBoundingClientRect();
          rectAt = now;
        }
        return rect;
      }
      // Chữ bay (+1, Ui da!) luôn nằm gọn trong sân, không bị cắt ở mép màn hình
      function floatIn(str, x, y, tone) {
        const r = getRect();
        const half = Math.min(r.width / 2 - 4, 10 + str.length * 9);
        UI.float(str, clamp(x, r.left + half, r.right - half), y, tone);
      }
      function toScreen(x, y) {
        const r = getRect();
        const k = W ? r.width / W : 1;
        return { x: r.left + x * k, y: r.top + y * k };
      }

      /* ---------- Art (ảnh tự vẽ) ---------- */
      ["catcher", "heart", "brokenHeart"].forEach((key) => {
        if (!art[key]) return;
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          if (destroyed) return;
          imgs[key] = im;
          buildSprites();
          if (state !== "play") render();
        };
        im.src = art[key];
      });

      /* ---------- Layout + sprites ---------- */
      function buildGround() {
        const top = gy - 10;
        const hh = Math.max(20, H - top);
        const L = makeLayer(W, hh, dpr);
        const c = L.g;
        const yAt = (x) => 10 + Math.sin((x / W) * TAU * 1.1 + 0.7) * 3.2 + Math.sin((x / W) * TAU * 2.6 + 2.1) * 1.5;
        const edge = new Path2D();
        edge.moveTo(-8, yAt(-8));
        for (let x = 0; x <= W + 8; x += 8) edge.lineTo(x, yAt(x));
        const area = new Path2D(edge);
        area.lineTo(W + 8, hh + 8);
        area.lineTo(-8, hh + 8);
        area.closePath();
        const gr = c.createLinearGradient(0, 6, 0, hh);
        gr.addColorStop(0, T.mint300);
        gr.addColorStop(1, T.mint400);
        c.fillStyle = gr;
        c.fill(area);
        c.save();
        c.clip(area);
        c.translate(0, 5);
        c.strokeStyle = "rgba(255,255,255,0.6)";
        c.lineWidth = 3;
        c.stroke(edge);
        c.restore();
        c.strokeStyle = T.ink;
        c.lineWidth = 3.5;
        c.stroke(edge);
        // cỏ + hoa (random cố định để không nhảy khi resize)
        const rnd = mulberry(2010);
        const n = Math.max(4, Math.round(W / 46));
        c.strokeStyle = T.mint500;
        c.lineWidth = 2;
        for (let i = 0; i < n; i++) {
          const x = ((i + 0.5) * W) / n + (rnd() - 0.5) * (W / n) * 0.7;
          const y = yAt(x) + 9 + rnd() * Math.max(4, hh - 22);
          if (y > hh - 5) continue;
          c.beginPath();
          c.moveTo(x - 4, y);
          c.lineTo(x - 2, y - 5);
          c.lineTo(x, y - 1);
          c.lineTo(x + 2, y - 6);
          c.lineTo(x + 4, y);
          c.stroke();
        }
        [[0.09, T.pink300], [0.5, T.butter300], [0.92, T.lilac300]].forEach(([fx, colr], i) => {
          const x = W * fx + (rnd() - 0.5) * 20;
          const y = Math.min(hh - 8, yAt(x) + 10 + rnd() * 6 + i);
          c.save();
          c.translate(x, y);
          c.lineWidth = 1.4;
          c.strokeStyle = T.ink;
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU - Math.PI / 2;
            c.beginPath();
            c.arc(Math.cos(a) * 3.3, Math.sin(a) * 3.3, 2.7, 0, TAU);
            c.fillStyle = colr;
            c.fill();
            c.stroke();
          }
          c.beginPath();
          c.arc(0, 0, 2.2, 0, TAU);
          c.fillStyle = T.butter400;
          c.fill();
          c.stroke();
          c.restore();
        });
        ground = { c: L.c, y: top, h: hh };
      }

      function buildSprites() {
        if (!W || !H) return;
        sprGood = heartSprite(hs, false, dpr, T, HEART_P, imgs.heart);
        sprBroken = heartSprite(hs, true, dpr, T, HEART_P, imgs.brokenHeart);
        if (imgs.catcher && imgs.catcher.naturalWidth) {
          const im = imgs.catcher;
          let w = cw * 1.04;
          let hh = (w * im.naturalHeight) / im.naturalWidth;
          // ảnh dọc/lạ tỉ lệ: co lại cho vừa khung giỏ, không để giỏ cao quá nửa sân
          const maxH = Math.min(cw * 0.95, H * 0.3);
          if (hh > maxH) {
            w *= maxH / hh;
            hh = maxH;
          }
          const L = makeLayer(w, hh, dpr);
          L.g.drawImage(im, 0, 0, w, hh);
          catArt = { c: L.c, w, h: hh };
          // README: ảnh ~480x320, miệng giỏ ở khoảng 1/3 phía trên
          mouthOff = hh * 0.68;
          catchHalf = Math.max(w, cw * 0.8) * 0.4;
          cat = null;
        } else {
          catArt = null;
          cat = catcherSprites(u, dpr, T);
          mouthOff = (CAT_BOX.oy - 20.5) * u;
          catchHalf = 41 * u;
        }
        const ap = new Path2D();
        ap.moveTo(-3, -7.5);
        ap.lineTo(6.5, 0);
        ap.lineTo(-3, 7.5);
        ap.closePath();
        arrowP = ap;
        buildGround();
        // Chú thích nằm ngay trên miệng giỏ; sân thấp (điện thoại nhỏ) thì sát giỏ hơn để né số đếm ngược
        const catTop = catArt ? catArt.h : (CAT_BOX.oy - 6) * u;
        arena.style.setProperty("--hearts-legend-b", Math.round(H - baseY + catTop + clamp(H * 0.03, 6, 18)) + "px");
      }

      function resize(w, hgt) {
        w = Math.round(w);
        hgt = Math.round(hgt);
        if (w < 40 || hgt < 40) return;
        const nd = Math.min(3, window.devicePixelRatio || 1);
        if (w === W && hgt === H && nd === dpr && sprGood) return;
        const sx = W ? w / W : 1;
        const sy = H ? hgt / H : 1;
        W = w;
        H = hgt;
        dpr = nd;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        cw = clamp(Math.min(W * 0.27, H * 0.3), 72, 132);
        u = cw / 100;
        hs = Math.round(clamp(Math.min(W * 0.12, H * 0.082), 28, 52));
        const gh = clamp(H * 0.085, 26, 58);
        gy = H - gh;
        baseY = gy + Math.max(7, gh * 0.4);
        minX = cw * 0.5 + 2;
        maxX = W - cw * 0.5 - 2;
        if (!cx) cx = tx = W / 2;
        else {
          cx = clamp(cx * sx, minX, maxX);
          tx = clamp(tx * sx, minX, maxX);
        }
        items.forEach((it) => {
          it.x0 *= sx;
          it.x *= sx;
          it.amp *= sx;
          it.y *= sy;
          it.prevY *= sy;
          it.vy *= sy;
        });
        buildSprites();
        rect = null;
        if (!raf) render();
      }

      /* ---------- Gameplay ---------- */
      function difficulty() {
        return clamp(Math.max((caught / target) * 0.95, playT / 65), 0, 1);
      }
      function spawn() {
        const d = difficulty();
        const liveBroken = items.reduce((n, o) => n + (!o.good && !o.fade ? 1 : 0), 0);
        let good = spawned < 3 || brokenRun >= 2 || liveBroken >= 3 || Math.random() >= brokenChance;
        brokenRun = good ? 0 : brokenRun + 1;
        const amp = W * (rm ? 0.01 : rand(0.012, 0.034));
        const margin = hs * 0.62 + amp;
        let x = W / 2;
        for (let i = 0; i < 8; i++) {
          x = rand(margin, Math.max(margin, W - margin));
          const clash = items.some((o) => o.y < hs * 2.4 && Math.abs(o.x0 - x) < hs * 1.35);
          if (!clash) break;
        }
        items.push({
          good,
          x0: x,
          x,
          y: -hs * 0.7,
          prevY: -hs * 0.7,
          vy: H * lerp(0.27, 0.5, d) * speed * rand(0.92, 1.08),
          amp,
          freq: rand(1.5, 2.6),
          phase: rand(0, TAU),
          age: 0,
          rot: 0,
          alpha: 1,
          passed: false,
          fade: false,
        });
        spawned++;
      }
      function spawnInterval() {
        return (lerp(1.08, 0.52, difficulty()) / Math.sqrt(speed)) * rand(0.85, 1.15);
      }
      function setMood(m, dur) {
        mood = m;
        moodT = dur;
      }

      function catchHeart(it) {
        caught++;
        Sfx.catch();
        if (!rm) sqV += 2.3;
        if (mood !== "sad" || moodT <= 0) setMood("happy", 0.42);
        const pileN = Math.min(PILE.length, Math.floor((caught * PILE.length) / target));
        while (pileAt.length < pileN) pileAt.push(t);
        const p = toScreen(it.x, baseY - mouthOff);
        Fx.burst(p.x, p.y - 4, { count: 9, shapes: ["heart", "circle", "star"], colors: [T.pink400, T.pink300, "#FFFFFF", T.butter400], speed: 4.6, size: [6, 11], lift: 3.4 });
        floatIn("+1", p.x, p.y - hs * 0.7, "pink");
        fill.style.width = (Math.min(caught, target) / target) * 100 + "%";
        UI.digits(num, String(caught));
        replay(meterIcon, "is-bump");
        meter.setAttribute("aria-valuenow", String(caught));
        arena.dataset.caught = String(caught);
        if (caught >= target) win();
        else if (caught % 5 === 0) {
          // text.correct là lời khen trả lời đúng (có câu "Nhớ dai ghê!"), không hợp với việc hứng tim
          const msg = caught === target - 5 && target > 5 ? "Còn 5 tim nữa!" : caught * 2 === target ? "Được một nửa rồi!" : pick(CHEERS);
          const r = getRect();
          UI.float(msg, r.left + r.width / 2, r.top + r.height * 0.34, "mint");
          Sfx.match();
        }
      }

      async function hitBroken(it) {
        invT = 0.85;
        if (!rm) shakeT = 0.42;
        setMood("sad", 1.05);
        Sfx.crack();
        const p = toScreen(it.x, baseY - mouthOff);
        Fx.burst(p.x, p.y, { count: 13, shapes: ["rect", "circle", "heart"], colors: [T.lilac300, T.lilac200, T.muted, T.lilacLo], speed: 6.5, size: [6, 12], lift: 3 });
        floatIn("Ui da!", p.x, p.y - hs * 0.8, "coral");
        const alive = await ctx.loseLife();
        if (!alive || !ctx.alive) halt();
      }

      function blockBroken(it) {
        // chạm tim vỡ khi đang được bảo vệ: vỡ vụn, không mất mạng
        const p = toScreen(it.x, baseY - mouthOff);
        Fx.burst(p.x, p.y, { count: 7, shapes: ["rect", "circle"], colors: [T.lilac300, T.muted], speed: 4, size: [5, 9], lift: 2 });
      }

      function poof(it) {
        const p = toScreen(it.x, Math.min(it.y, gy + 4));
        if (it.good) Fx.burst(p.x, p.y, { count: 5, shapes: ["circle", "heart"], colors: ["#FFFFFF", T.pink200], speed: 2.6, size: [5, 9], lift: 1.6, gravity: 0.16, ttl: 40 });
        else Fx.burst(p.x, p.y, { count: 6, shapes: ["rect", "circle"], colors: [T.lilac300, T.muted, T.lilacLo], speed: 3.2, size: [5, 9], lift: 2.2, gravity: 0.2, ttl: 45 });
      }

      function win() {
        state = "won";
        arena.classList.remove("is-playing");
        arena.dataset.state = "won";
        setMood("love", 1e9);
        if (!rm) sqV += 3;
        items = items.filter((it) => {
          if (it.good) {
            const p = toScreen(it.x, it.y);
            Fx.burst(p.x, p.y, { count: 6, shapes: ["star", "heart"], colors: [T.butter400, T.pink300, "#FFFFFF"], speed: 3.4, size: [6, 10], lift: 2 });
            return false;
          }
          it.fade = true;
          return true;
        });
        meter.classList.add("is-full");
        const p = toScreen(cx, baseY - mouthOff);
        Fx.burst(p.x, p.y - 8, { count: 30, shapes: ["heart"], colors: [T.pink400, T.pink300, T.pink200, "#FFFFFF"], speed: 9.5, size: [10, 18], lift: 5 });
        Sfx.match();
        const r = getRect();
        UI.float("Đủ " + target + " tim rồi!", r.left + r.width / 2, r.top + r.height * 0.4, "butter");
        later(() => {
          if (ctx.alive) ctx.complete();
        }, 1150);
      }

      function halt() {
        state = "dead";
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }

      /* ---------- Autoplay (QA) ---------- */
      function landing(it) {
        const line = baseY - mouthOff - hs * 0.12;
        const tt = (line - it.y) / it.vy;
        return { t: tt, x: it.x0 + Math.sin((it.age + tt) * it.freq + it.phase) * it.amp };
      }
      function autoTarget() {
        const good = [];
        const bad = [];
        for (const it of items) {
          if (it.passed || it.fade) continue;
          const L = landing(it);
          if (L.t < -0.02) continue;
          (it.good ? good : bad).push(L);
        }
        const danger = cw * 0.5 + catchHalf * 0.2 + hs * 0.3;
        // tim vỡ sắp rơi trúng chỗ đang đứng: né trước đã
        const threat = bad.filter((b) => b.t < 0.42 && Math.abs(b.x - cx) < danger).sort((a, b) => a.t - b.t)[0];
        good.sort((a, b) => a.t - b.t);
        for (const gd of good) {
          const gx = clamp(gd.x, minX, maxX);
          if (Math.abs(gx - cx) > W * 2.4 * gd.t + catchHalf * 0.6) continue;
          const unsafe = bad.some((b) => b.t <= gd.t + 0.3 && Math.abs(b.x - gx) < danger);
          const crossing = bad.some((b) => b.t < 0.25 && b.x > Math.min(cx, gx) - danger && b.x < Math.max(cx, gx) + danger);
          if (unsafe || crossing) continue;
          return gx;
        }
        if (threat) {
          const left = clamp(threat.x - danger * 1.25, minX, maxX);
          const right = clamp(threat.x + danger * 1.25, minX, maxX);
          const okL = Math.abs(left - threat.x) >= danger * 0.95;
          const okR = Math.abs(right - threat.x) >= danger * 0.95;
          if (okL && okR) return Math.abs(left - cx) < Math.abs(right - cx) ? left : right;
          return okL ? left : right;
        }
        return tx;
      }

      /* ---------- Loop ---------- */
      function update(dt) {
        t += dt;
        if (keys.l !== keys.r) tx = clamp(tx + (keys.r ? 1 : -1) * W * 1.35 * dt, minX, maxX);
        if (AUTO && state === "play") tx = autoTarget();
        const prev = cx;
        cx += (tx - cx) * (1 - Math.exp(-(AUTO ? 24 : 17) * dt));
        cx = clamp(cx, minX, maxX);
        vx = dt > 0 ? (cx - prev) / dt : 0;
        if (!rm) {
          tilt += (clamp(vx / (W * 4.2), -0.15, 0.15) - tilt) * (1 - Math.exp(-12 * dt));
          sqV += (-330 * sq - 12 * sqV) * dt;
          sq = clamp(sq + sqV * dt, -0.3, 0.3);
          bob = Math.sin(t * 3.2) * 1.2;
        }
        if (moodT > 0) moodT -= dt;
        if (shakeT > 0) shakeT -= dt;
        if (invT > 0) invT -= dt;
        blinkT -= dt;
        nextBlink -= dt;
        if (nextBlink <= 0) {
          blinkT = 0.13;
          nextBlink = rand(2.2, 4.4);
        }
        if (moved || state === "won" || playT > 5) arrowsA = Math.max(0, arrowsA - dt * 3);

        if (state === "play") {
          playT += dt;
          spawnT -= dt;
          if (spawnT <= 0) {
            spawn();
            spawnT = spawnInterval();
          }
        }

        const line = baseY - mouthOff - hs * 0.12;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (!it) continue;
          it.age += dt;
          if (it.fade) {
            it.alpha -= dt / 0.35;
            it.y += it.vy * dt * 0.3;
            if (it.alpha <= 0) items.splice(i, 1);
            continue;
          }
          it.prevY = it.y;
          it.y += it.vy * dt;
          it.x = it.x0 + Math.sin(it.age * it.freq + it.phase) * it.amp;
          it.rot = rm ? 0 : Math.sin(it.age * it.freq * 1.2 + it.phase) * 0.2;
          if (!it.passed && state === "play" && it.prevY < line && it.y >= line) {
            const dx = Math.abs(it.x - cx);
            if (it.good && dx <= catchHalf + hs * 0.3) {
              items.splice(i, 1);
              catchHeart(it);
              // tim cuối: win() đã thay mảng items, dừng duyệt ở frame này (tránh items[i] undefined)
              if (state !== "play") return;
              continue;
            }
            if (!it.good && dx <= catchHalf * 0.9) {
              items.splice(i, 1);
              if (invT > 0) blockBroken(it);
              else hitBroken(it);
              if (destroyed) return;
              continue;
            }
            it.passed = true;
          }
          if (it.y - hs * 0.28 > gy) {
            items.splice(i, 1);
            poof(it);
          }
        }
      }

      function drawItem(it, spr) {
        const pulse = it.good && !rm && !it.fade ? 1 + Math.sin(it.age * 7 + it.phase) * 0.04 : 1;
        const s = spr.box * pulse * (it.fade ? 0.75 + 0.25 * it.alpha : 1);
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, it.alpha));
        g.translate(it.x, it.y);
        if (it.rot) g.rotate(it.rot);
        g.drawImage(spr.c, -s / 2, -s / 2, s, s);
        g.restore();
      }

      function drawCatcher() {
        const shakeX = shakeT > 0 ? Math.sin(t * 64) * 6 * (shakeT / 0.42) : 0;
        g.save();
        // bóng dưới giỏ
        g.fillStyle = "rgba(58,35,64,0.16)";
        g.beginPath();
        g.ellipse(cx + shakeX, baseY - 1, cw * 0.4 * (1 + sq * 0.8), Math.max(3, cw * 0.055), 0, 0, TAU);
        g.fill();
        if (invT > 0) g.globalAlpha = rm ? 0.6 : Math.floor(invT * 12) % 2 ? 0.45 : 1;
        g.translate(cx + shakeX, baseY + (state === "won" ? 0 : bob * 0.4));
        g.rotate(tilt);
        g.scale(1 + sq, 1 - sq);
        if (catArt) {
          g.drawImage(catArt.c, -catArt.w / 2, -catArt.h, catArt.w, catArt.h);
        } else if (cat) {
          const bx = (CAT_BOX.x - CAT_BOX.ox) * u;
          const by = (CAT_BOX.y - CAT_BOX.oy) * u;
          const bw = CAT_BOX.w * u;
          const bh = CAT_BOX.h * u;
          g.drawImage(cat.back, bx, by, bw, bh);
          for (let i = 0; i < pileAt.length; i++) {
            const p = PILE[i];
            const a = rm ? 1 : Math.min(1, (t - pileAt[i]) / 0.34);
            const sc = easeOutBack(a);
            if (sc <= 0.01) continue;
            const s = ((21 * u) / sprGood.size) * sprGood.box * sc;
            g.save();
            g.translate((p.x - CAT_BOX.ox) * u, (p.y - CAT_BOX.oy) * u);
            g.rotate(p.r);
            g.drawImage(sprGood.c, -s / 2, -s / 2, s, s);
            g.restore();
          }
          let m = moodT > 0 ? mood : "idle";
          if (m === "idle" && blinkT > 0) m = "blink";
          g.drawImage(cat.front[m] || cat.front.idle, bx, by, bw, bh);
        }
        g.restore();
      }

      function drawArrows() {
        if (arrowsA <= 0 || !arrowP) return;
        const off = rm ? 0 : Math.sin(t * 6) * 3;
        const y = baseY - mouthOff * 0.55;
        g.save();
        g.globalAlpha = arrowsA;
        g.lineJoin = "round";
        g.lineWidth = 3;
        g.strokeStyle = T.ink;
        g.fillStyle = "#FFFFFF";
        [-1, 1].forEach((dir) => {
          g.save();
          g.translate(cx + dir * (cw * 0.5 + 16 + off), y);
          g.scale(dir * 1.25, 1.25);
          g.fill(arrowP);
          g.lineWidth = 2.4;
          g.stroke(arrowP);
          g.restore();
        });
        g.restore();
      }

      function render() {
        if (!W || !H || !sprGood) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (ground) g.drawImage(ground.c, 0, ground.y, W, ground.h);
        for (const it of items) if (!it.passed) drawItem(it, it.good ? sprGood : sprBroken);
        drawArrows();
        drawCatcher();
        for (const it of items) if (it.passed) drawItem(it, it.good ? sprGood : sprBroken);
      }

      function frame(now) {
        raf = 0;
        if (destroyed || state === "dead") return;
        let dt = (now - last) / 1000;
        last = now;
        if (!(dt > 0)) dt = 0;
        if (dt > 0.05) dt = 0.05; // tab ẩn / giật: không cho vật thể nhảy cóc
        update(dt);
        if (destroyed || state === "dead") {
          // hết mạng ngay trong frame này: vẽ khung cuối (giỏ mặt buồn) để nằm yên dưới modal
          if (destroyed) render();
          return;
        }
        render();
        raf = requestAnimationFrame(frame);
      }

      /* ---------- Input ---------- */
      function localX(e) {
        const r = getRect();
        const k = r.width ? W / r.width : 1;
        return clamp((e.clientX - r.left) * k, minX, maxX);
      }
      function onDown(e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragId = e.pointerId;
        try { arena.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        getRect(true);
        tx = localX(e);
        moved = true;
        if (e.cancelable) e.preventDefault();
      }
      function onMove(e) {
        if (e.pointerId === dragId || e.pointerType === "mouse") {
          tx = localX(e);
          if (e.pointerType !== "mouse" || Math.abs(tx - cx) > 4) moved = true;
        }
      }
      function onUp(e) {
        if (e.pointerId === dragId) dragId = null;
      }
      function onKey(e, down) {
        const k = e.key;
        // macOS không gửi keyup cho phím khác khi đang giữ Cmd: nhả Cmd thì thả luôn hướng đi
        if (k === "Meta" || k === "Control" || k === "Alt") {
          if (!down) keys.l = keys.r = false;
          return;
        }
        // Cmd/Ctrl + A/D hay ← → là phím tắt trình duyệt, không phải điều khiển giỏ
        if (down && (e.metaKey || e.ctrlKey || e.altKey)) return;
        let hit = true;
        if (k === "ArrowLeft" || k === "a" || k === "A") keys.l = down;
        else if (k === "ArrowRight" || k === "d" || k === "D") keys.r = down;
        else hit = false;
        if (!hit) return;
        if (k.indexOf("Arrow") === 0) e.preventDefault();
        if (down) moved = true;
      }
      const onKeyDown = (e) => onKey(e, true);
      const onKeyUp = (e) => onKey(e, false);
      const onBlur = () => {
        keys.l = keys.r = false;
        dragId = null;
      };
      // iOS/Android đổi app không phải lúc nào cũng bắn "blur": thả phím + ngón khi tab bị ẩn
      const onVis = () => {
        if (document.hidden) onBlur();
      };
      const onResize = () => {
        rect = null;
        resize(arena.clientWidth, arena.clientHeight);
      };
      arena.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);
      const ro = new ResizeObserver((entries) => {
        const cr = entries[entries.length - 1].contentRect;
        rect = null;
        resize(cr.width, cr.height);
      });
      ro.observe(arena);

      /* ---------- Go ---------- */
      resize(arena.clientWidth, arena.clientHeight);
      arena.dataset.state = "intro";
      arena.dataset.caught = "0";
      last = performance.now();
      raf = requestAnimationFrame(frame);

      (async () => {
        await ctx.ready;
        if (destroyed || !ctx.alive) return;
        await ctx.countdown();
        if (destroyed || !ctx.alive) return;
        state = "play";
        arena.dataset.state = "play";
        arena.classList.add("is-playing");
        spawnT = 0.3;
        legend.classList.add("is-out");
        later(() => legend.remove(), 320);
      })();

      return {
        destroy() {
          if (destroyed) return;
          destroyed = true;
          state = "dead";
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          ro.disconnect();
          arena.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keyup", onKeyUp);
          window.removeEventListener("blur", onBlur);
          window.removeEventListener("resize", onResize);
          document.removeEventListener("visibilitychange", onVis);
          Object.keys(imgs).forEach((k) => delete imgs[k]);
        },
      };
    },
  };
})();
