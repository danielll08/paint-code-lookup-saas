# Rule: Quy Trình Phối Hợp Tam Giác Trực Tiếp (Claude × Antigravity × OpenCode)

Quy định chuẩn phối hợp làm việc giữa 3 agent: **Claude**, **Antigravity**, và **OpenCode**.

---

## 1. Nguyên Tắc Cốt Lõi

1. **Tuyệt đối chạy trực tiếp (100% Foreground - No Background Tasks):**
   - Mọi thao tác đọc/ghi file, chỉnh sửa code và chạy lệnh terminal phải được thực thi TRỰC TIẾP, hiển thị log và kết quả rõ ràng trên màn hình.
   - Tuyệt đối không spawn process chạy ngầm ẩn giấu thông tin. Người dùng phải luôn nhìn thấy tiến độ và có thể can thiệp bất kỳ lúc nào.
2. **Phân Tầng Tác Vụ Thông Minh (Dynamic Routing):**
   - **Fast-Track (Tra cứu, hỗ trợ, câu hỏi ngắn, vận hành server):** Trả lời trực tiếp, chính xác, tốc độ cao mà không cần format 4 bước cồng kềnh.
   - **Deep Triad (Viết code mới, sửa bug, thay đổi kiến trúc, deploy):** Bắt buộc tuân thủ quy trình 4 bước kiểm định khép kín.
3. **Phân công vai trò cố định:**
   - **Claude (Lead Ideator & Architect):** Phân tích giải pháp, thiết kế kiến trúc, lập technical spec chi tiết và rà soát edge-cases.
   - **OpenCode (Primary Developer):** Thao tác trên code, viết mã, sửa file, chạy lệnh terminal test/lint, tuân thủ 6 Ràng Buộc Vàng.
   - **Antigravity (Auditor & Gatekeeper):** Phản biện chéo, bắt bẻ lỗ hổng logic, soát `git diff` 2 chiều, nghiệm thu cuối cùng.

---

## 2. Quy Trình 4 Bước Cho Tác Vụ Deep Triad

### Bước 1: Phát thảo ý tưởng & Lập Spec (Claude)
- Phân tích yêu cầu và xuất trực tiếp bản thiết kế kỹ thuật:
  - Mục tiêu cụ thể và phạm vi ảnh hưởng.
  - Danh sách chính xác các file cần tạo mới hoặc chỉnh sửa.
  - Các trường hợp ngoại lệ (edge-cases), rủi ro bảo mật.

### Bước 2: Phản biện chéo ý tưởng (Antigravity)
- Rà soát xem thiết kế có làm vỡ logic cũ không, có vấn đề bảo mật hay performance không.
- Bổ sung các ca kiểm thử hoặc điều kiện biên còn thiếu.
- Thống nhất bản Blueprint cuối cùng rồi mới bàn giao cho OpenCode.

### Bước 3: Dev chính thực thi trực tiếp (OpenCode)
- Sửa đổi chính xác theo spec đã duyệt, giữ trọn vẹn comment và convention sẵn có của dự án.
- Tuyệt đối tuân thủ an toàn: Không `git reset --hard`, không `git push -f`, không sửa file bí mật (`.env*`).
- Chạy trực tiếp các lệnh kiểm tra (`npm test`, `npm run lint`, `npx tsc`) và in kết quả nguyên văn lên màn hình.

### Bước 4: Soát lỗi 2 chiều & Nghiệm thu (Antigravity)
- Đọc toàn bộ `git diff` trực tiếp và đánh giá chất lượng.
- Đảm bảo 100% test pass, không có code thừa, memory leak hay lỗ hổng.
- Khi đạt yêu cầu -> Xác nhận hoàn thành và bàn giao cho người dùng.

---

## 3. Cẩm Nang Tự Phục Hồi Lỗi (Self-Healing Playbook)

Mọi Agent phải nắm rõ và tự động áp dụng các giải pháp đã kiểm chứng:
1. **Lỗi mất CSS Next.js:** Tuyệt đối không dùng `--webpack`. Luôn dùng `next dev` với Turbopack vì dự án dùng Tailwind v4 (`@tailwindcss/turbopack`).
2. **Lỗi Vercel Hobby Cron:** Cấu hình cron trong `vercel.json` luôn đặt `0 0 * * *` (tối đa 1 lần/ngày).
3. **Lỗi Git Windows Lock:** Chạy chế độ unsandboxed hoặc dọn dẹp background process trước khi thực thi lệnh Git.
4. **Deploy tự động:** Chạy `npm run deploy` để tự động hóa toàn bộ quy trình test, git push và kích hoạt Vercel/Render.
