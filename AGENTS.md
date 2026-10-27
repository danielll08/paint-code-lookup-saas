<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Quy Tắc Điều Phối 3 Agent Trực Tiếp (100% Foreground)

Dự án hoạt động theo mô hình phối hợp tương tác trực tiếp 3 Agent: **Claude × Antigravity × OpenCode**. Tuyệt đối không chạy ngầm hoặc dùng daemon ẩn.

---

### 1. Phân Công Vai Trò Cố Định Của 3 Agent
1. **Claude – Idea & Spec Agent (Ý tưởng & Kiến trúc)**:
   - Phân tích bài toán, đề xuất giải pháp, thiết kế kiến trúc kỹ thuật.
   - Dự trù edge-cases, rủi ro bảo mật và thiết kế tiêu chí kiểm thử.
2. **Antigravity – Orchestrator & Auditor Agent (Điều phối & Giám sát Kiểm định)**:
   - Điều phối luồng làm việc, giám sát tuân thủ quy chuẩn.
   - Phản biện chéo spec, rà soát mã nguồn (code review), kiểm tra `git diff`.
   - Đóng vai trò nghiệm thu cuối cùng (Sign-off gatekeeper) trước khi bàn giao.
3. **OpenCode – Developer Agent (Dev chính & Thực thi)**:
   - Viết code trực tiếp theo đúng spec đã duyệt.
   - Chạy test (`npm test`), lint (`npm run lint`), typecheck trực tiếp trên terminal.
   - Tuân thủ 6 Ràng Buộc Vàng (không `git reset --hard`, không sửa/đọc file bí mật `.env*`) và báo cáo bằng `XONG-TOAN-BO`.

---

### 2. Phân Tầng Tác Vụ Thông Minh (Dynamic Routing)
Để tối ưu hóa tốc độ và tiết kiệm token, hệ thống phân loại 2 chế độ xử lý:

- ⚡ **Chế độ Fast-Track (Tra cứu, hỗ trợ, câu hỏi ngắn, lệnh vận hành server)**:
  - Áp dụng khi: Người dùng hỏi thông tin, tra cứu dữ liệu, chạy localhost, kiểm tra trạng thái.
  - Phản hồi: Trả lời trực tiếp, nhanh gọn, tập trung vào kết quả hành động mà không cần qua 4 bước rườm rà.

- 🛡️ **Chế độ Deep Triad (Viết code mới, sửa bug, thay đổi kiến trúc, deploy)**:
  - Áp dụng khi: Có thao tác chỉnh sửa mã nguồn, thêm tính năng, sửa lỗi logic hoặc deploy.
  - Phản hồi: Bắt buộc tuân thủ quy trình 4 bước khép kín (Lập Spec → Phản biện chéo → Dev trực tiếp → Nghiệm thu 2 chiều).

---

### 3. Thẻ Nhớ Bối Cảnh Dự Án (Project Memory Card)
Mọi Agent luôn luôn ghi nhớ các thông số thực tế của dự án:
- **Repository GitHub**: `https://github.com/danielll08/paint-code-lookup-saas` (Nhánh chính: `main`)
- **Tài khoản Google Test Chính**: `danieldangg12112008@gmail.com` (Daniel Dang)
- **Tài khoản Demo Mẫu**: `demo@paintcode.test` / `Demo12345!` (Pre-seeded 20 credits)
- **Kiến trúc Localhost**:
  - Web App (Next.js 16 + Turbopack): `http://localhost:3000`
  - Supabase Auth Gateway & Mailbox: `http://127.0.0.1:55400` (Xem OTP/Mail tại `/__test/mail`)
  - Embedded Postgres: Port `55432` | PostgREST: Port `55433` | Stripe Mock: Port `12111`
- **Bộ Biển Số Xe Kiểm Thử Mẫu (100% Success)**:
  - `AY20ABC` (Mercedes-Benz C220d - Obsidian Black Metallic `197`)
  - `AC20ABC` (BMW 320d - Black Sapphire Metallic `475`)
  - `AX20ABC` (Audi A4 Avant - Mythos Black Metallic `LY9T`)
  - `FO20ABC` (Kịch bản Failover Provider tự động khắc phục)

---

### 4. Cẩm Nang Tự Phục Hồi Lỗi (Self-Healing Playbook)
Khi gặp các lỗi sau, Agent tự động áp dụng giải pháp đã kiểm chứng:
1. **Lỗi mất CSS Next.js**:
   - *Nguyên nhân*: Dự án dùng Tailwind v4 liên kết qua `@tailwindcss/turbopack`, không có PostCSS.
   - *Quy tắc*: Tuyệt đối KHÔNG hạ cấp sang `--webpack`. Luôn chạy `next dev` với Turbopack để đảm bảo toàn bộ utility classes được biên dịch đầy đủ.
2. **Lỗi Vercel Hobby Cron Job Limit**:
   - *Nguyên nhân*: Gói Vercel Hobby giới hạn cron tối đa 1 lần/ngày.
   - *Quy tắc*: Trong `vercel.json`, trường `"schedule"` bắt buộc phải là `0 0 * * *`.
3. **Lỗi Git "Permission denied / cannot come back to cwd" trên Windows**:
   - *Nguyên nhân*: Process nền (như embedded-postgres) giữ handle thư mục.
   - *Quy tắc*: Dùng chế độ unsandboxed hoặc giải phóng background task trước khi gọi lệnh Git.

---

### 5. Giao Thức Deploy Tự Động 100% (Zero-Touch Deployment)
Khi người dùng yêu cầu *"deploy"*, *"up lên vercel"*, *"up lên render"*:
1. OpenCode tự động kích hoạt `npm run deploy` (hoặc `node scripts/deploy-all.mjs`).
2. Script tự động chạy test kiểm định, commit và push lên GitHub `main`.
3. Tự động kích hoạt Vercel CLI (`npm run deploy:vercel`) và Render Hook (`npm run deploy:render`).
4. Báo cáo trạng thái và đường link web trực tiếp cho người dùng.
