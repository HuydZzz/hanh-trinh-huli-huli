# Hành trình Huli Huli

Một game nhỏ tặng người yêu dịp 20/10. Em mở link trên điện thoại, nhập mật mã, đi hết 5 màn chơi về kỉ niệm của hai đứa rồi mở món quà cuối cùng: lời chúc của anh và slideshow những tấm ảnh đẹp nhất.

Game viết bằng HTML/CSS/JS thuần, **không cần cài đặt hay build**, đưa thẳng lên GitHub Pages là chạy. Chơi tốt nhất trên điện thoại (màn hình dọc), trên máy tính dùng chuột và bàn phím cũng được.

**Mục lục**

1. [Giới thiệu và luồng game](#1-giới-thiệu-và-luồng-game)
2. [Chạy thử trên máy](#2-chạy-thử-trên-máy)
3. [Checklist nội dung cần thay](#3-checklist-nội-dung-cần-thay-trong-jsconfigjs)
4. [Chuẩn bị ảnh và video](#4-chuẩn-bị-ảnh-và-video)
5. [Hình tự vẽ (CONFIG.art)](#5-hình-tự-vẽ-configart)
6. [Đưa lên GitHub Pages](#6-đưa-lên-github-pages)
7. [Lưu ý quan trọng](#7-lưu-ý-quan-trọng)
8. [Gợi ý tặng quà](#8-gợi-ý-tặng-quà)

> Muốn đổi nội dung (câu hỏi, ảnh, lời chúc, nhạc) thì **chỉ cần sửa một file `js/config.js`**. Không phải đụng vào code khác. Tài liệu kỹ thuật cho người sửa code nằm ở `DEV.md`.

---

## 1. Giới thiệu và luồng game

### Luồng chơi

1. **Màn khoá:** nhập mật mã 4 số (ví dụ ngày yêu nhau). Sai 3 lần sẽ hiện câu gợi ý. Trên máy tính gõ số bằng bàn phím được.
2. **Luật chơi:** hiện một lần ở lần mở đầu tiên.
3. **Bản đồ 6 điểm:** điểm 1 đến 5 là 5 màn chơi, điểm 6 là món quà. Điểm đang sáng là màn tiếp theo, chạm vào để chơi. Qua màn nào thì màn sau mới mở.
4. **5 màn chơi:**

   | Màn | Tên | Cách chơi | Key trong config |
   | --- | --- | --- | --- |
   | 1 | Câu đố kỉ niệm | Trả lời 3 câu hỏi trắc nghiệm về hai đứa | `levels.quiz` |
   | 2 | Đoán ảnh mờ | Ảnh bị làm mờ, đoán xem chụp khi nào | `levels.blur` |
   | 3 | Lật thẻ | Lật tìm 10 cặp ảnh giống nhau trong 60 giây | `levels.memory` |
   | 4 | Ghép hình | Ghép lại bức ảnh bị xáo thành 9 mảnh trong 60 giây | `levels.puzzle` |
   | 5 | Hứng tim | Kéo giỏ hứng đủ 20 trái tim, né tim vỡ | `levels.hearts` |

5. **3 mạng cho cả hành trình:** trả lời sai hoặc hết giờ thì mất 1 mạng. Hết mạng thì được tặng lại đủ mạng và chơi lại màn đang chơi (đổi `onGameOver: "all"` nếu muốn bắt chơi lại từ màn 1).
6. **Sao:** mỗi màn tối đa 3 sao, mỗi mạng mất trong màn bớt 1 sao (ít nhất vẫn được 1 sao).
7. **Món quà (điểm 6):** màn "Hoàn thành nhiệm vụ!" với số sao, số mạng còn lại, số ngày bên nhau (chỉ hiện khi có `anniversary` đủ năm), lời chúc của anh. Bấm "Xem kỉ niệm" để mở slideshow ảnh đẹp nhất, chạy lặp liên tục (kèm nhạc nếu có). Chạm vào ảnh (hoặc bấm phím →) để xem ảnh tiếp; nút "Chơi lại từ đầu" luôn hỏi lại trước khi xoá tiến trình.
8. **Khung ảnh dọc 9:16:** mọi khung ảnh trong game (màn 2, thẻ màn 3, bảng ghép màn 4, slideshow cuối) đều là ảnh dọc tỉ lệ 9:16. Ảnh 3:4 hay 2:3 chụp bằng điện thoại sẽ được tự cắt bớt hai bên cho vừa khung, giữ phần mặt người ở khoảng giữa phía trên.

### Cấu trúc thư mục

```
Couple/
├── index.html              trang chính (chỉ sửa dòng og:image khi đưa lên mạng)
├── README.md               file bạn đang đọc
├── DEV.md                  ghi chú kỹ thuật cho người sửa code
├── .gitignore              không đẩy Image/, State/, Music/ (ảnh, nhạc gốc) lên GitHub
├── .nojekyll               để GitHub Pages phục vụ file y nguyên (không chạy Jekyll)
├── js/
│   ├── config.js           ✏️ TOÀN BỘ NỘI DUNG GAME: chỉ cần sửa file này
│   ├── core.js, ui.js      tiện ích, âm thanh, hiệu ứng, nút bấm
│   ├── game.js             màn khoá, bản đồ, mạng, luồng màn chơi
│   ├── finale.js           màn món quà + slideshow
│   └── levels/             5 màn chơi (quiz, blur, memory, puzzle, hearts)
├── css/                    giao diện (base.css, finale.css, levels/*.css)
├── assets/
│   ├── photos/
│   │   ├── man2/           3 ảnh cho màn 2 (đoán ảnh mờ)
│   │   ├── man3/           10 ảnh cho màn 3 (lật thẻ)
│   │   ├── man4/           1 ảnh cho màn 4 (ghép hình)
│   │   └── best/           9 ảnh đẹp nhất cho slideshow cuối
│   ├── art/                hình tự vẽ (nền, bản đồ, nhân vật...), đang trống
│   ├── music/              tung-ngay-yeu-em.mp3 (nhạc nền + nhạc màn cuối)
│   ├── cover.jpg           ảnh xem trước khi gửi link qua Messenger/Zalo
│   ├── apple-touch-icon.png  icon khi "Thêm vào màn hình chính" trên iPhone
│   └── favicon.svg
├── tools/
│   └── prepare-photos.sh   script đổi ảnh HEIC/JPG/PNG và video cho nhẹ
├── Image/, State/          ẢNH GỐC từ điện thoại (còn GPS): chỉ để trên máy, đã git-ignore
└── Music/                  file nhạc gốc: chỉ để trên máy, đã git-ignore
```

**Ảnh hiện tại đều là ảnh thật** đã xử lý sẵn: đổi sang JPG nhẹ, xoay đúng chiều, **đã xoá GPS**: `man2` (3 ảnh), `man3` (10 ảnh), `man4` (1 ảnh dọc) và `best` (9 ảnh dọc). Game chỉ dùng ảnh trong `assets/photos/`, không bao giờ đọc thư mục `Image/` hay `State/`. Đừng xoá, đừng đổi tên hai thư mục đó và **đừng bỏ các dòng `Image/`, `State/`, `Music/` trong `.gitignore`**, để ảnh gốc (có vị trí GPS) không bị đẩy lên mạng.

---

## 2. Chạy thử trên máy

**Cách 1 (nhanh nhất):** bấm đúp `index.html` để mở bằng trình duyệt. Cần có mạng để tải font chữ.

**Cách 2 (nên dùng, giống khi đưa lên mạng):** mở Terminal rồi chạy

```bash
cd "/Users/mac/Documents/Project Claude/Couple"
python3 -m http.server 8000
```

rồi vào **http://localhost:8000** . Bấm `Ctrl + C` trong Terminal để tắt.

**Thử trên điện thoại thật** (điện thoại và Mac dùng chung wifi):

```bash
python3 -m http.server 8000 --bind 0.0.0.0
ipconfig getifaddr en0        # in ra IP của Mac, ví dụ 192.168.1.23
```

Trên điện thoại mở `http://192.168.1.23:8000` (thay bằng IP vừa in ra).

### Tham số URL để kiểm tra nhanh

Thêm vào cuối địa chỉ, nhiều tham số thì nối bằng `&`, ví dụ `http://localhost:8000/?reset&level=3&dev`.

| Tham số | Tác dụng |
| --- | --- |
| `?dev` | Hiện thanh công cụ dev ở dưới cùng: Reset, Khoá, Map, M1 đến M5 (nhảy vào màn), Thắng (qua màn ngay), -1 mạng, Đầy mạng, Quà |
| `?reset` | Xoá tiến trình đã lưu, chơi lại từ màn khoá |
| `?level=3` | Vào thẳng màn 3 (thay số 1 đến 5) |
| `?screen=finale` | Mở thẳng màn món quà (cũng có `?screen=map` và `?screen=lock`) |
| `?mute` | Tắt tiếng |
| `?autoplay` | (chỉ để test) giỏ ở màn 5 tự chạy hứng tim |

### Xoá tiến trình

Game tự lưu tiến trình (màn đang chơi, số mạng, số sao) trong trình duyệt. Muốn chơi lại từ đầu thì chọn một trong các cách:

- Mở link có thêm `?reset`, ví dụ `http://localhost:8000/?reset`.
- Mở với `?dev` rồi bấm nút **Reset**.
- Chrome: DevTools (`Cmd + Option + I`) → Application → Local Storage → xoá mục `hanh-trinh-cua-tui-minh-v1`.
- Hoặc mở bằng cửa sổ ẩn danh.

> Mở `?screen=finale` sẽ đánh dấu là "đã chơi xong" trên trình duyệt đó, nên lần sau mở link thường sẽ vào thẳng màn món quà. Thử xong nhớ mở `?reset` một lần.

---

## 3. Checklist nội dung cần thay trong `js/config.js`

Mở `js/config.js` bằng VS Code hoặc bất kỳ trình soạn thảo nào. Chỗ nào có ✏️ là chỗ nên thay. Sửa xong lưu file rồi tải lại trang.

**Quy tắc nhỏ:** chữ luôn nằm trong ngoặc kép `"..."`, cuối mỗi dòng trong danh sách có dấu phẩy `,`, đường dẫn ảnh tính từ thư mục gốc (ví dụ `"assets/photos/man3/01.jpg"`, không có dấu `/` ở đầu).

### Mở khoá

- [ ] `passcode`: mật mã **đúng 4 chữ số**, để trong ngoặc kép, ví dụ yêu nhau ngày 14/02 thì ghi `"1402"`. Nhớ giữ ngoặc kép để số 0 ở đầu không bị mất (`"0503"`).
- [ ] `passcodeHint`: câu gợi ý hiện ra sau 3 lần nhập sai. Để `""` nếu không muốn gợi ý.
- [ ] `anniversary`: ngày yêu nhau theo dạng **năm-tháng-ngày**, ví dụ `"2024-07-23"`. Dùng để hiện "Tụi mình đã bên nhau ... ngày" ở màn cuối. Hiện đang để `""` (chưa có năm) nên màn cuối không hiện dòng số ngày; điền đủ năm là dòng đó tự hiện.
- [ ] (tuỳ chọn) `title`, `subtitle`: tên game và dòng chữ dưới tên. `lives`: số mạng. `onGameOver`: `"level"` hoặc `"all"`.

### Màn 1 · Câu đố (`levels.quiz`)

- [ ] Sửa từng câu trong `questions`: `q` là câu hỏi, `options` là các đáp án, `answer` là đáp án đúng, `note` là câu hiện ra sau khi trả lời đúng (không bắt buộc).
- [ ] **`answer` phải trùng Y HỆT một trong `options`**: cùng dấu, cùng chữ hoa chữ thường, không thừa dấu cách. Nếu `answer` để `""` hoặc gõ sai, game hiện dải cảnh báo vàng và câu đó **chấp nhận mọi đáp án** (không ai bị mất mạng oan), nên nhớ điền đúng trước khi gửi.

```js
{
  q: "Buổi hẹn đầu tiên tụi mình đã ăn gì?",
  options: ["Lẩu Thái", "Bún chả", "Pizza", "Sushi"],
  answer: "Lẩu Thái",            // phải giống hệt "Lẩu Thái" ở trên
  note: "Hôm đó em ăn cay đỏ cả mặt",
},
```

- `shuffleOptions: true` sẽ xáo thứ tự đáp án mỗi lần chơi.
- Thêm hoặc bớt câu hỏi được, nhưng nhớ sửa luôn dòng `desc` (đang ghi "3 câu hỏi").

### Màn 2 · Đoán ảnh mờ (`levels.blur`)

- [ ] 3 ảnh trong `photos`, mỗi ảnh gồm `src` (đường dẫn), `options`, `answer` (lại phải **trùng y hệt** một option) và `caption` (chú thích hiện ra sau khi đoán, không bắt buộc; để `""` thì nhân vật nói một câu khen ngẫu nhiên).
- [ ] `question`: câu hỏi chung, hiện đang là "Ảnh này chụp khi nào, ở đâu?".
- Ảnh hiện trong khung dọc 9:16. Mỗi lần đoán sai, ảnh rõ hơn một chút; đoán đúng thì ảnh rõ hẳn và to ra.

### Màn 3 · Lật thẻ (`levels.memory`)

- [ ] `photos`: **10 ảnh**, mỗi ảnh thành 1 cặp thẻ (20 thẻ úp).
- Mỗi lượt lật 2 thẻ. Lật trúng 2 ảnh giống nhau thì **cặp đó biến mất khỏi bàn** (để lại ô trống, các thẻ khác không xê dịch). Lật sai thì 2 thẻ tự úp lại, không mất mạng. Dọn sạch bàn trước khi hết giờ là qua màn.
- Thẻ là khung dọc 9:16, nên chọn ảnh dọc có mặt người ở khoảng giữa phía trên.
- `seconds`: thời gian chơi (mặc định 60 giây).

### Màn 4 · Ghép hình (`levels.puzzle`)

- [ ] `photo`: 1 **ảnh dọc** (3:4, 2:3 hoặc 9:16 đều được). Game tự cắt về khung dọc 9:16 (giữ phần giữa phía trên, chỗ thường có mặt người) rồi chia thành 9 mảnh dọc. Không cần cắt ảnh trước.
- `grid: 3` là 3x3 = 9 mảnh. Muốn khó hơn thì để 4 (16 mảnh) và tăng `seconds`, nhớ sửa `desc`.

### Màn 5 · Hứng tim (`levels.hearts`)

- [ ] `target`: số tim cần hứng (mặc định 20). Đổi số thì sửa luôn `desc` cho khớp.
- `brokenChance`: tỉ lệ rơi tim vỡ, từ 0 đến 1 (0.25 là khoảng 1/4).
- `speed`: tốc độ rơi, 1 là bình thường, 1.3 là nhanh hơn.

### Màn cuối · Món quà (`finale`)

- [ ] `message`: lời chúc. Xuống dòng bằng `\n`.
- [ ] `signature`: ký tên, ví dụ `"Anh"`.
- [ ] `photos`: những ảnh đẹp nhất, mỗi ảnh `{ src: "...", caption: "..." }`. Hiện có 9 ảnh và **caption đang để trống có chủ ý**: khi mọi caption trống, mỗi tấm polaroid chỉ có viền trắng mỏng ở dưới với một trái tim nhỏ (không có dải chữ trống). Muốn thêm chú thích thì điền vào `caption`; chỉ cần một ảnh có caption là mọi tấm sẽ có dải chú thích cho đều nhau. Dùng được cả video `.mp4` (phát không tiếng, hết video mới chuyển ảnh).
- Ảnh hiện trong khung polaroid dọc 9:16.
- `slideSeconds`: mỗi ảnh hiện bao lâu (giây).
- `title`: dòng chữ lớn, mặc định "Hoàn thành nhiệm vụ!".

### Nhạc (`music`, không bắt buộc)

- [ ] Bỏ file `.mp3` vào `assets/music/` rồi điền đường dẫn (hiện cả hai đều là `assets/music/tung-ngay-yeu-em.mp3`):
  - `game`: nhạc nền khi chơi, bắt đầu phát ngay sau khi nhập đúng mật mã.
  - `finale`: nhạc ở màn món quà, ví dụ bài hát của hai đứa. Cùng một bài với `game` thì nhạc chạy tiếp, không phát lại từ đầu.
  - `volume`: âm lượng nhạc nền từ 0 đến 1 (hiện 0.22, nhỏ thôi để không át tiếng hiệu ứng).
- Nên dùng mp3 128 kbps, mỗi bài khoảng 3 đến 5 MB.

### Lời thoại (`text`, tuỳ chọn)

Mọi câu chữ trong game (nút bấm, luật chơi, câu khen khi đúng...) nằm trong `text`. Sửa thoải mái, chỉ cần **giữ nguyên các chỗ trong ngoặc nhọn** như `{n}`, `{lives}`, `{days}` vì game tự điền số vào đó.

Câu khen trong hộp "Qua màn" được chọn ngẫu nhiên từ `text.levelDoneBody` cho mọi màn. Muốn một màn có câu riêng (ví dụ màn Hứng tim không hợp câu "Em nhớ hết luôn nè!") thì thêm `doneBody` vào màn đó, ví dụ trong `levels.hearts`: `doneBody: ["Khéo tay ghê!", "Hứng đủ tim rồi nè!"],`. Không thêm thì dùng câu chung.

### Dải cảnh báo màu vàng

Nếu config có lỗi, game hiện một **dải màu vàng ở trên cùng màn hình** ghi "Cần sửa file js/config.js:" kèm danh sách lỗi, ví dụ:

- `Màn 1, câu 2: "answer" không giống đáp án nào trong "options"`
- `Màn 2, ảnh 1: "answer" không giống đáp án nào trong "options"`
- `passcode phải gồm đúng 4 chữ số`
- `map.points cần đủ 6 điểm`

Sửa xong tải lại trang, dải vàng biến mất là ổn. Nếu một ảnh bị sai đường dẫn, trong game sẽ hiện ô "Không tìm thấy ảnh" ngay chỗ ảnh đó.

> Trước khi gửi, hãy tự chơi hết một lượt với `?reset` để chắc chắn không còn dải vàng và không có ô "Không tìm thấy ảnh" nào.

---

## 4. Chuẩn bị ảnh và video

Ảnh chụp từ iPhone thường là HEIC nặng 3 đến 5 MB. Nhiều trình duyệt (Chrome, điện thoại Android) không mở được HEIC, và ảnh nặng làm game tải chậm. Script `tools/prepare-photos.sh` lo phần này:

- Đổi ảnh `.heic .heif .jpg .jpeg .png .webp` thành **JPG**, cạnh dài nhất tối đa **1600px** (ảnh nhỏ hơn giữ nguyên, không phóng to), chất lượng khoảng 82.
- Tự xoay ảnh đúng chiều và **xoá thông tin vị trí GPS** trong ảnh (quan trọng vì trang web là công khai).
- Đổi video `.mov .mp4 .m4v` thành **MP4 720p (H.264 + AAC)**, tối đa 30 hình/giây, tối ưu để phát ngay khi đang tải. Cần cài ffmpeg: `brew install ffmpeg`. Chưa cài thì script chỉ báo và bỏ qua video.
- Đặt tên lần lượt `01.jpg`, `02.jpg`, `03.mp4`... theo **thứ tự tên file gốc** (`IMG_2` đứng trước `IMG_10`).
- Bỏ qua video của Live Photo (file `.MOV` trùng tên với ảnh) và các file không phải ảnh.
- **Không xoá, không sửa ảnh gốc.** Chỉ ghi file mới vào thư mục ra (tự tạo nếu chưa có).
- Cuối cùng in sẵn các dòng để dán thẳng vào `js/config.js`.

### Cách dùng

```bash
./tools/prepare-photos.sh <thư-mục-ảnh-gốc> <thư-mục-ra> [cạnh-dài-tối-đa=1600]
```

**Bước 1.** Gom ảnh gốc vào từng thư mục riêng, ví dụ trên Desktop: `man2` (3 ảnh), `man3` (10 ảnh), `man4` (1 ảnh), `best` (8 đến 15 ảnh/video). Muốn sắp thứ tự thì đổi tên ảnh gốc có số ở đầu, ví dụ `01 hen ho.heic`, `02 da lat.heic`.

**Bước 2.** Khi thay cả bộ ảnh của một màn, xoá ảnh cũ trong thư mục đích (`assets/photos/man2`, `man3`, `man4`, `best`) để khỏi lẫn với ảnh mới. Ảnh gốc nên để ngoài `assets/` (ví dụ `Image/`, `State/` hoặc Desktop); thư mục `Image/` và `State/` đã được git-ignore.

**Bước 3.** Chạy script cho từng thư mục (đứng ở thư mục gốc của game):

```bash
cd "/Users/mac/Documents/Project Claude/Couple"

# Màn 2: 3 ảnh đoán ảnh mờ
./tools/prepare-photos.sh ~/Desktop/man2 assets/photos/man2

# Màn 3: 10 ảnh lật thẻ (thẻ nhỏ nên 1000px là đủ, nhẹ hơn)
./tools/prepare-photos.sh ~/Desktop/man3 assets/photos/man3 1000

# Màn 4: 1 ảnh ghép hình
./tools/prepare-photos.sh ~/Desktop/man4 assets/photos/man4

# Màn cuối: ảnh + video đẹp nhất (cho nét hơn một chút)
./tools/prepare-photos.sh ~/Desktop/best assets/photos/best 1800
```

Đường dẫn có dấu cách thì bọc trong ngoặc kép: `"$HOME/Desktop/Anh dep nhat"`. Mẹo: gõ `./tools/prepare-photos.sh ` rồi **kéo thư mục từ Finder thả vào Terminal** để tự điền đường dẫn.

**Bước 4.** Copy các dòng script in ra và dán vào đúng chỗ trong `js/config.js`. Ví dụ với thư mục `best`:

```
  ✓ 01 hen ho.heic  ->  01.jpg  (1600x1200, 312 KB)
  ✓ 02 da lat.heic  ->  02.jpg  (1200x1600, 287 KB)
  ✓ 03 tet.MOV  ->  03.mp4  (4.1 MB)

Xong: 3 file mới, tổng 4.7 MB. Bỏ qua: 0 · Lỗi: 0
Ảnh gốc không bị thay đổi.

Dán vào js/config.js, mục finale.photos (màn cuối):
      { src: "assets/photos/best/01.jpg", caption: "" },
      { src: "assets/photos/best/02.jpg", caption: "" },
      { src: "assets/photos/best/03.mp4", caption: "" },
```

Script nhận ra tên thư mục ra để in đúng mẫu: `man2` in sẵn khung `options`/`answer` cho màn 2, `man3` in danh sách 10 đường dẫn, `man4` in dòng `photo:`, `best` in dạng `{ src, caption }`.

> Nếu báo `permission denied` thì chạy `chmod +x tools/prepare-photos.sh` một lần rồi thử lại.

### Chọn ảnh cho khung dọc 9:16

Mọi khung ảnh trong game là **ảnh dọc 9:16**, không cần tự cắt ảnh: game tự phóng cho kín khung và cắt bớt phần thừa hai bên (ảnh 3:4 hoặc 2:3) hay trên dưới. Phần được giữ lại là **giữa, lệch lên trên** (khoảng 30% từ mép trên), đúng chỗ mặt người trong ảnh chụp điện thoại. Vì vậy:

- Nên chọn ảnh **dọc**. Ảnh ngang vẫn chạy nhưng sẽ bị cắt mất nhiều hai bên.
- Người trong ảnh nên đứng giữa khung, mặt ở nửa trên, không sát mép trái/phải.
- Màn 4 (ghép hình) dùng 1 ảnh dọc bất kỳ, game tự cắt về 9:16 rồi chia 9 mảnh.

### Kích thước gợi ý

| Dùng cho | Số lượng | Cạnh dài | Dung lượng mỗi file |
| --- | --- | --- | --- |
| `man2` (đoán ảnh mờ) | 3 ảnh | 1600px (mặc định) | khoảng 200 đến 400 KB |
| `man3` (lật thẻ) | 10 ảnh | 1000px | khoảng 100 đến 200 KB |
| `man4` (ghép hình) | 1 ảnh dọc | 1600px | dưới 500 KB |
| `best` (slideshow) | 8 đến 15 ảnh dọc | 1600 đến 1800px | dưới 500 KB |
| Video trong `best` | vài clip | 720p | 5 đến 15 giây, dưới 10 MB |

Tổng cả game nên dưới khoảng 30 MB để em mở bằng 4G vẫn nhanh. Script sẽ cảnh báo nếu ảnh nào trên 1 MB hoặc video nào trên 20 MB.

**Về video:** video chỉ nên dùng ở slideshow cuối (`best`). Video phát không tiếng, hết video mới chuyển (dài quá 25 giây thì tự chuyển). Video HDR quay bằng iPhone có thể hơi nhạt màu sau khi đổi, script sẽ nhắc khi gặp.

---

## 5. Hình tự vẽ (`CONFIG.art`)

Mặc định game đã có sẵn hình vẽ (bầu trời, đồi cỏ, đảo bản đồ, nhân vật trái tim...). Muốn dùng hình tự vẽ thì bỏ file vào `assets/art/` rồi điền đường dẫn vào mục `art` trong `js/config.js`, ví dụ `map: "assets/art/map.png"`. Để `""` là dùng hình mặc định.

| Key | Hiện ở đâu | Kích thước gợi ý | Định dạng |
| --- | --- | --- | --- |
| `background` | Nền phía sau toàn bộ game, trên máy tính (và cả điện thoại nếu không có `backgroundMobile`) | 2400 x 1500 (ngang) | JPG, dưới 500 KB |
| `backgroundMobile` | Nền khi màn hình dọc (điện thoại) | 1242 x 2688 (dọc) | JPG, dưới 500 KB |
| `map` | Hình bản đồ có 6 điểm | 1080 x 1920 (dọc) | PNG nền trong suốt (hoặc JPG nếu vẽ kín khung) |
| `mascot` | Nhân vật chính: màn khoá, bản đồ, hộp thoại, màn cuối | 512 x 512 (vuông) | PNG nền trong suốt |
| `logo` | Thay chữ tên game ở màn nhập mật mã | khoảng 960 x 480 (ngang) | PNG nền trong suốt |
| `cardBack` | Mặt sau thẻ ở màn 3 (Lật thẻ) | 576 x 1024 (dọc 9:16, cùng tỉ lệ với thẻ) | PNG hoặc JPG |
| `catcher` | Cái giỏ hứng tim ở màn 5 | khoảng 480 x 320 (ngang), miệng giỏ ở khoảng 1/3 phía trên | PNG nền trong suốt |
| `heart` | Trái tim rơi ở màn 5 | 256 x 256 (vuông) | PNG nền trong suốt |
| `brokenHeart` | Trái tim vỡ ở màn 5 | 256 x 256 (vuông) | PNG nền trong suốt |

Mẹo:

- Nên vẽ cả `background` lẫn `backgroundMobile` để máy tính và điện thoại đều đẹp.
- Khi dùng ảnh `mascot`, nhân vật sẽ không đổi nét mặt (vui, buồn, ngạc nhiên) như nhân vật mặc định nữa. Nếu đường dẫn ảnh bị sai, game tự quay về nhân vật trái tim có sẵn.
- Xuất PNG ở đúng kích thước gợi ý, đừng xuất 4000px, file sẽ rất nặng.

### Chỉnh vị trí 6 điểm trên bản đồ tự vẽ

Game tự lấy tỉ lệ khung bản đồ theo ảnh `map` của bạn. Vị trí 6 điểm nằm trong `map.points`, tính theo **phần trăm** của khung bản đồ:

- `x`: 0 là mép trái, 100 là mép phải.
- `y`: 0 là mép trên, 100 là mép dưới.
- Thứ tự từ điểm 1 đến điểm 6, **điểm 6 luôn là món quà**. Phải có đủ 6 điểm.

Cách tính: mở hình bản đồ trong Figma/Photoshop, đọc toạ độ pixel của tâm mỗi điểm rồi chia cho kích thước ảnh. Ví dụ bản đồ 1080 x 1920, điểm 1 ở pixel (292, 1651) thì `x = 292 / 1080 x 100 ≈ 27`, `y = 1651 / 1920 x 100 ≈ 86`:

```js
map: {
  showPath: false,   // false nếu hình vẽ đã có sẵn con đường
  points: [
    { x: 27, y: 86 },
    { x: 71, y: 73 },
    { x: 30, y: 59 },
    { x: 71, y: 45 },
    { x: 31, y: 31 },
    { x: 60, y: 15 },  // điểm 6: món quà
  ],
},
```

- `showPath: true`: game tự vẽ con đường chấm nối các điểm. Để `false` nếu hình vẽ đã có đường.
- Kiểm tra: mở `http://localhost:8000/?screen=map&dev`, xem các nút tròn đã nằm đúng chỗ trên hình chưa, chỉnh số rồi tải lại trang. Thử cả khung điện thoại và máy tính (Chrome DevTools, bấm biểu tượng điện thoại để đổi kích thước).

---

## 6. Đưa lên GitHub Pages

GitHub Pages cho host trang tĩnh miễn phí, link có dạng `https://<username>.github.io/<repo>/`.

**Bước 1. Tạo repo.** Vào https://github.com/new :

- Repository name: đặt tên **khó đoán**, ví dụ `qua-2010-k7m2x9` (tên repo nằm trong link).
- Chọn **Public** (tài khoản GitHub miễn phí chỉ bật được Pages cho repo public; repo private cần gói GitHub Pro).
- **Không** tick "Add a README", ".gitignore" hay "license" (thư mục này đã có sẵn).
- Bấm **Create repository**.

**Bước 2. Đẩy code lên.** File `.gitignore` đã chặn sẵn các thư mục ảnh/nhạc gốc `Image/`, `State/`, `Music/` (ảnh gốc còn vị trí GPS), nên `git add .` chỉ đẩy bản đã xử lý trong `assets/`. Chạy `git status` trước khi commit để chắc không thấy mấy thư mục đó. Trong Terminal (thay `<username>` và `<repo>`):

```bash
cd "/Users/mac/Documents/Project Claude/Couple"
git init
git rev-parse --show-toplevel     # phải in ra đúng thư mục .../Couple
git add .
git commit -m "Hành trình Huli Huli"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

> Nếu thư mục cha (ví dụ thư mục người dùng) đã là một git repo, vẫn phải chạy `git init` ngay trong `Couple` để tạo repo riêng. Lệnh `git rev-parse --show-toplevel` giúp chắc chắn bạn đang ở đúng repo trước khi `git add`.

Lần đầu push, GitHub sẽ hỏi đăng nhập. Nếu bị hỏi mật khẩu thì dùng Personal Access Token, hoặc cài GitHub CLI (`brew install gh`, rồi `gh auth login`) cho nhanh.

**Bước 3. Bật Pages.** Trên trang repo: **Settings → Pages**. Ở mục "Build and deployment":

- Source: **Deploy from a branch**
- Branch: **main**, thư mục **/ (root)**, bấm **Save**.

**Bước 4. Chờ 1 đến 2 phút**, tải lại trang Settings → Pages sẽ thấy dòng "Your site is live at `https://<username>.github.io/<repo>/`". Mở thử link đó trên điện thoại.

**Bước 5. Sửa ảnh xem trước khi gửi link.** Messenger/Zalo cần đường dẫn đầy đủ tới ảnh xem trước. Mở `index.html`, sửa dòng `og:image` thành:

```html
<meta property="og:image" content="https://<username>.github.io/<repo>/assets/cover.jpg" />
```

rồi đẩy lên lại:

```bash
git add index.html
git commit -m "Link ảnh xem trước"
git push
```

Gửi thử link cho chính mình trên Messenger/Zalo để xem ảnh xem trước đã hiện chưa. Messenger lưu tạm ảnh xem trước cũ; nếu đã lỡ gửi link trước khi sửa, dán link vào https://developers.facebook.com/tools/debug/ và bấm "Scrape Again".

### Cập nhật sau này

Mỗi lần sửa config, đổi ảnh:

```bash
git add .
git commit -m "Cập nhật nội dung"
git push
```

Chờ khoảng 1 phút rồi tải lại trang (nếu vẫn thấy bản cũ, kéo xuống để tải lại hoặc mở tab ẩn danh).

> Bạn cũng có thể nhờ Claude làm hộ phần này, ví dụ nhắn: "đẩy thư mục Couple lên GitHub Pages giúp mình, repo tên qua-2010-k7m2x9". Máy cần đăng nhập GitHub CLI trước (`gh auth login`).

---

## 7. Lưu ý quan trọng

- **Trang web là công khai.** Ai có link đều mở được, kể cả khi repo để private (với gói Pro). Với repo public, người khác còn xem được toàn bộ file trong repo, gồm cả `js/config.js` (mật mã, đáp án) và mọi ảnh. **Mật mã chỉ là khoá cho vui**, không bảo mật thật. Đừng đưa lên những ảnh quá riêng tư. Trang đã có thẻ `noindex` để Google không đưa lên kết quả tìm kiếm, nhưng đó không phải là bảo mật.
- **Giới hạn của GitHub:** mỗi file tối đa 100 MB, cả trang tối đa 1 GB. Thực tế nên giữ tổng dưới khoảng 30 MB để tải nhanh.
- **Âm thanh trên iPhone:** iPhone chỉ cho phát tiếng sau khi người chơi chạm vào màn hình, nên nhạc nền bắt đầu sau khi nhập mật mã, nhạc màn cuối bắt đầu khi bấm mở quà. Nếu iPhone đang gạt công tắc im lặng, hiệu ứng âm thanh có thể không kêu. Nút loa ở góc trên bên phải để bật/tắt tiếng.
- **Tiến trình lưu theo từng trình duyệt** (localStorage). Mở bằng trình duyệt khác, máy khác hoặc tab ẩn danh sẽ bắt đầu lại từ đầu. Link mở trong Messenger/Zalo chạy bằng trình duyệt riêng của app, khác với Safari, nên nhắn em mở bằng Safari/Chrome nếu muốn chơi dở rồi chơi tiếp.
- **Máy của bạn:** nếu đã thử trên chính điện thoại/máy tính của mình, mở link với `?reset` trước khi đưa máy cho em chơi. Máy của em thì tự bắt đầu từ đầu.
- **Màn hình dọc:** điện thoại xoay ngang sẽ hiện lời nhắc "Xoay dọc điện thoại để chơi nha".

---

## 8. Gợi ý tặng quà

- **Gửi link đúng 0h ngày 20/10** kèm một tin nhắn ngắn, ví dụ "Chơi thử game này đi, qua hết 5 màn có quà đó". Messenger/Zalo sẽ hiện ảnh xem trước `cover.jpg` cực xinh.
- **In mã QR kẹp vào bó hoa hoặc thiệp:** trong Chrome trên máy tính, mở link game, vào menu ⋮ → "Truyền, lưu và chia sẻ" → "Tạo mã QR", tải ảnh về rồi in.
- Chọn mật mã là một ngày chỉ hai đứa biết, và để câu gợi ý đủ dễ để em không bị kẹt.
- Chuẩn bị sẵn quà thật để trao đúng lúc em mở tới màn "Hoàn thành nhiệm vụ!".

Chúc hai bạn một ngày 20/10 thật vui!
