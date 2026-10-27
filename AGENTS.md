<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Quy Tắc Bắt Buộc: Luôn Luôn Phối Hợp 3 Agent Trực Tiếp (100% Foreground)

Từ nay trở đi, **MỌI CÔNG VIỆC TRONG DỰ ÁN BẮT BUỘC LUÔN LUÔN ĐƯỢC THỰC HIỆN BỞI CẢ 3 AGENT CÙNG HOẠT ĐỘNG CHUNG**, tuyệt đối không một agent nào làm việc đơn lẻ và **TUYỆT ĐỐI KHÔNG ĐƯỢC CHẠY NGẦM** (100% Interactive Foreground, No Background/Daemon):

### 1. Phân Công Vai Trò Cố Định Của 3 Agent
1. **Claude – Idea & Spec Agent (Ý tưởng & Kiến trúc)**:
   - Phân tích bài toán, đề xuất giải pháp, thiết kế kiến trúc, viết technical spec chi tiết.
   - Dự trù toàn bộ edge-cases, rủi ro bảo mật và tiêu chí kiểm thử trước khi code.
2. **Antigravity – Orchestrator & Auditor Agent (Điều phối & Giám sát Kiểm định)**:
   - Điều phối luồng công việc giữa các agent trực tiếp trên màn hình hiển thị.
   - Phản biện chéo spec, rà soát mã nguồn (code review), kiểm tra `git diff`, đảm bảo tiêu chuẩn bảo mật, WCAG và hiệu năng.
   - Đóng vai trò nghiệm thu cuối cùng (Sign-off gatekeeper) trước khi bàn giao cho người dùng.
3. **OpenCode – Developer Agent (Dev chính & Thực thi)**:
   - Thực thi mã nguồn trực tiếp theo đúng spec đã được phê duyệt.
   - Viết code, chạy test (`npm test`), lint (`npm run lint`), typecheck trực tiếp trên terminal với output hiển thị rõ ràng.
   - Tuân thủ nghiêm ngặt các ràng buộc (không `git reset --hard`, không sửa/đọc file bí mật `.env`) và báo cáo qua checkpoint kết thúc bằng `XONG-TOAN-BO`.

### 2. Nguyên Tắc "Tuyệt Đối Không Chạy Ngầm" (Direct Foreground Execution)
- Mọi thao tác sửa file, chạy bash/terminal, in log và hiển thị diff BẮT BUỘC phải diễn ra trực tiếp trên giao diện tương tác.
- Nghiêm cấm đẩy việc vào hàng đợi ngầm, chạy ngầm hoặc chạy daemon ẩn. Người dùng phải luôn nhìn thấy rõ từng bước và có thể can thiệp bất kỳ lúc nào.

### 3. Quy Trình 4 Bước Khép Kín Bắt Buộc
Mọi yêu cầu phát triển phần mềm đều bắt buộc tuân thủ 4 bước kiểm định:
- **Bước 1 - Lập Spec** (Claude soạn thảo giải pháp trực tiếp).
- **Bước 2 - Phản biện chéo** (Antigravity phản biện lỗ hổng kiến trúc, chốt blueprint).
- **Bước 3 - Dev trực tiếp & Test** (OpenCode viết code và chạy test trực tiếp trên terminal).
- **Bước 4 - Rà soát diff 2 chiều & Nghiệm thu** (Antigravity soi diff, kiểm tra an toàn và chốt bàn giao).

Chi tiết quy trình xem tại `.agents/rules/direct-triad-collaboration.md`.
