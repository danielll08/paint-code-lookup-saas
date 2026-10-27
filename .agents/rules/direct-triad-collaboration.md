# Rule: Quy Trình Phối Hợp Tam Giác Trực Tiếp (Claude × Antigravity × OpenCode)

Quy định chuẩn phối hợp làm việc giữa 3 agent: **Claude**, **Antigravity**, và **OpenCode**.

---

## 1. Nguyên Tắc Cốt Lõi

1. **Tuyệt đối chạy trực tiếp (100% Foreground - No Background Tasks):**
   - Mọi thao tác đọc/ghi file, chỉnh sửa code và chạy lệnh terminal phải được thực thi TRỰC TIẾP, hiển thị log và kết quả rõ ràng trên màn hình.
   - Tuyệt đối không spawn process chạy ngầm (no daemon, no background queue ẩn). Người dùng phải luôn nhìn thấy tiến độ và có thể dừng/can thiệp bất kỳ lúc nào.
2. **Tự động phân vai theo thế mạnh (Dynamic Role Selection):**
   - Với mỗi bài toán, hệ thống tự động đánh giá và chỉ định vai trò tối ưu:
     - **Con Ý Tưởng Tốt Nhất (Lead Ideator & Architect)** (Ưu tiên Claude hoặc Antigravity): Chịu trách nhiệm phân tích giải pháp, thiết kế kiến trúc, lập technical spec chi tiết và rà soát edge-cases.
     - **Con Dev Chính (Primary Developer)** (Ưu tiên OpenCode): Chịu trách nhiệm trực tiếp thao tác trên code, viết mã, sửa file và chạy lệnh terminal test/lint.
     - **Con Kiểm Định (Auditor / Checker)** (Bên còn lại): Đóng vai trò phản biện, bắt bẻ lỗ hổng logic, soát lỗi an toàn và kiểm tra chéo (cross-check).
3. **Vòng lặp kiểm tra chặt chẽ (Strict Double-Check Loop):**
   - Áp dụng triệt để quy trình kiểm tra đi kiểm tra lại: Không bao giờ code trước khi chốt spec, và không bao giờ chốt bàn giao khi chưa qua rà soát diff 2 chiều.

---

## 2. Quy Trình 4 Bước Thực Thi Trực Tiếp

### Bước 1: Phát thảo ý tưởng & Lập Spec (Ideation & Spec)
- Con Ý Tưởng phân tích yêu cầu và xuất trực tiếp bản thiết kế kỹ thuật:
  - Mục tiêu cụ thể và phạm vi ảnh hưởng.
  - Kiến trúc giải pháp (kèm ưu/nhược điểm so với giải pháp khác).
  - Danh sách chính xác các file cần tạo mới hoặc chỉnh sửa.
  - Các trường hợp ngoại lệ (edge-cases), rủi ro tiềm ẩn.
- **Checkpoint**: Dừng lại hiển thị trực tiếp để Con Kiểm Định và Người dùng kiểm tra trước khi chuyển sang bước viết code.

### Bước 2: Phản biện chéo ý tưởng (Challenger & Counter-Check)
- Con Kiểm Định đóng vai phản biện khắt khe:
  - Rà soát xem thiết kế có làm vỡ logic cũ không, có vấn đề bảo mật hay performance không.
  - Bổ sung các ca kiểm thử hoặc điều kiện biên còn thiếu.
- Thống nhất bản Blueprint cuối cùng rồi mới bàn giao cho Con Dev Chính.

### Bước 3: Dev chính thực thi trực tiếp (Direct Implementation)
- Con Dev Chính tiến hành code trực tiếp:
  - Sửa đổi chính xác theo spec đã duyệt, giữ trọn vẹn comment và convention sẵn có của dự án.
  - Tuyệt đối tuân thủ an toàn: Không `git reset --hard`, không `git push -f`, không sửa file bí mật (`.env`, credentials).
  - Chạy trực tiếp các lệnh kiểm tra (`npm test`, `npm run lint`, `npx tsc`) và in kết quả nguyên văn lên màn hình để Người dùng giám sát.

### Bước 4: Soát lỗi 2 chiều & Nghiệm thu (Cross-Verification & Sign-off)
- Con Kiểm Định đọc toàn bộ `git diff` trực tiếp và đánh giá:
  - Đã bám sát 100% spec chưa?
  - Có code rác, memory leak hay lỗ hổng bảo mật nào không?
- Nếu còn lỗi -> Con Dev Chính phải sửa lại trực tiếp ngay tại chỗ (vòng lặp lặp lại cho đến khi pass hoàn toàn).
- Khi tất cả tiêu chí đều đạt -> In báo cáo nghiệm thu rõ ràng kèm gợi ý lệnh commit.

---

## 3. Khung Báo Cáo Trực Quan Checkpoint

Mỗi giai đoạn bắt buộc hiển thị theo format trực tiếp:

```text
[ĐIỀU PHỐI TRỰC TIẾP: CLAUDE × ANTIGRAVITY × OPENCODE]
- Vai trò: [Ý tưởng: ...] | [Dev chính: ...] | [Kiểm định: ...]
- Giai đoạn: [BƯỚC 1/2/3/4] - [Tên nhiệm vụ]

--- [NỘI DUNG HIỂN THỊ TRỰC TIẾP] ---
<Spec kỹ thuật / Output lệnh terminal / Git diff kiểm tra>

--- [CHECKPOINT DUYỆT] ---
- Trạng thái kiểm tra: [PASS / FAIL]
- Phản biện từ Checker: [Đạt / Cần tinh chỉnh...]
- Bước tiếp theo: [Chờ người dùng xác nhận / Chuyển sang bước X]
```
