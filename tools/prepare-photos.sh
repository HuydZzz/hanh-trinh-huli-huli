#!/bin/bash
# =====================================================================
#  prepare-photos.sh · Chuẩn bị ảnh/video cho "Hành trình của tụi mình"
# ---------------------------------------------------------------------
#  Cách dùng:
#    ./tools/prepare-photos.sh <thư-mục-ảnh-gốc> <thư-mục-ra> [cạnh-dài-tối-đa=1600]
#
#  Ví dụ:
#    ./tools/prepare-photos.sh ~/Desktop/anh-lat-the assets/photos/man3
#    ./tools/prepare-photos.sh ~/"Desktop/Anh dep nhat" assets/photos/best 1800
#
#  Script sẽ:
#    - Đổi ảnh .heic .heif .jpg .jpeg .png .webp thành JPG (chất lượng ~82),
#      cạnh dài nhất tối đa 1600px (không phóng to ảnh nhỏ), xoay đúng chiều,
#      xoá thông tin vị trí GPS để an toàn khi đưa lên mạng.
#    - Đổi video .mov .mp4 .m4v thành MP4 720p H.264 + AAC (cần ffmpeg).
#    - Đặt tên lần lượt 01.jpg, 02.jpg, 03.mp4... theo thứ tự tên file gốc.
#    - KHÔNG xoá, KHÔNG sửa file gốc. Chỉ ghi file mới vào thư mục ra.
#    - In sẵn các dòng để dán vào js/config.js.
#  Chỉ chạy trên macOS (dùng sips/ImageIO có sẵn của máy Mac).
# =====================================================================

set -o pipefail

JPEG_QUALITY=82          # 0..100
VIDEO_HEIGHT=720         # cạnh ngắn của video sau khi đổi
VIDEO_CRF=24             # 18 = đẹp/nặng, 28 = nhẹ/mờ hơn

# ---------- màu chữ cho dễ đọc ----------
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'; C_0=$'\033[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_B=""; C_0=""
fi
say()  { printf '%s\n' "$*"; }
ok()   { printf '%s  ✓ %s%s\n' "$C_OK" "$*" "$C_0"; }
warn() { printf '%s  ! %s%s\n' "$C_WARN" "$*" "$C_0"; }
die()  { printf '%sLỗi: %s%s\n' "$C_ERR" "$*" "$C_0" >&2; exit 1; }

usage() {
  cat <<EOF
Cách dùng:
  ./tools/prepare-photos.sh <thư-mục-ảnh-gốc> <thư-mục-ra> [cạnh-dài-tối-đa=1600]

Ví dụ:
  ./tools/prepare-photos.sh ~/Desktop/man3 assets/photos/man3
  ./tools/prepare-photos.sh "\$HOME/Desktop/Anh dep" assets/photos/best 1800
EOF
}

# ---------- kiểm tra tham số ----------
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then usage; exit 0; fi
if [ $# -lt 2 ] || [ $# -gt 3 ]; then usage; exit 1; fi
[ "$(uname -s)" = "Darwin" ] || die "script này chỉ chạy trên macOS."
command -v sips >/dev/null 2>&1 || die "không tìm thấy lệnh sips (có sẵn trên macOS)."

IN_ARG=$1
OUT_ARG=$2
MAX=${3:-1600}
case "$MAX" in ''|*[!0-9]*) die "cạnh dài tối đa phải là số, ví dụ 1600 (bạn nhập: \"$MAX\")." ;; esac
if [ "$MAX" -lt 200 ] || [ "$MAX" -gt 6000 ]; then die "cạnh dài tối đa nên trong khoảng 200 đến 6000 (bạn nhập: $MAX)."; fi

[ -d "$IN_ARG" ] || die "không tìm thấy thư mục ảnh gốc: $IN_ARG"
IN_DIR=$(cd "$IN_ARG" && pwd -P) || die "không mở được thư mục: $IN_ARG"
mkdir -p "$OUT_ARG" || die "không tạo được thư mục ra: $OUT_ARG"
OUT_DIR=$(cd "$OUT_ARG" && pwd -P) || die "không mở được thư mục ra: $OUT_ARG"
[ "$IN_DIR" != "$OUT_DIR" ] || die "thư mục ra phải KHÁC thư mục ảnh gốc (để không ghi đè ảnh gốc)."

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd -P)

HAS_FFMPEG=0
command -v ffmpeg >/dev/null 2>&1 && HAS_FFMPEG=1

# ---------- bộ đổi ảnh bằng ImageIO (xoay đúng chiều, bỏ GPS/EXIF, giữ màu) ----------
JXA=$(mktemp -t prepare-photos) || die "không tạo được file tạm."
trap 'rm -f "$JXA"' EXIT
cat > "$JXA" <<'JS'
ObjC.import('Foundation');
ObjC.import('ImageIO');
ObjC.import('CoreGraphics');
function run(argv) {
  var src = argv[0], dst = argv[1], max = parseInt(argv[2], 10), q = parseFloat(argv[3]);
  var isrc = $.CGImageSourceCreateWithURL($.NSURL.fileURLWithPath(src), $());
  if (!isrc || (isrc.isNil && isrc.isNil())) return 'ERR';
  var img = $.CGImageSourceCreateThumbnailAtIndex(isrc, 0, $({
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: max
  }));
  if (!img || (img.isNil && img.isNil())) return 'ERR';
  var dest = $.CGImageDestinationCreateWithURL($.NSURL.fileURLWithPath(dst), $('public.jpeg'), 1, $());
  if (!dest || (dest.isNil && dest.isNil())) return 'ERR';
  var white = $.CGColorCreateGenericRGB(1, 1, 1, 1);
  var props = $.NSMutableDictionary.dictionary;
  props.setObjectForKey($.NSNumber.numberWithDouble(q), $('kCGImageDestinationLossyCompressionQuality'));
  props.setObjectForKey(white, $('kCGImageDestinationBackgroundColor'));
  $.CGImageDestinationAddImage(dest, img, props);
  if (!$.CGImageDestinationFinalize(dest)) return 'ERR';
  return 'OK ' + $.CGImageGetWidth(img) + 'x' + $.CGImageGetHeight(img);
}
JS

# Trả về "WxH" nếu thành công
convert_image() {
  local src=$1 dst=$2 res w h
  local q
  q=$(awk "BEGIN{printf \"%.2f\", $JPEG_QUALITY/100}")
  res=$(osascript -l JavaScript "$JXA" "$src" "$dst" "$MAX" "$q" 2>/dev/null)
  if [ "${res%% *}" = "OK" ] && [ -s "$dst" ]; then
    printf '%s' "${res#OK }"
    return 0
  fi
  # Dự phòng: dùng sips (vẫn chạy tốt, nhưng không xoá được GPS)
  rm -f "$dst"
  w=$(sips -g pixelWidth "$src" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" 2>/dev/null | awk '/pixelHeight/{print $2}')
  case "$w$h" in ''|*[!0-9]*) return 1 ;; esac
  if [ "$w" -gt "$MAX" ] || [ "$h" -gt "$MAX" ]; then
    sips -s format jpeg -s formatOptions "$JPEG_QUALITY" -Z "$MAX" "$src" --out "$dst" >/dev/null 2>&1 || return 1
  else
    sips -s format jpeg -s formatOptions "$JPEG_QUALITY" "$src" --out "$dst" >/dev/null 2>&1 || return 1
  fi
  [ -s "$dst" ] || return 1
  w=$(sips -g pixelWidth "$dst" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$dst" 2>/dev/null | awk '/pixelHeight/{print $2}')
  printf '%sx%s · sips, còn GPS' "$w" "$h"
  return 0
}

convert_video() {
  local src=$1 dst=$2 trc vf
  trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of default=nw=1:nk=1 "$src" 2>/dev/null | head -n 1)
  case "$trc" in
    arib-std-b67|smpte2084) warn "video HDR (quay bằng iPhone), màu có thể hơi nhạt hơn bản gốc." ;;
  esac
  vf="scale=w='if(gte(iw,ih),-2,trunc(min(${VIDEO_HEIGHT},iw)/2)*2)':h='if(gte(iw,ih),trunc(min(${VIDEO_HEIGHT},ih)/2)*2,-2)',format=yuv420p"
  ffmpeg -hide_banner -loglevel error -nostdin -y -i "$src" \
    -map 0:v:0 -map '0:a:0?' -map_metadata -1 \
    -vf "$vf" -fpsmax 30 \
    -c:v libx264 -preset medium -crf "$VIDEO_CRF" -profile:v high \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart "$dst" </dev/null
}

human_size() {
  awk -v b="$1" 'BEGIN{ if (b>=1048576) printf "%.1f MB", b/1048576; else printf "%d KB", (b+1023)/1024 }'
}
file_size() { stat -f %z "$1" 2>/dev/null || echo 0; }

# ---------- gom danh sách file (theo tên, không phân biệt hoa thường, IMG_2 trước IMG_10) ----------
LIST=$(mktemp -t prepare-photos-list) || die "không tạo được file tạm."
trap 'rm -f "$JXA" "$LIST"' EXIT
find "$IN_DIR" -maxdepth 1 -type f ! -name '.*' -print0 | sort -z -f -V > "$LIST"

say ""
say "${C_B}Chuẩn bị ảnh/video${C_0}"
say "${C_DIM}  Từ:  $IN_DIR${C_0}"
say "${C_DIM}  Vào: $OUT_DIR${C_0}"
say "${C_DIM}  Cạnh dài tối đa: ${MAX}px · JPG chất lượng ${JPEG_QUALITY} · video ${VIDEO_HEIGHT}p${C_0}"
if [ -n "$(find "$OUT_DIR" -maxdepth 1 -type f ! -name '.*' -print -quit)" ]; then
  warn "thư mục ra đã có sẵn file. File trùng tên (01.jpg, 02.jpg...) sẽ bị thay, file khác giữ nguyên."
fi
say ""

n=0
skipped=0
failed=0
total_bytes=0
OUT_FILES=()

while IFS= read -r -d '' src; do
  name=$(basename "$src")
  ext=$(printf '%s' "${name##*.}" | tr '[:upper:]' '[:lower:]')
  base="${name%.*}"
  [ "$name" = "$ext" ] && ext=""
  case "$ext" in
    heic|heif|jpg|jpeg|png|webp)
      num=$(printf '%02d' $((n + 1)))
      dst="$OUT_DIR/$num.jpg"
      if dims=$(convert_image "$src" "$dst"); then
        n=$((n + 1))
        sz=$(file_size "$dst"); total_bytes=$((total_bytes + sz))
        OUT_FILES+=("$dst")
        ok "$name  ->  $num.jpg  ($dims, $(human_size "$sz"))"
        [ "$sz" -gt 1048576 ] && warn "$num.jpg hơi nặng (trên 1 MB). Thử chạy lại với cạnh dài nhỏ hơn, ví dụ 1400."
      else
        failed=$((failed + 1))
        warn "không đọc được ảnh: $name (bỏ qua)"
      fi
      ;;
    mov|mp4|m4v)
      # Live Photo: ảnh và video cùng tên, chỉ lấy ảnh
      live=""
      for e in HEIC heic JPG jpg JPEG jpeg HEIF heif PNG png; do
        if [ -f "$IN_DIR/$base.$e" ]; then live=1; break; fi
      done
      if [ -n "$live" ]; then
        skipped=$((skipped + 1))
        say "${C_DIM}  - $name: video của Live Photo (đã có ảnh cùng tên), bỏ qua${C_0}"
        continue
      fi
      if [ "$HAS_FFMPEG" -ne 1 ]; then
        skipped=$((skipped + 1))
        warn "$name: chưa cài ffmpeg nên bỏ qua video. Cài bằng: brew install ffmpeg"
        continue
      fi
      num=$(printf '%02d' $((n + 1)))
      dst="$OUT_DIR/$num.mp4"
      say "${C_DIM}  … đang đổi video $name (có thể mất vài chục giây)${C_0}"
      if convert_video "$src" "$dst" && [ -s "$dst" ]; then
        n=$((n + 1))
        sz=$(file_size "$dst"); total_bytes=$((total_bytes + sz))
        OUT_FILES+=("$dst")
        ok "$name  ->  $num.mp4  ($(human_size "$sz"))"
        [ "$sz" -gt 20971520 ] && warn "$num.mp4 nặng hơn 20 MB, nên cắt video ngắn lại (khoảng 5 đến 15 giây)."
      else
        rm -f "$dst"
        failed=$((failed + 1))
        warn "không đổi được video: $name (bỏ qua)"
      fi
      ;;
    *)
      skipped=$((skipped + 1))
      say "${C_DIM}  - $name: không phải ảnh/video, bỏ qua${C_0}"
      ;;
  esac
done < "$LIST"

say ""
if [ "$n" -eq 0 ]; then
  warn "không có file nào được tạo. Kiểm tra lại thư mục ảnh gốc (hỗ trợ: heic heif jpg jpeg png webp mov mp4 m4v)."
  exit 1
fi
say "${C_B}Xong: $n file mới, tổng $(human_size "$total_bytes").${C_0} Bỏ qua: $skipped · Lỗi: $failed"
say "${C_DIM}Ảnh gốc không bị thay đổi.${C_0}"

# ---------- in sẵn dòng để dán vào js/config.js ----------
INSIDE=0
case "$OUT_DIR/" in "$ROOT_DIR/"*) INSIDE=1 ;; esac
relpath() {
  if [ "$INSIDE" -eq 1 ]; then printf '%s' "${1#"$ROOT_DIR/"}"; else printf '%s' "$1"; fi
}

say ""
if [ "$INSIDE" -ne 1 ]; then
  warn "thư mục ra nằm NGOÀI thư mục game. Nhớ chép ảnh vào assets/photos/... rồi sửa lại đường dẫn bên dưới."
  say ""
fi

folder=$(basename "$OUT_DIR" | tr '[:upper:]' '[:lower:]')
case "$folder" in
  man2)
    say "${C_B}Dán vào js/config.js, mục levels.blur.photos (màn 2):${C_0}"
    for f in "${OUT_FILES[@]}"; do
      say "        { src: \"$(relpath "$f")\", options: [\"\", \"\", \"\"], answer: \"\", caption: \"\" },"
    done
    say "${C_DIM}(nhớ điền options và answer, answer phải giống y hệt 1 trong options)${C_0}"
    ;;
  man4)
    say "${C_B}Dán vào js/config.js, mục levels.puzzle (màn 4), chọn 1 ảnh:${C_0}"
    say "      photo: \"$(relpath "${OUT_FILES[0]}")\","
    ;;
  best)
    say "${C_B}Dán vào js/config.js, mục finale.photos (màn cuối):${C_0}"
    for f in "${OUT_FILES[@]}"; do
      say "      { src: \"$(relpath "$f")\", caption: \"\" },"
    done
    ;;
  *)
    if [ "$folder" = "man3" ]; then
      say "${C_B}Dán vào js/config.js, mục levels.memory.photos (màn 3, cần đúng 10 ảnh):${C_0}"
    else
      say "${C_B}Danh sách đường dẫn để dán vào js/config.js:${C_0}"
    fi
    for f in "${OUT_FILES[@]}"; do
      say "        \"$(relpath "$f")\","
    done
    ;;
esac
if [ "$folder" = "man3" ] && [ "$n" -ne 10 ]; then
  warn "màn 3 cần 10 ảnh, hiện có $n."
fi
say ""
