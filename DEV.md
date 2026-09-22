# DEV.md · Kiến trúc kỹ thuật

Tài liệu cho người sửa code. Muốn đổi nội dung (câu hỏi, ảnh, lời chúc) thì chỉ cần sửa `js/config.js`, xem README.md.

## Tổng quan

- HTML/CSS/JS thuần, **không có bước build**, chạy được khi mở trực tiếp file hoặc host trên GitHub Pages.
- Script cổ điển (không dùng ES module) nạp theo thứ tự trong `index.html`:
  `config.js → core.js → ui.js → levels/*.js → finale.js → game.js` (game.js khởi động cuối cùng).
- Mobile-first: cột `.stage` rộng tối đa 520px ở giữa màn hình, phía sau là nền `.scene` phủ toàn màn hình.

## Phong cách hình ảnh (bắt buộc giữ đồng bộ)

Game 2D kiểu Angry Birds, tông **mint + hồng pastel**.

- Viền đậm màu `--ink` (#3A2340) dày 3 đến 4px trên mọi thứ tương tác: nút, thẻ, khung.
- Nút "chunky": gradient sáng ở trên và tối ở dưới, vệt bóng trắng, đế `0 6px 0 var(--ink)`, bấm vào thì lún xuống.
- Chữ tiêu đề: font `Sigmar` (`--font-display`), trắng có viền mực qua class `.t-stroke-sm`, `.t-stroke` hoặc `.t-stroke-lg`.
- Chữ thường: `Baloo 2` (`--font-body`), đậm 700 đến 800.
- Bo góc "méo" kiểu vẽ tay: `--r-wobble`, `--r-wobble-sm`, `--r-panel`.
- Chỉ dùng màu từ token trong `css/base.css` (`--pink-*`, `--mint-*`, `--butter-*`, `--coral-*`, `--lilac-200/300/500`, `--sky-*`, `--cream`, `--muted`).
- **Khung ảnh luôn dọc 9:16** (màn 2, thẻ màn 3, bảng ghép màn 4, polaroid màn cuối): `aspect-ratio: 9 / 16`, ảnh `object-fit: cover` (hoặc `background-size: cover`) với `object-position: 50% 30%` để giữ mặt người ở giữa phía trên. Khi chiều cao là giới hạn thì tính kích thước theo chiều cao (`cqh`) để không phải cuộn trang ở 390x844, 375x560, 1440x900.
- Không dùng emoji trong giao diện, chỉ dùng icon SVG (`Icons.*`, `Badges.*`, `Mascot`).
- Copy tiếng Việt, xưng "anh/em", không dùng dấu gạch ngang dài (—).

### Class dùng lại được (định nghĩa trong css/base.css)

| Class | Dùng cho |
| --- | --- |
| `.btn` + `.btn--mint/--butter/--coral/--lilac/--cream` + `.btn--lg/--sm` + `.btn--round/--square` + `.btn--xs` + `.btn--block` | Nút chunky (nên tạo bằng `UI.button`) |
| `.panel`, `.panel--pink/--mint/--white` | Khung kem có viền |
| `.plate`, `.plate--mint/--butter/--coral/--lilac`, `.plate--lg` | Bảng tên nghiêng (nên tạo bằng `UI.plate`) |
| `.chip` | Nhãn tròn nhỏ (ví dụ "Câu 1/3") |
| `.choices` > `.choice` > `.choice__key` + `.choice__text`; trạng thái `.is-correct`, `.is-wrong`, `.is-dim`, `:disabled` | Nút đáp án cho câu đố và đoán ảnh |
| `.t-stroke-sm/.t-stroke/.t-stroke-lg`, `.t-display` | Chữ có viền, chữ display |
| `.t-shake.is-shaking` (dùng qua `UI.shake(el)`) | Rung khi sai |
| `.img-missing` | Ô báo thiếu ảnh (tạo sẵn trong `UI.img`) |

Các token chuyển động của transitions-dev nằm trong khối `:root` đầu file base.css (modal, shake, success check, number pop-in, icon swap).

## Quy ước một màn chơi (Level)

Mỗi màn gồm **một file JS** `js/levels/<key>.js` và **một file CSS** `css/levels/<key>.css`. Mọi selector trong CSS phải có tiền tố `.level[data-level="<key>"]` hoặc class riêng `.<key>-*` để không đè lên màn khác.

```js
(function () {
  "use strict";
  window.Levels = window.Levels || {};
  window.Levels.memory = {
    // (tuỳ chọn) danh sách ảnh cần tải trước khi vào màn
    assets(data, config) { return data.photos; },
    // Bắt buộc. Vẽ vào ctx.root rồi trả về { destroy() } để dọn dẹp.
    start(ctx) {
      /* ... */
      return { destroy() { /* huỷ timer, listener, requestAnimationFrame */ } };
    },
  };
})();
```

### `ctx`: engine đưa cho màn chơi

| Thuộc tính | Ý nghĩa |
| --- | --- |
| `ctx.root` | `.level-body`: vùng vẽ màn chơi (flex column, `container-type: size`, nên dùng được `cqw`/`cqh`) |
| `ctx.data` | Config của màn này (`CONFIG.levels[key]`) |
| `ctx.config`, `ctx.text` | Toàn bộ CONFIG và `CONFIG.text` (lời thoại) |
| `ctx.index` | Số thứ tự màn (1 đến 5) |
| `await ctx.ready` | Promise xong khi hiệu ứng chuyển cảnh kết thúc. **Phải chờ trước khi đếm ngược hoặc chạy giờ.** |
| `ctx.alive` | `false` sau khi màn bị huỷ (thắng, hết mạng, rời màn). Kiểm tra sau mỗi `await`. |
| `ctx.lives` | Số mạng hiện tại |
| `await ctx.loseLife()` | Trừ 1 mạng (engine lo hiệu ứng HUD, âm thanh, rung). Trả `true` nếu còn sống; `false` nghĩa là hết mạng, engine đã huỷ màn và hiện modal "Hết mạng", màn phải dừng ngay. |
| `ctx.fail("timeout")` | Hết giờ hoặc thua: engine huỷ màn, trừ 1 mạng, hiện modal "Hết giờ" rồi **tự khởi động lại màn** (hoặc báo hết mạng). |
| `ctx.complete()` | Thắng: engine huỷ màn, tính sao (3 trừ số mạng mất ở màn này), hiện modal và quay về bản đồ. |
| `await ctx.countdown()` | Lớp phủ đếm ngược 3-2-1 "Bắt đầu!". Tab bị ẩn giữa chừng thì chờ tab hiện lại rồi đếm lại từ đầu; màn bị huỷ giữa chừng thì dừng ngay (không phát tiếng nữa), nhớ kiểm tra `ctx.alive` sau khi `await`. |
| `ctx.timer({ seconds, onEnd, onTick })` | Tạo thanh thời gian, tự gắn vào `ctx.timerSlot`, engine tự dừng khi huỷ màn. Trả về `{ start, pause, stop, remaining }`. Tự tạm dừng khi tab bị ẩn; gọi `start()` lúc tab đang ẩn thì giờ chỉ bắt đầu chạy khi tab hiện lại; mỗi khung hình trừ tối đa 250ms (máy lag không làm mất oan vài giây). |
| `ctx.setHint(text)` | Dòng gợi ý nhỏ dưới cùng màn hình |
| `ctx.onCleanup(fn)` | Đăng ký hàm dọn dẹp thêm |
| `ctx.sfx`, `ctx.fx`, `ctx.ui`, `ctx.core`, `ctx.mascot`, `ctx.icons`, `ctx.badges`, `ctx.music` | Tham chiếu tới các global bên dưới |

Vòng đời: engine dựng khung màn (tên màn, ô timer, body, hint) → gọi `start(ctx)` trong lúc màn hình còn bị che bởi hiệu ứng chuyển cảnh → `ctx.ready` resolve → màn chạy → màn gọi đúng **một** trong `complete()` hoặc `fail()` (hoặc `loseLife()` trả `false`) → engine gọi `destroy()`. Khi chơi lại, engine gọi `start` lần nữa trên DOM mới, nên đừng giữ trạng thái ở cấp module.

## Global helpers

- `Core`: `h(tag, props, ...children)` (ví dụ `h("div.card.is-on", { text, html, style, dataset, onClick })`), `sleep`, `shuffle`, `pick`, `rand`, `randInt`, `clamp`, `fmt("Màn {n}", {n})`, `replay(el, cls)`, `center(el)`, `vibrate`, `isVideo`, `reducedMotion()`, `preload(urls)`, `Store`.
- `UI`: `button(label, {tone, size, shape, icon, iconRight, block, onClick, sound, ariaLabel, cls})`, `plate(text, tone)`, `modal({...})`, `stars(n)`, `animateStars(el, n)`, `timer()`, `countdown()`, `float(text, x, y, tone)`, `floatAt(el, text, tone)` (tone: pink|mint|coral|butter; chữ tự kéo vào trong màn hình, câu dài tự xuống dòng), `shake(el)`, `successCheck()`, `digits(el, "12")`, `img(src, {alt, cls})` (tự hiện ô báo thiếu ảnh; tự dùng `<video muted loop playsinline>` cho .mp4), `hurtFlash()`, `heartsRow(n, max)`, `lifeIcon()`.
- `UI.modal` và phím Enter: Enter khi đang focus một nút trong modal thì bấm đúng nút đó (không ép thành nút đầu tiên); Enter khi không focus nút nào thì bấm nút đầu tiên; Enter giữ lâu (auto-repeat) hoặc bấm trong 250ms đầu sau khi modal mở thì bị bỏ qua. `Escape` đóng modal nếu `closable`.
- `Sfx`: `tap key back pop flip correct wrong match lifeLost star(i) win lose tick count go whoosh unlocked catch crack swap`, `tone(freq, dur, opts)`. Âm thanh tổng hợp bằng WebAudio, không cần file.
- `Fx`: `burst(x, y, {count, colors, shapes: ["heart","star","circle","rect"], speed, size, gravity})`, `burstAt(el, opts)`, `confetti({duration, count})`, `clear()` (xoá hạt đang bay và huỷ cả confetti chưa kịp rơi).
- `Icons`: chuỗi SVG (`heart heartFill star starFill lock check x soundOn soundOff clock backspace play refresh gift sparkle arrowRight image`) + `HEART_PATH`, `STAR_PATH` (viewBox 24).
- `Badges`: SVG minh hoạ 80x80 cho từng màn (`quiz blur memory puzzle hearts gift`).
- `Mascot`: `el(mood, {size, bob, cls})` với mood `idle | happy | sad | wow | love`, `setMood(el, mood)`, `svg(mood)`. Nếu `CONFIG.art.mascot` có ảnh thì tự dùng ảnh đó (ảnh lỗi thì tự quay về SVG, `setMood` vẫn đổi được nét mặt).
- `Music`: `play(src)` (gọi trong lượt chạm), `stop()`, `sync()`.

## Màn cuối (Finale)

`js/finale.js` định nghĩa `window.Finale = { start(ctx) → { destroy() } }` và `css/finale.css`. Engine gọi `destroy()` mỗi khi chuyển sang màn hình khác (kể cả nút dev Map/M1..M5) và khi chơi lại từ đầu. `ctx` gồm: `root`, `data` (= `CONFIG.finale`), `config`, `text`, `lives`, `maxLives`, `stars`, `totalStars`, `maxStars`, `days` (số ngày bên nhau hoặc `null`), các helper như trên, `playMusic()` (gọi trong lượt chạm), `restart()` (chơi lại từ đầu).

## Tham số URL để kiểm thử

- `?reset` xoá tiến trình đã lưu
- `?level=3` vào thẳng màn 3
- `?screen=map|lock|finale` mở thẳng một màn hình
- `?mute` tắt tiếng
- `?dev` hiện thanh công cụ dev (nhảy màn, thắng ngay, trừ mạng, mở quà)
- `?autoplay` giỏ ở màn 5 (Hứng tim) tự chạy, dùng cho test tự động

`window.Game` có `state`, `screen`, `run`, `launch(n)`, `showMap()`, `openGift()`, `complete()` để test tự động (`complete()` trả Promise chỉ xong khi modal được bấm, nên trong puppeteer gọi kiểu `page.evaluate(() => { Game.complete(); })`). Màn 4 trả thêm `Game.run.api.debug` (`solve()`, `swap(a, b)`, `state()`); thẻ màn 3 có `data-pair`, mảnh màn 4 có `data-piece`/`data-slot`.

Hộp "Qua màn": câu khen lấy từ `CONFIG.levels[key].doneBody` nếu có (tuỳ chọn), không có thì từ `CONFIG.text.levelDoneBody`.

## Ghi chú CSS dùng chung

- `.screen.is-active` chạy `screen-in` với `animation-fill-mode: backwards`: chạy xong thì màn hình không còn giữ `transform`, nên phần tử `position: fixed` bên trong (ví dụ nền tim ở màn cuối) phủ cả viewport chứ không bị nhốt trong cột 520px.
- Màn hình thấp (`max-height: 620px` / `640px`): màn khoá nén khoảng cách, thẻ màn ở bản đồ gọn một hàng (ẩn mô tả) để bản đồ đủ cao.
- `.nojekyll` ở thư mục gốc: GitHub Pages phục vụ file y nguyên, không chạy Jekyll.

## Tiến trình lưu ở đâu

`localStorage["hanh-trinh-cua-tui-minh-v1"]` gồm `{ unlocked, level, lives, stars[], lost[], seenRules, done, muted }`.
