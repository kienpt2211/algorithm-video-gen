# Hướng dẫn cho Codex

Đây là dự án dựng video bài học bằng Remotion, chạy hoàn toàn trên máy local.
Không thêm OpenAI API, dịch vụ TTS bên ngoài, API key hoặc bước gọi mô hình từ mã nguồn.
Codex chính là công cụ chuyển yêu cầu của người dùng thành storyboard và mã Remotion.

Khi người dùng yêu cầu tạo một video bài học mới:

1. Đọc `README.md`, `src/algorithm-video/schema.ts` và composition liên quan.
2. Với bài học phù hợp template chung, tạo ba file mới trong `fixtures/`: `<ten-bai-hoc>.cpp`, `<ten-bai-hoc>.input.txt` và `<ten-bai-hoc>.view.json`. Không ghi đè fixture cũ trừ khi người dùng yêu cầu.
3. Nếu bài học cần hình ảnh hoặc animation chuyên biệt mà template chung không thể thể hiện rõ, tạo composition React/TypeScript mới trong `src/` và đăng ký trong `src/Root.tsx`.
4. Dùng animation dựa trên frame của Remotion (`useCurrentFrame`, `interpolate`, `spring`); không dùng CSS animation hoặc CSS transition.
5. Chạy kiểm tra mã nguồn, sau đó render video. Với template chung, dùng `npm run algorithm:local -- --source fixtures/<ten-bai-hoc>.cpp --input fixtures/<ten-bai-hoc>.input.txt --view fixtures/<ten-bai-hoc>.view.json --job <ten-bai-hoc>-v1 --output renders/<ten-bai-hoc>-v1.mp4`.
6. Kiểm tra file MP4 đầu ra và báo lại đường dẫn tuyệt đối.

Giọng mặc định là giọng Việt `Linh` của macOS. Có thể đổi bằng `--voice` và tốc độ bằng `--rate`.
Các file sinh tự động nằm trong `jobs/`, `public/generated/` và `renders/`.
