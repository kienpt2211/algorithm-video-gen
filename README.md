# COOJ Algorithm Video

Pipeline tạo video dọc mô phỏng thuật toán C++ bằng Remotion, chạy hoàn toàn trên
máy local. Hệ thống tự biên dịch chương trình, ghi lại từng bước thực thi, kiểm
tra output và render thành MP4.

Video dùng template chung với màu `#00aeda`, nhận diện `COOJ Algorithm` và
`codejudge.com.vn`, highlight dòng code/biến thay đổi cùng các âm thanh
`read.wav`, `write.wav`, `swap.wav` và `complete.wav`.

## Cài đặt một lần

Yêu cầu: macOS, Node.js, `ffmpeg` và `/usr/bin/clang++`.

```console
cd /Users/kienpham/Web/algorithm_reel
npm install
```

Không cần API key, OpenAI API, dịch vụ TTS hoặc kết nối mạng để render.

## Ba file cần có cho mỗi thuật toán

Mỗi bài sử dụng cùng một `<slug>`:

```text
fixtures/<slug>.cpp
fixtures/<slug>.input.txt
fixtures/<slug>.view.json
```

- `<slug>.cpp`: chương trình C++17 chứa thuật toán.
- `<slug>.input.txt`: dữ liệu truyền vào standard input.
- `<slug>.view.json`: cấu hình phần code và dữ liệu hiển thị trên video.

Codex có thể hỗ trợ tạo ba file này, nhưng không bắt buộc để kiểm tra hoặc render.

## Quy trình vận hành chuẩn

### 1. Kiểm tra trước khi render

```console
cd /Users/kienpham/Web/algorithm_reel

npm run algorithm:local -- \
  --source fixtures/<slug>.cpp \
  --input fixtures/<slug>.input.txt \
  --view fixtures/<slug>.view.json \
  --job <slug>-v1 \
  --no-render
```

Pipeline sẽ:

1. Kiểm tra cấu trúc `view.json`.
2. Tạo một bản sao của mã C++ và gắn lệnh ghi trace.
3. Biên dịch bằng C++17.
4. Chạy chương trình và thu thập tối đa 5.000 bước.
5. Chạy lại binary đã biên dịch và so sánh exit code cùng stdout giữa hai lần.
6. Dừng ngay nếu kết quả của hai lần chạy không khớp.
7. Tạo dữ liệu render tại `jobs/<slug>-v1/props.json`.

### 2. Render video hoàn chỉnh

Sau khi bước kiểm tra thành công:

```console
cd /Users/kienpham/Web/algorithm_reel

npm run algorithm:local -- \
  --source fixtures/<slug>.cpp \
  --input fixtures/<slug>.input.txt \
  --view fixtures/<slug>.view.json \
  --job <slug>-v1 \
  --output renders/<slug>-v1.mp4
```

Không truyền `--narration` thì video không có giọng đọc nhưng vẫn giữ toàn bộ
hiệu ứng âm thanh. File hoàn chỉnh nằm tại `renders/<slug>-v1.mp4`.

### Ví dụ: lũy thừa nhị phân

```console
cd /Users/kienpham/Web/algorithm_reel

npm run algorithm:local -- \
  --source fixtures/binary-exponentiation.cpp \
  --input fixtures/binary-exponentiation.input.txt \
  --view fixtures/binary-exponentiation.view.json \
  --job binary-exponentiation-v1 \
  --output renders/binary-exponentiation-v1.mp4
```

## Cấu hình `view.json`

File mẫu đầy đủ: `fixtures/binary-exponentiation.view.json`.

Các trường quan trọng:

- `title`: tiêu đề video.
- `sourceFile`: tên file hiển thị trong cửa sổ code.
- `show.startLine`, `show.endLine`: vùng code được trace và hiển thị.
- `visuals`: dữ liệu cần vẽ; hỗ trợ `array-bars`, `array-cells`, `grid`, `stack`,
  `queue`, `string`, `graph`, `tree` và `scalars`.
- `visuals[].range`: tùy chọn tô sáng một đoạn liên tiếp, ví dụ cửa sổ từ
  `windowLeft` đến `windowRight`.
- `counters`: đếm số lần chương trình chạy tới một dòng.
- `phase`: hiển thị giai đoạn hoặc vòng lặp hiện tại.
- `lineEffects`: gán `read`, `write`, `swap` hoặc `note` cho từng dòng.
- `logs`: thông tin hiển thị ở đầu, cuối hoặc tại một dòng cụ thể.
- `timing`: tốc độ các bước thường, bước lặp nhanh, bước thay đổi, đoạn kết và
  `tailSteps` — số bước cuối luôn giữ ở tốc độ dễ đọc.

Tên biến trong `visuals`, `phase` và `lineEffects` phải tồn tại trong mã C++.

## Quy tắc viết mã C++

- Chương trình phải biên dịch bằng C++17 và chạy thành công với file input.
- Các câu lệnh `if`, `for` và `while` trong vùng trace phải dùng dấu `{ }`.
- Chỉ chọn vùng `show` chứa phần thuật toán cần mô phỏng.
- Tránh input tạo quá nhiều bước; trace chỉ giữ tối đa 5.000 bước.
- Nên thử với input nhỏ, đủ thể hiện các nhánh chính của thuật toán.

## Âm thanh sự kiện

- Dòng đọc hoặc bước không làm thay đổi dữ liệu: `read.wav`.
- Ghi giá trị: `write.wav`.
- Hoán đổi hai phần tử: `swap.wav`.
- Bước cuối cùng: `complete.wav`.

Dùng `--no-sfx` để tắt hiệu ứng âm thanh. Dùng `--no-audio` để tắt toàn bộ audio.

## File đầu ra

Mỗi lần chạy tạo các file phục vụ kiểm tra và tái tạo:

```text
jobs/<job-id>/
  props.json
  trace.json
  verification.json
  program.stdout.txt
  program.stderr.txt

public/generated/<job-id>/
  sfx/

renders/
  <slug>-v1.mp4
```

`verification.json` cho biết exit code và stdout của hai lần chạy có khớp nhau
hay không. Đổi `--job` hoặc hậu tố phiên bản để giữ lại một lần chạy cũ.

## Kiểm tra mã nguồn hệ thống

```console
npm test
npm run lint
```

Xem trước template trong Remotion Studio:

```console
npm run dev -- --no-open
```

## Khi nào phải sửa template

Chỉ ba file trong `fixtures/` là đủ nếu bài toán phù hợp các kiểu trực quan đã hỗ
trợ. Nếu cần hình ảnh, đồ thị hoặc animation chuyên biệt mà `view.json` không mô
tả được, cần tạo hoặc sửa composition React/Remotion trong `src/` và đăng ký nó
trong `src/Root.tsx`.

Các phần chính của pipeline:

- `scripts/render-algorithm.ts`: điều phối trace, kiểm tra và render.
- `scripts/instrumented-tracer.ts`: gắn trace và chạy chương trình C++.
- `src/algorithm-video/`: template video dùng chung.
- `src/algorithm-video/brand.ts`: tên thương hiệu và tên miền.
- `fixtures/`: mã nguồn, input và cấu hình của từng bài.
- `jobs/`: dữ liệu trung gian của từng lần chạy.
- `renders/`: video MP4 hoàn chỉnh.
