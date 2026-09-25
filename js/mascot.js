/* =====================================================================
   mascot.js · Linh vật "tụi mình": chibi anh + em nắm tay
   Thay cho linh vật trái tim trong core.js, giữ nguyên API:
     Mascot.svg(mood)                      -> chuỗi SVG
     Mascot.el(mood, { size, bob, cls })   -> phần tử .mascot
     Mascot.setMood(el, mood)              -> đổi nét mặt của cả hai
   mood: idle | happy | sad | wow | love
   Nạp NGAY SAU core.js (dùng Core.h, Core.INK). Có CONFIG.art.mascot thì vẫn dùng ảnh đó.
   ===================================================================== */
(function () {
  "use strict";

  const Core = window.Core || {};
  const h = Core.h;
  const INK = Core.INK || "#3A2340";

  /* palette */
  const SKIN = "#FFE2CF";
  const SKIN_SH = "#F4B89F";
  const BLUSH = "#F25C8F";
  const HAIR_HIM = "#46302F";
  const HAIR_HIM_HI = "#7A5F5C";
  const HAIR_HER = "#A8653F";
  const HAIR_HER_TOP = "#7A4230";
  const HAIR_HER_HI = "#D59A6C";
  const SHIRT = "#9DD6F4";
  const SHIRT_HI = "#C4E8FC";
  const LENS = "#E8E0FF";
  const DRESS_SH = "#EFE2EA";
  const FRAME = "#2A1D2E";
  const GOLD = "#F2C14E";
  const SHOE_HER = "#FF9EBB";
  const PINK = "#FF7FA8";
  const PINK_D = "#E0457F";
  const TEAR = "#9ED8FF";
  const CLOUD = "#D8DEEF";

  // his head (and face + glasses) sits 2.4 lower to share her ground line and leans 3deg towards her
  const HIM_HEAD_T = "translate(0 2.4) rotate(3 36 73)";
  const HIM_BODY_T = "translate(0 2.4)";
  const HER_TILT = "rotate(-5 91.5 80)"; // she leans her head towards him

  const S = (w) => `stroke="${INK}"` + (w ? ` stroke-width="${w}"` : ""); // default width 3.6 is set on the root group
  const LINE = (w = 2.8, c = INK) => `stroke="${c}" stroke-width="${w}" fill="none"`;

  /* limb as a double stroke: ink outline + fill on top (round caps/joins come from the root group) */
  const limb = (d, fill, inner, outline = 3.3) =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${inner + outline * 2}"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${inner}"/>`;

  const HEART = "M12 21.4C6.2 17.6 1.6 13.9 1.6 8.6 1.6 5.2 4.2 2.6 7.4 2.6c1.9 0 3.6 1 4.6 2.6 1-1.6 2.7-2.6 4.6-2.6 3.2 0 5.8 2.6 5.8 6 0 5.3-4.6 9-10.4 12.8z";
  const heart = (cx, cy, size, fill = PINK, sw = 3) => {
    const k = size / 24;
    return `<path transform="translate(${+(cx - 12 * k).toFixed(2)} ${+(cy - 12 * k).toFixed(2)}) scale(${+k.toFixed(4)})" d="${HEART}" fill="${fill}" stroke="${INK}" stroke-width="${+(sw / k).toFixed(2)}"/>`;
  };

  /* ---------------- faces ---------------- */
  const dotEye = (cx, cy, rx, ry, glint = 1.5) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}"/>` +
    `<circle cx="${+(cx + rx * 0.36).toFixed(2)}" cy="${+(cy - ry * 0.4).toFixed(2)}" r="${glint}" fill="#fff"/>`;
  const happyEye = (cx, cy, w, lift, sw = 3) =>
    `<path d="M${cx - w} ${+(cy + lift * 0.35).toFixed(2)}Q${cx} ${cy - lift} ${cx + w} ${+(cy + lift * 0.35).toFixed(2)}" ${LINE(sw)}/>`;
  const heartEye = (cx, cy, size) => heart(cx, cy, size, PINK_D, 2.4) +
    `<path d="M${+(cx - size * 0.24).toFixed(2)} ${+(cy - size * 0.1).toFixed(2)}q.3-1.4 1.8-1.7" ${LINE(1.6, "#fff")}/>`;
  const blush = (cx, cy, rx = 4.6, ry = 2.7, o = 0.55) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${BLUSH}" opacity="${o}"/>`;
  // droopy upper lid for the sad face (side -1: outer corner on the left). `bg` = colour behind the eye
  const lid = (cx, cy, rx, ry, side, bg = SKIN) => {
    const r = (n) => +n.toFixed(2);
    const o = r(cx + side * (rx + 0.9)), i = r(cx - side * (rx + 0.9)), yo = r(cy - ry * 0.05), yi = r(cy - ry * 0.8), top = r(cy - ry - 1.6);
    return `<path d="M${o} ${yo}L${i} ${yi}V${top}H${o}Z" fill="${bg}"/><path d="M${o} ${yo}L${i} ${yi}" ${LINE(2.3)}/>`;
  };
  const tear = (x, y) => `<path d="M${x} ${y}q2.8 4.6 0 6.8q-2.8-2.2 0-6.8z" fill="${TEAR}" stroke="${INK}" stroke-width="1.9"/>`;

  // HIM: eyes sit behind the glasses, mouth under them
  function faceHim(mood) {
    const EL = 24.1, ER = 47.9, EY = 50.2, BY = 63.2;
    // the lens tint is lighter than skin, so the sad lids use a matching tint
    const LID_BG = "#F6E4EA";
    switch (mood) {
      case "happy":
        return happyEye(EL, EY + 1, 4.2, 5) + happyEye(ER, EY + 1, 4.2, 5) + blush(18.6, BY) + blush(53.4, BY) +
          `<path d="M29.4 63.4Q36 74 42.6 63.4Z" fill="${INK}" ${S(2.4)}/><path d="M32.6 68Q36 71 39.4 68Q36 66.2 32.6 68Z" fill="${PINK}"/>`;
      case "sad":
        return dotEye(EL, EY + 1, 3.4, 4, 1.3) + lid(EL, EY + 1, 3.4, 4, -1, LID_BG) + dotEye(ER, EY + 1, 3.4, 4, 1.3) + lid(ER, EY + 1, 3.4, 4, 1, LID_BG) +
          `<path d="M18.8 39L27.2 36.8" ${LINE(2.8)}/><path d="M53.2 39L44.8 36.8" ${LINE(2.8)}/>` +
          blush(18.6, BY, 4.2, 2.4, 0.4) + blush(53.4, BY, 4.2, 2.4, 0.4) +
          `<path d="M31.4 68.2Q33.6 64.6 36 66.4Q38.4 64.6 40.6 68.2" ${LINE(2.8)}/>` + tear(55.4, 60.2);
      case "wow":
        return `<circle cx="${EL}" cy="${EY}" r="4.4" fill="${INK}"/><circle cx="${EL + 1.5}" cy="${EY - 1.6}" r="1.6" fill="#fff"/>` +
          `<circle cx="${ER}" cy="${EY}" r="4.4" fill="${INK}"/><circle cx="${ER + 1.5}" cy="${EY - 1.6}" r="1.6" fill="#fff"/>` +
          `<path d="M19.2 38.6Q23.6 35.6 28 38.2" ${LINE(2.6)}/><path d="M52.8 38.6Q48.4 35.6 44 38.2" ${LINE(2.6)}/>` +
          blush(18.6, BY) + blush(53.4, BY) +
          `<ellipse cx="36" cy="66.4" rx="3.4" ry="4.2" fill="${INK}"/>`;
      case "love":
        return heartEye(EL, EY, 12) + heartEye(ER, EY, 12) + blush(18.6, BY, 5.2, 3, 0.7) + blush(53.4, BY, 5.2, 3, 0.7) +
          `<path d="M30 63.6Q36 72.4 42 63.6Z" fill="${INK}" ${S(2.4)}/><path d="M33 67.6Q36 70 39 67.6Q36 66.2 33 67.6Z" fill="${PINK}"/>`;
      default:
        return dotEye(EL, EY, 3.3, 4.1) + dotEye(ER, EY, 3.3, 4.1) + blush(18.6, BY) + blush(53.4, BY) +
          `<path d="M31.6 64.6Q36 69.2 40.4 64.6" ${LINE(2.8)}/>`;
    }
  }

  // HER: big shiny eyes + her signature bright smile
  function faceHer(mood) {
    const C = 91.5, EL = 83, ER = 100, EY = 59.8, MY = 67.8, BL = 78.2, BR = 104.8, BY = 68.6;
    const bigEye = (cx, cy) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="3.9" ry="4.9" fill="${INK}"/>` +
      `<circle cx="${cx + 1.4}" cy="${cy - 1.9}" r="1.7" fill="#fff"/><circle cx="${cx - 1.3}" cy="${cy + 2}" r=".85" fill="#fff"/>`;
    const smileTeeth = (w, depth) => {
      const r = (n) => +n.toFixed(2);
      return `<path d="M${r(C - w)} ${MY}Q${C} ${r(MY + depth)} ${r(C + w)} ${MY}Z" fill="${INK}" ${S(2.4)}/>` +
        `<path d="M${r(C - w + 1.5)} ${r(MY + 0.9)}Q${C} ${r(MY + 2.5)} ${r(C + w - 1.5)} ${r(MY + 0.9)}L${r(C + w - 2.4)} ${r(MY + 2.3)}Q${C} ${r(MY + 3.9)} ${r(C - w + 2.4)} ${r(MY + 2.3)}Z" fill="#fff"/>` +
        `<path d="M${r(C - w * 0.42)} ${r(MY + depth * 0.64)}Q${C} ${r(MY + depth * 0.36)} ${r(C + w * 0.42)} ${r(MY + depth * 0.64)}Q${C} ${r(MY + depth * 0.5 + 1.4)} ${r(C - w * 0.42)} ${r(MY + depth * 0.64)}Z" fill="${PINK}"/>`;
    };
    switch (mood) {
      case "happy":
        return happyEye(EL, EY + 1, 4.4, 5.4) + happyEye(ER, EY + 1, 4.4, 5.4) +
          blush(BL, BY) + blush(BR, BY) + smileTeeth(7, 11);
      case "sad":
        return dotEye(EL, EY + 1, 3.7, 4.5, 1.4) + lid(EL, EY + 1, 3.7, 4.5, -1) + dotEye(ER, EY + 1, 3.7, 4.5, 1.4) + lid(ER, EY + 1, 3.7, 4.5, 1) +
          `<path d="M78.6 51.6L86.8 49.2" ${LINE(2.6)}/><path d="M104.4 51.6L96.2 49.2" ${LINE(2.6)}/>` +
          blush(BL, BY, 4.2, 2.4, 0.4) + blush(BR, BY, 4.2, 2.4, 0.4) +
          `<path d="M87.2 72.6Q89.4 69 91.5 70.8Q93.6 69 95.8 72.6" ${LINE(2.8)}/>` + tear(104.2, 64.6);
      case "wow":
        return `<circle cx="${EL}" cy="${EY}" r="4.8" fill="${INK}"/><circle cx="${EL + 1.6}" cy="${EY - 1.8}" r="1.8" fill="#fff"/><circle cx="${EL - 1.4}" cy="${EY + 2}" r=".85" fill="#fff"/>` +
          `<circle cx="${ER}" cy="${EY}" r="4.8" fill="${INK}"/><circle cx="${ER + 1.6}" cy="${EY - 1.8}" r="1.8" fill="#fff"/><circle cx="${ER - 1.4}" cy="${EY + 2}" r=".85" fill="#fff"/>` +
          `<path d="M79 50.4Q83 47.6 87 50" ${LINE(2.5)}/><path d="M104 50.4Q100 47.6 96 50" ${LINE(2.5)}/>` +
          blush(BL, BY) + blush(BR, BY) +
          `<ellipse cx="${C}" cy="70.8" rx="3.4" ry="4.3" fill="${INK}"/>`;
      case "love":
        return heartEye(EL, EY, 12) + heartEye(ER, EY, 12) + blush(BL, BY, 5.2, 3, 0.7) + blush(BR, BY, 5.2, 3, 0.7) +
          smileTeeth(6.4, 10);
      default:
        return bigEye(EL, EY) + bigEye(ER, EY) + blush(BL, BY) + blush(BR, BY) + smileTeeth(6, 8.8);
    }
  }

  // small mood extras floating between the two heads (inside .m-face so setMood swaps them)
  function extras(mood) {
    switch (mood) {
      case "love":
        return heart(70.4, 20, 16) + `<path d="M65.6 16.9q1.1-2.2 3.3-2.4" stroke="#fff" stroke-width="2" fill="none"/>` +
          heart(80, 9.2, 9, "#FFA3C2", 2.4);
      case "wow":
        return `<path d="M72.2 12.4v6.6M66.4 16l3 4M78 16l-3 4" ${LINE(2.8)}/>`;
      case "happy":
        return `<path d="M71.6 11.8l1.7 3.8 3.8 1.7-3.8 1.7-1.7 3.8-1.7-3.8-3.8-1.7 3.8-1.7z" fill="#FFE27A" ${S(2)}/>`;
      case "sad": // a little rain cloud over them
        return `<path d="M69.6 21.2a4.2 4.2 0 0 1 .4-8.4a5.8 5.8 0 0 1 11-1.6a4.6 4.6 0 0 1 1.8 10Z" fill="${CLOUD}" ${S(2.6)}/>` +
          `<path d="M72.4 15.2q1.4-1.6 3.4-1.4" ${LINE(2, "#fff")}/>` +
          `<path d="M72.6 25.2l-1 2.4M79.4 25.2l-1 2.4" ${LINE(2.4, "#6FBDEB")}/>`;
      default: // idle: the old heart buddy lives on as a tiny heart between them
        return heart(71.2, 18, 11, PINK, 2.4);
    }
  }

  function face(mood) {
    return `<g transform="${HIM_HEAD_T}">${faceHim(mood)}</g><g transform="${HER_TILT}">${faceHer(mood)}</g>${extras(mood)}`;
  }

  /* ---------------- static body parts ---------------- */
  // feet: each character's left / right foot in its own group for the walk cycle
  const himFeet =
    `<g class="m-foot m-foot-l"><ellipse cx="25.4" cy="114.4" rx="8" ry="4.9" fill="#fff" ${S(3.2)}/><path d="M19.4 115.8H31.4" stroke="${SHIRT}" stroke-width="2.2"/></g>` +
    `<g class="m-foot m-foot-r"><ellipse cx="46.6" cy="114.4" rx="8" ry="4.9" fill="#fff" ${S(3.2)}/><path d="M40.6 115.8H52.6" stroke="${SHIRT}" stroke-width="2.2"/></g>`;
  // her flats peek out in front of the hem, so they visibly step when walking
  const herFeet =
    `<g class="m-foot m-foot-l"><ellipse cx="84.4" cy="118.6" rx="6.2" ry="3.7" fill="${SHOE_HER}" ${S(3.1)}/></g>` +
    `<g class="m-foot m-foot-r"><ellipse cx="98.6" cy="118.6" rx="6.2" ry="3.7" fill="${SHOE_HER}" ${S(3.1)}/></g>`;

  // --- HIM (centre x = 36) ---
  const himBody =
    // arms: outer arm hangs, inner arm reaches for her hand
    limb("M15.4 81.6L12.6 93.4M56 82L62 99.6", SKIN, 6.2) +
    // two-tone watch on the hand-holding wrist
    `<path d="M56.9 93.5L62.3 91.7" stroke="${INK}" stroke-width="6"/>` +
    `<path d="M57.3 93.37L61.9 91.83" stroke="${GOLD}" stroke-width="2.4"/>` +
    // legs
    limb("M27 103.4V110.4M45 103.4V110.4", SKIN, 5.6, 3.1) +
    himFeet +
    // shorts (white trim at the hem)
    `<path d="M19.6 93.6H52.4L54.3 103.4Q54.5 106.2 51.7 106.2H39.6Q37 106.2 36.7 103.8L36 99 35.3 103.8Q35 106.2 32.4 106.2H20.3Q17.5 106.2 17.7 103.4Z" fill="${SHIRT}" ${S()}/>` +
    `<path d="M18.2 101.8H35.6M36.4 101.8H53.8" stroke="${INK}" stroke-width="2.2"/>` +
    `<path d="M19.8 103.6H33.4M38.6 103.6H52.2" stroke="#fff" stroke-width="2.2"/>` +
    // sleeves
    `<path d="M23.4 70.4C16.8 71.4 12.8 76 11.8 83.4L21.4 85.6ZM48.6 70.4C55.2 71.4 59.2 76 60.2 83.4L50.6 85.6Z" fill="${SHIRT}" ${S()}/>` +
    `<path d="M12.6 80.2L20.8 82.2M59.4 80.2L51.2 82.2" stroke="#fff" stroke-width="2.4"/>` +
    // rounded shirt body
    `<path d="M20.4 74.6Q20.8 70.2 26 69.8H46Q51.2 70.2 51.6 74.6L54 91.8Q54.4 96.2 50.2 96.2H21.8Q17.6 96.2 18 91.8Z" fill="${SHIRT}" ${S()}/>` +
    // print: faint checker on the left, a white baroque scroll on the right (as on the real shirt)
    `<path d="M22.4 78.4h3.8v3.8h-3.8zM26.2 82.2h3.8v3.8h-3.8zM22.4 86h3.8v3.8h-3.8zM30 86h3.8v3.8h-3.8z" fill="${SHIRT_HI}"/>` +
    `<path d="M41 89.4c-1.2-4.4 1.8-8.6 6-8c3.4.5 4 4.8 1 5.6c-1.8.4-3-1-2-2.4" stroke="#fff" stroke-width="2.2" fill="none"/>` +
    // white hem band
    `<path d="M18.3 91H53.7L54 91.8Q54.4 96.2 50.2 96.2H21.8Q17.6 96.2 18 91.8Z" fill="#fff" stroke="${INK}" stroke-width="2.4"/>` +
    // placket
    `<path d="M36 82V91" stroke="${INK}" stroke-width="5.2" stroke-linecap="butt"/><path d="M36 82V91" stroke="#fff" stroke-width="1.8" stroke-linecap="butt"/>` +
    // open neck + camp collar
    `<path d="M29.6 69.4L36 80.4L42.4 69.4Z" fill="${SKIN}"/>` +
    `<path d="M23.4 70.6L36 84.4L48.6 70.6L42.8 69.8L36 79.8L29.2 69.8Z" fill="#fff" ${S(2.6)}/>`;

  const himHead =
    // ears
    `<circle cx="11.6" cy="53.4" r="5.4" fill="${SKIN}" ${S(3.2)}/><path d="M10.2 51.4q2.4 1.6 1 4" ${LINE(1.8, SKIN_SH)}/>` +
    `<circle cx="60.4" cy="53.4" r="5.4" fill="${SKIN}" ${S(3.2)}/><path d="M61.8 51.4q-2.4 1.6-1 4" ${LINE(1.8, SKIN_SH)}/>` +
    // head
    `<ellipse cx="36" cy="49.2" rx="25.4" ry="24.6" fill="${SKIN}" ${S()}/>` +
    // lilac lens tint (his lenses are purple-tinted) sits UNDER the eyes, so they stay crisp
    `<path d="M14.6 42.6h19v14.6h-19zM38.4 42.6h19v14.6h-19z" fill="${LENS}" opacity=".7"/>` +
    // short textured crop: soft tufts on top, short sides, scalloped fringe
    `<path d="M10.8 48.6C9.4 38.6 10.4 26.4 15.8 18.2Q18.6 19.4 20.6 17.2Q21.2 11.4 27.4 10.2Q28.8 12.6 30.4 12.8Q32.6 7.8 38.6 7.8Q39.4 10.4 40.8 11.4Q44.6 7.8 50.2 9.6Q50.4 12.2 51.6 13.4Q56.4 12.6 58.6 16C62.6 25 63 37.6 61.2 48.6H58.6Q58.4 40.2 55 34.2Q50.4 36.4 46.2 32.4Q41.2 35.6 36 32Q30.8 35.6 25.8 32.4Q21.6 36.4 17 34.2Q13.6 40.2 13.4 48.6Z" fill="${HAIR_HIM}" ${S()}/>` +
    `<path d="M20.6 22.4Q24.6 17.8 29.4 18M40.4 16.4Q44.4 14.2 48.4 15.8" ${LINE(2.4, HAIR_HIM_HI)}/>`;

  // his signature thick black square glasses, drawn above the face so the eyes sit behind the lenses
  const himGlasses =
    `<path d="M14.6 47.2L10 46.2M57.4 47.2L62 46.2" stroke="${FRAME}" stroke-width="3.4"/>` +
    `<path d="M18.6 42.6h11a4 4 0 0 1 4 4v6.6a4 4 0 0 1-4 4h-11a4 4 0 0 1-4-4v-6.6a4 4 0 0 1 4-4zM42.4 42.6h11a4 4 0 0 1 4 4v6.6a4 4 0 0 1-4 4h-11a4 4 0 0 1-4-4v-6.6a4 4 0 0 1 4-4z" fill="none" stroke="${FRAME}" stroke-width="4.2"/>` +
    `<path d="M33.4 47.4Q36 45.2 38.6 47.4" stroke="${FRAME}" stroke-width="3.8" fill="none"/>` +
    `<path d="M17.8 50.6Q17.8 46.4 21 45.8M41.6 50.6Q41.6 46.4 44.8 45.8" stroke="#fff" stroke-width="1.8" fill="none" opacity=".85"/>`;

  // --- HER (centre x = 91.5) ---
  // Tóc layer: khối sau dày đuôi gợn sóng, ngôi lệch, mái dài hai bên ôm mặt
  const HER_BACK =
    "M91.5 27.6C105.6 27.6 116.2 36.4 117.2 50.6C117.8 58.4 115.4 62.4 116.6 68.6C118 75.6 115 80.4 116 88" +
    "C116.6 92.4 114.6 96.6 112 100.2Q110.4 103.4 107.4 101Q105 104.6 101.6 101.4Q98.4 105.2 95.2 101.6" +
    "Q91.5 105.6 87.8 101.6Q84.6 105.2 81.4 101.4Q78 104.6 75.6 101Q72.6 103.4 71 100.2" +
    "C68.4 96.6 66.4 92.4 67 88C68 80.4 65 75.6 66.4 68.6C67.6 62.4 65.2 58.4 65.8 50.6C66.8 36.4 77.4 27.6 91.5 27.6Z";
  // chỏm tóc ôm đỉnh đầu, cùng tông với tóc (bóng chân tóc vẽ riêng cho đỡ bị 2 tông)
  const HER_CAP =
    "M66.8 60C65.2 42.4 76.4 29.8 91.5 29.8C106.6 29.8 117.8 42.4 116.2 60C115 51.6 110.8 45.8 104 42.8" +
    "C99 40.6 93.8 39.6 88.4 40.2C82.4 40.8 76.4 43 72.2 47.2C69.2 50.2 67.6 55 66.8 60Z";
  // mái rẽ ngôi lệch: hai lọn dày vuốt từ ngôi xuống hai bên thái dương
  const BANG_L =
    "M88.8 36.4C81.4 37.4 74.8 41.6 70.9 48.6C68.8 52.4 68 57 68.6 61.4Q71.8 62.4 73 58" +
    "C74.2 52.8 76.4 48.6 80.6 45.6C83.8 43.4 87 42.2 90.2 42Q91.4 38.8 88.8 36.4Z";
  const BANG_R =
    "M90.2 36.2C98.4 36.6 106.6 40.4 111.6 47.4C113.9 50.7 115 54.6 114.9 58.6Q111.8 59.6 110.8 55.4" +
    "C109.5 50.4 106.6 46.4 102 43.8C98.2 41.6 94 40.6 90.4 41.2Q88.6 38.6 90.2 36.2Z";
  // lọn tóc trước ôm mặt, cắt tầng nên mép trong có bậc
  const FRONT_L =
    "M72.4 47.2C69.6 54.6 70.8 61 69.8 67C68.8 73 70.8 77.4 69.8 83.2C69 87.8 70.2 91.4 68.4 95.8" +
    "C73 93 74.8 88.4 74.8 83.8C74.8 78.8 76.8 75 77.2 70C77.6 64.6 76.6 59.8 77.6 54.6C78.4 50.4 80 46.6 82 43.2Z";
  const FRONT_R =
    "M111.6 46C114.2 53.4 112.8 59.4 113.6 65.4C114.4 71 112.6 75.2 113.4 80.6C114 84.6 113 87.8 114.4 91.6" +
    "C110.2 89 108.8 84.8 108.8 80.2C108.8 75.4 107.2 72 106.8 67.2C106.4 62 107.2 57.6 106.2 52.6" +
    "C105.4 48.4 103.8 44.8 102 41.8Z";
  const herHairBack = `<path d="${HER_BACK}" fill="${HAIR_HER}" ${S(3.4)}/>` +
    `<path d="M104.4 44.6C108.6 52.6 106.8 60.4 108 68.4C109 75.4 107 81 108.4 89" ${LINE(2.4, HAIR_HER_HI)}/>` +
    `<path d="M76.6 47.4C73.4 54.6 75 61.4 74 68.6" ${LINE(2.2, HAIR_HER_HI)}/>`;
  const herHairFront =
    `<path d="${HER_CAP}" fill="${HAIR_HER}" ${S()}/>` +
    `<path d="M74.6 38.6C80.4 33.4 88 31 95.6 31.6C102 32.2 107.6 35 111.6 39.4C106 36.4 100 34.8 93.6 35C86.8 35.2 80.2 36.6 74.6 38.6Z" fill="${HAIR_HER_TOP}"/>` +
    `<path d="${BANG_L}" fill="${HAIR_HER}" ${S(3.2)}/>` +
    `<path d="${BANG_R}" fill="${HAIR_HER}" ${S(3.2)}/>` +
    `<path d="${FRONT_L}" fill="${HAIR_HER}" ${S(3.2)}/>` +
    `<path d="${FRONT_R}" fill="${HAIR_HER}" ${S(3.2)}/>` +
    `<path d="M95.6 39.6Q104 42 108.8 48.4" ${LINE(2.2, HAIR_HER_HI)}/>` +
    `<path d="M79.8 43.4Q75.6 46.6 73.6 51.4" ${LINE(2, HAIR_HER_HI)}/>`;

  const herBody =
    // long flowy skirt with a soft wavy hem
    `<path d="M80.4 92.6H102.6C105 99.4 107.8 106 110.6 113C111.6 116 110 117.8 107.2 117.6C104.8 118.8 102.4 118.8 99.8 117.6C97 118.8 93.9 118.8 91.5 117.6C89.1 118.8 86 118.8 83.2 117.6C80.6 118.8 78.2 118.8 75.8 117.6C73 117.8 71.4 116 72.4 113C75.2 106 78 99.4 80.4 92.6Z" fill="#fff" ${S()}/>` +
    `<path d="M86 98L83.6 113.4M91.5 98V114M97 98L99.4 113.4" stroke="${DRESS_SH}" stroke-width="2.6"/>` +
    herFeet +
    // bare shoulders + fitted bodice
    `<path d="M81.2 78.4Q91.5 74.4 101.8 78.4L103 94.2Q91.5 96.4 80 94.2Z" fill="${SKIN}" ${S()}/>` +
    `<path d="M80.5 86.2Q86 84 91.5 89Q97 84 102.5 86.2L103 94.2Q91.5 96.4 80 94.2Z" fill="#fff" ${S(2.8)}/>` +
    `<path d="M85.8 89.8V93.8M97.2 89.8V93.8" stroke="${DRESS_SH}" stroke-width="2.2"/>` +
    // thin tie straps
    `<path d="M83.8 85.8L84.2 78.4M99.2 85.8L98.8 78.4" stroke="${INK}" stroke-width="4.4"/>` +
    `<path d="M83.8 85.6L84.2 78.6M99.2 85.6L98.8 78.6" stroke="#fff" stroke-width="1.8"/>` +
    // delicate necklace
    `<path d="M87.4 79.6Q91.5 83.4 95.6 79.6" stroke="${GOLD}" stroke-width="1.4" fill="none"/><circle cx="91.5" cy="82.4" r="1.4" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>`;

  const herHead =
    `<ellipse cx="91.5" cy="57" rx="23.8" ry="22.8" fill="${SKIN}" ${S()}/>` +
    herHairFront;

  // her arms sit in front of her hair: inner arm reaches for his hand, outer arm hangs
  const herArms =
    limb("M81.2 83.2L67.4 100.4M101.8 83.2L108.4 96.6", SKIN, 5.6, 3.2);

  // clasped hands: his mitt behind, hers wrapped over it
  const hands =
    `<circle cx="62.4" cy="102.4" r="5" fill="${SKIN}" ${S(3.2)}/>` +
    `<circle cx="66.9" cy="100.8" r="4.8" fill="${SKIN}" ${S(3.2)}/>` +
    `<path d="M64.4 103.6q2.4 1.2 4.4-.4" ${LINE(1.8, SKIN_SH)}/>`;

  const BACK =
    `<g transform="${HIM_BODY_T}">${himBody}</g><g transform="${HIM_HEAD_T}">${himHead}</g>` +
    `<g transform="${HER_TILT}">${herHairBack}</g>` + herBody + `<g transform="${HER_TILT}">${herHead}</g>` + herArms + hands;
  const FRONT = `<g transform="${HIM_HEAD_T}">${himGlasses}</g>`;

  function mascotSVG(mood = "idle") {
    return `<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false"><g class="m-duo" transform="translate(-1.4 .8)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">` +
      BACK + `<g class="m-face">${face(mood)}</g>` + FRONT + `</g></svg>`;
  }

  window.Mascot = {
    svg: mascotSVG,
    // Returns a .mascot element. Uses CONFIG.art.mascot image when provided.
    el(mood = "idle", opts = {}) {
      const { size = 96, bob = false, cls = "" } = opts;
      const art = window.CONFIG && CONFIG.art && CONFIG.art.mascot;
      const el = h("div.mascot" + (art ? "" : ".mascot--duo") + (bob ? ".mascot--bob" : "") + (cls ? "." + cls.split(" ").join(".") : ""), {
        style: { "--size": typeof size === "number" ? size + "px" : size },
        dataset: { mood },
      });
      if (art) {
        const im = h("img", { src: art, alt: "", draggable: "false" });
        // Ảnh tự vẽ bị thiếu / sai đường dẫn: quay về cặp đôi SVG có sẵn (vẫn đổi được nét mặt)
        im.addEventListener("error", () => { el.classList.add("mascot--duo"); el.innerHTML = mascotSVG(el.dataset.mood || mood); }, { once: true });
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
})();
