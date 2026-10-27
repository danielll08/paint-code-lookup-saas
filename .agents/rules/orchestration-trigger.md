# Rule: Automatic Agent Orchestration Trigger (100% Foreground)

Bất kỳ khi nào người dùng gửi yêu cầu trong dự án, BẮT BUỘC kích hoạt quy trình phối hợp 3 Agent: **Claude × Antigravity × OpenCode** hoạt động trực tiếp, tuyệt đối không chạy ngầm.

## 1. Nguyên Tắc Điều Phối Trực Tiếp
- **Không chạy ngầm (Zero Background/Daemon):** Mọi lệnh terminal, file edit, kiểm tra test/lint và rà soát diff phải thực thi và hiển thị trực tiếp trên giao diện màn hình để người dùng quản lý.
- **Luôn luôn phối hợp cả 3 agent:**
  1. **Claude:** Soạn ý tưởng & Lập Technical Spec.
  2. **Antigravity:** Phản biện chéo, điều phối và nghiệm thu kiểm định.
  3. **OpenCode:** Dev chính, viết mã và chạy lệnh terminal trực tiếp.

## 2. Quy Trình Điều Phối 4 Bước Khép Kín
1. **Lập Spec (Claude):** Xuất bản thiết kế kiến trúc, danh sách file can thiệp, edge-cases trực tiếp.
2. **Phản biện chéo (Antigravity):** Soát lỗi kiến trúc, bổ sung test cases, chốt spec.
3. **Thực thi trực tiếp (OpenCode):** Thao tác code, chạy lệnh `npm test` / `npm run lint` trực tiếp trên terminal với output minh bạch; tuân thủ 6 Ràng Buộc Vàng và kết thúc bằng `XONG-TOAN-BO`.
4. **Nghiệm thu 2 chiều (Antigravity):** Soi `git diff`, kiểm tra an toàn và xác nhận hoàn tất bàn giao.
