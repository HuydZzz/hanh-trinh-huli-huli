/* =====================================================================
   HÀNH TRÌNH HULI HULI · FILE NỘI DUNG
   ---------------------------------------------------------------------
   Mọi thứ bạn cần sửa đều nằm trong file này, không cần đụng code khác.
   Chỗ nào có ✏️ là chỗ nên thay bằng nội dung thật của hai bạn.

   Quy tắc nhỏ khi sửa:
   - Chữ phải nằm trong dấu ngoặc kép "..."
   - Cuối mỗi dòng trong danh sách có dấu phẩy ,
   - "answer" phải giống Y HỆT một trong các "options" (kể cả dấu, hoa thường)
   - Đường dẫn ảnh tính từ thư mục gốc, ví dụ "assets/photos/man3/01.jpg"
   ===================================================================== */

window.CONFIG = {
  title: "Hành trình Huli Huli",
  subtitle: "Món quà nhỏ cho 20/10",

  // ✏️ Mật mã 4 số ở màn đầu tiên (ví dụ yêu nhau ngày 14/02 thì ghi "1402")
  passcode: "2307",
  // ✏️ Gợi ý hiện ra sau 3 lần nhập sai. Để "" nếu không muốn gợi ý.
  passcodeHint: "Gợi ý: ngày tụi mình chính thức yêu nhau (ngày + tháng)",

  // ✏️ Ngày yêu nhau theo dạng năm-tháng-ngày, dùng để đếm số ngày bên nhau
  //    ở màn cuối. Để "" nếu không muốn hiện.
  anniversary: "", // ✏️ ví dụ "2024-07-23" (cần năm để đếm số ngày)

  lives: 3, // số mạng
  // Khi hết mạng: "level" = chơi lại màn đang chơi, "all" = chơi lại từ màn 1
  onGameOver: "level",

  // Thứ tự các màn trên bản đồ (điểm thứ 6 luôn là món quà)
  order: ["quiz", "blur", "memory", "puzzle", "hearts"],

  levels: {
    /* ---------------- MÀN 1 · CÂU ĐỐ ---------------- */
    quiz: {
      name: "Câu đố kỉ niệm",
      desc: "Trả lời đúng 3 câu hỏi về tụi mình. Sai 1 câu là mất 1 mạng đó nha!",
      shuffleOptions: true, // xáo thứ tự đáp án mỗi lần chơi
      questions: [
        {
          q: "Buổi hẹn đầu tiên tụi mình đã ăn gì?",
          options: ["KFC", "Lotteria", "Jollibee", "4P's"],
          answer: "Jollibee",
          note: "", // (không bắt buộc) 1 câu hiện ra sau khi trả lời đúng
        },
        {
          q: "Bộ phim chiếu rạp đầu tiên tụi mình xem cùng nhau là phim gì?",
          options: ["Nhà Bà Nữ", "Mai", "Bố Già", "Bộ Tứ Báo Thủ"],
          answer: "Nhà Bà Nữ",
          note: "",
        },
        {
          q: "Ai là người tỏ tình trước?",
          options: ["Anh", "Em", "Cả hai cùng lúc"],
          answer: "Anh",
          note: "",
        },
      ],
    },

    /* ---------------- MÀN 2 · ĐOÁN ẢNH MỜ ---------------- */
    blur: {
      name: "Đoán ảnh mờ",
      desc: "Ảnh bị làm mờ rồi. Đoán xem ảnh này chụp khi nào, ở đâu nha!",
      question: "Ảnh này chụp khi nào, ở đâu?",
      photos: [
        {
          src: "assets/photos/man2/1.jpg",
          options: ["Tết 2026", "Hải Phòng 2026", "Huế 2026"],
          answer: "Tết 2026",
          caption: "", // ✏️ (không bắt buộc) hiện ra sau khi đoán đúng
        },
        {
          src: "assets/photos/man2/2.jpg",
          options: ["Sinh nhật anh 2026", "Ninh Bình 2026", "Infusion Ấu Triệu"],
          answer: "Ninh Bình 2026",
          caption: "",
        },
        {
          src: "assets/photos/man2/3.jpg",
          options: ["Royal City", "Nha Trang 2026", "Hanoi Centre"],
          answer: "Nha Trang 2026",
          caption: "",
        },
      ],
    },

    /* ---------------- MÀN 3 · LẬT THẺ ---------------- */
    memory: {
      name: "Lật thẻ",
      desc: "Lật thẻ tìm đủ 10 cặp ảnh giống nhau trong 60 giây!",
      seconds: 60,
      // ✏️ 10 ảnh (mỗi ảnh sẽ thành 1 cặp thẻ)
      photos: [
        "assets/photos/man3/01.jpg",
        "assets/photos/man3/02.jpg",
        "assets/photos/man3/03.jpg",
        "assets/photos/man3/04.jpg",
        "assets/photos/man3/05.jpg",
        "assets/photos/man3/06.jpg",
        "assets/photos/man3/07.jpg",
        "assets/photos/man3/08.jpg",
        "assets/photos/man3/09.jpg",
        "assets/photos/man3/10.jpg",
      ],
    },

    /* ---------------- MÀN 4 · GHÉP HÌNH ---------------- */
    puzzle: {
      name: "Ghép hình",
      desc: "Bức ảnh bị xáo trộn thành 9 mảnh. Ghép lại đúng chỗ trong 60 giây!",
      seconds: 60,
      grid: 3,
      photo: "assets/photos/man4/puzzle.jpg", // ảnh dọc, game tự cắt khung 9:16
    },

    /* ---------------- MÀN 5 · HỨNG TIM ---------------- */
    hearts: {
      name: "Hứng tim",
      desc: "Kéo giỏ hứng đủ 20 trái tim. Né trái tim vỡ ra, hứng trúng là mất mạng đó!",
      target: 20, // số tim cần hứng
      brokenChance: 0.25, // tỉ lệ rơi tim vỡ (0 đến 1)
      speed: 1, // tốc độ rơi (1 = bình thường, 1.3 = nhanh hơn)
    },
  },

  /* ---------------- MÀN CUỐI · QUÀ ---------------- */
  finale: {
    title: "Hoàn thành nhiệm vụ!",
    // ✏️ Lời chúc hiện ở màn cuối (xuống dòng bằng \n)
    message: "Chúc em 20/10 thật vui vẻ và luôn cười thật nhiều.\nYêu em!",
    signature: "Anh", // ✏️
    slideSeconds: 3.5, // mỗi ảnh hiện bao lâu (giây)
    // ✏️ Những ảnh đẹp nhất, chạy lặp liên tục. Có thể ghi thêm chú thích.
    //    Video .mp4 cũng được (sẽ phát không tiếng).
    photos: [
      { src: "assets/photos/best/01.jpg", caption: "" }, // ✏️ thêm chú thích nếu muốn
      { src: "assets/photos/best/02.jpg", caption: "" },
      { src: "assets/photos/best/03.jpg", caption: "" },
      { src: "assets/photos/best/04.jpg", caption: "" },
      { src: "assets/photos/best/05.jpg", caption: "" },
      { src: "assets/photos/best/06.jpg", caption: "" },
      { src: "assets/photos/best/07.jpg", caption: "" },
      { src: "assets/photos/best/08.jpg", caption: "" },
      { src: "assets/photos/best/09.jpg", caption: "" },
    ],
  },

  /* ---------------- HÌNH VẼ (tự vẽ và thêm sau) ----------------
     Để "" = dùng hình mặc định có sẵn.
     Vẽ xong thì bỏ file vào assets/art/ rồi điền đường dẫn, ví dụ "assets/art/map.png".
     Kích thước gợi ý xem trong README.md. */
  art: {
    background: "", // ảnh nền cho máy tính (ngang, 2400x1500)
    backgroundMobile: "", // ảnh nền cho điện thoại (dọc, 1242x2688)
    map: "", // bản đồ 6 điểm (dọc, 1080x1920)
    mascot: "", // nhân vật chính (PNG nền trong suốt, vuông 512x512)
    logo: "", // logo tên game (PNG nền trong suốt)
    cardBack: "", // mặt sau thẻ ở màn 3 (dọc 9:16, ví dụ 576x1024)
    catcher: "", // cái giỏ hứng tim ở màn 5 (PNG nền trong suốt)
    heart: "", // trái tim rơi ở màn 5
    brokenHeart: "", // trái tim vỡ ở màn 5
  },

  /* Vị trí 6 điểm trên bản đồ, tính theo % khung bản đồ
     (x: 0 là mép trái, 100 là mép phải · y: 0 là mép trên, 100 là mép dưới).
     Khi tự vẽ bản đồ, chỉnh các số này cho điểm nằm đúng chỗ trên hình. */
  map: {
    showPath: true, // vẽ con đường nối các điểm (tắt nếu hình vẽ đã có đường)
    points: [
      { x: 27, y: 86 },
      { x: 71, y: 73 },
      { x: 30, y: 59 },
      { x: 71, y: 45 },
      { x: 31, y: 31 },
      { x: 60, y: 15 }, // điểm 6: món quà
    ],
  },

  /* Nhạc (không bắt buộc). Bỏ file .mp3 vào assets/music/ rồi điền đường dẫn. */
  music: {
    game: "assets/music/tung-ngay-yeu-em.mp3", // nhạc nền khi chơi (bắt đầu sau khi nhập đúng mật mã)
    finale: "assets/music/tung-ngay-yeu-em.mp3", // nhạc ở màn cuối (cùng bài thì nhạc chạy tiếp, không phát lại)
    volume: 0.22, // âm lượng nhạc nền, 0 đến 1 (nhỏ thôi để không át tiếng hiệu ứng)
  },

  /* ---------------- LỜI THOẠI ----------------
     Sửa nếu muốn đổi cách xưng hô hay giọng văn. {n} {name} {lives}... là chỗ
     game tự điền số vào, giữ nguyên nhé. */
  text: {
    lockPrompt: "Nhập ngày kỉ niệm của tụi mình để mở khoá nha",
    lockSub: "4 số · ngày và tháng",
    lockWrong: "Chưa đúng rồi, nhớ lại xem nào!",
    lockOk: "Chính xác!",

    rulesTitle: "Luật chơi",
    rules: [
      "Em có {lives} mạng cho cả hành trình.",
      "Trả lời sai hoặc hết giờ sẽ mất 1 mạng.",
      "Hết mạng thì Alex Ferguson luôn",
      "Qua đủ 5 màn để mở món quà cuối cùng!",
    ],
    rulesCta: "Sẵn sàng!",

    levelLabel: "Màn {n}",
    play: "Chơi!",
    next: "Tiếp tục",
    retry: "Chơi lại",
    start: "Bắt đầu!",
    close: "Đóng",
    later: "Để sau",

    mapHint: "Chạm vào điểm đang sáng để chơi",
    mapLocked: "Chưa mở khoá",
    mapDone: "Qua màn này rồi",
    giftLabel: "Món quà",
    giftReady: "Món quà đang chờ em!",
    giftDesc: "Em đã đi hết hành trình rồi. Mở quà thôi!",
    giftCta: "Mở quà",

    countdown: ["3", "2", "1"],
    go: "Bắt đầu!",

    correct: ["Chuẩn luôn!", "Giỏi quá!", "Đúng rồi!", "Nhớ dai ghê!"],
    wrong: ["Sai mất rồi!", "Ơ, không phải!", "Hmm, chưa đúng"],
    lifeLost: "-1 mạng",

    levelDoneTitle: "Qua màn {n}!",
    levelDoneBody: ["Giỏi ghê! Đi tiếp thôi.", "Quá đỉnh luôn!", "Em làm tốt lắm nè!"],

    timeoutTitle: "Hết giờ!",
    timeoutBody: "Hết giờ mất rồi, em bị trừ 1 mạng. Thử lại màn này nha!",

    gameOverTitle: "Hết mạng",
    gameOverBody: "Không sao hết, anh tặng em thêm {lives} mạng. Chơi lại nha!",

    daysTogether: "Tụi mình đã bên nhau {days} ngày",
    watchMemories: "Xem kỉ niệm",
    slideshowTitle: "Những khoảnh khắc đẹp nhất",
    replayAll: "Chơi lại từ đầu",

    rotate: "Xoay dọc điện thoại để chơi nha",
    missingImage: "Không tìm thấy ảnh",
    loading: "Đang tải...",
  },
};
