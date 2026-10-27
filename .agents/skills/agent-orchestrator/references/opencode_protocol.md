# OpenCode Orchestration Protocol

Giao thức điều phối và giám sát OpenCode CLI / Server.

## 1. Kiến trúc OpenCode

OpenCode hoạt động theo mô hình client-server hoặc background service:
- **Service**: Chạy ngầm tại `http://127.0.0.1:<port>` (kiểm tra bằng `opencode service status`).
- **Binary thực thi**: `opencode.exe` (trên Windows: `%APPDATA%\npm\node_modules\@opencode\cli\bin\opencode.exe`).
- **Session**: Mỗi phiên làm việc gắn liền với một thư mục dự án (`location.directory`).

---

## 2. Các bước điều phối chuẩn

### Bước 1: Tìm đúng phiên làm việc (Session Discovery)
Dùng `opencode api GET /api/session` hoặc `opencode session list` để lấy danh sách các phiên.
So sánh `location.directory` với thư mục làm việc hiện tại (CWD), sắp xếp theo `time.updated` mới nhất:

```bash
opencode api GET /api/session
```

JSON trả về:
```json
{
  "data": [
    {
      "id": "ses_e884a96cffferZbzZTfZAoqLhG",
      "projectID": "...",
      "agent": "build",
      "time": {
        "created": 1793009740313,
        "updated": 1793017591804,
        "idle": 1793017591812
      },
      "location": {
        "directory": "C:\\Users\\...\\Paint Code Lookup SaaS"
      }
    }
  ]
}
```

### Bước 2: Gói prompt với Ràng buộc & Tiêu chuẩn an toàn (Prompt Guardrails)
Luôn bọc nội dung công việc trong khung quy tắc:
1. **Ràng buộc cấm (DO NOT)**:
   - Không rewrite git history (không `git reset --hard`, không `rebase`, không `git push --force`).
   - Không tự tiện `git push` hay xóa branch.
   - Không đọc hoặc sửa file chứa bí mật (`.env`, `.env.local`, credentials, tokens).
2. **Cột mốc báo cáo**: Báo cáo ngắn gọn sau mỗi bước lớn.
3. **Chốt hoàn thành**: Kết thúc câu trả lời cuối bằng chuỗi đánh dấu: `XONG-TOAN-BO`.
4. **Xử lý mơ hồ**: Nếu gặp điều mơ hồ hoặc rủi ro cao, dừng lại hỏi ngay thay vì tự suy đoán.

### Bước 3: Gửi việc vào phiên (Task Dispatch)

**Cách 1 - Qua HTTP API (Khuyến nghị cho chạy ngầm / không chiếm terminal):**
```bash
opencode api POST /api/session/<sessionID>/prompt -d "{\"text\": \"<noi_dung_prompt_da_boc>\"}"
```

**Cách 2 - Qua CLI runner (Đồng bộ):**
```bash
opencode run -s <sessionID> --auto "<noi_dung_prompt_da_boc>"
```

### Bước 4: Theo dõi tiến độ (Progress Monitoring)

1. **Kiểm tra trạng thái session**:
   ```bash
   opencode api GET /api/session/<sessionID>
   ```
   - Khi đang chạy: `time.idle < time.updated` hoặc chưa hoàn thành.
   - Khi hoàn thành: `outcome: "succeeded"` và `time.idle` được cập nhật.

2. **Đọc chuỗi thông điệp và lệnh đã chạy**:
   ```bash
   opencode api GET /api/session/<sessionID>/message
   ```
   Lọc các thông điệp có `type == "assistant"`:
   - `content[].type == "reasoning"`: Suy nghĩ của agent.
   - `content[].type == "tool"`: Tên lệnh shell, file edit, trạng thái (`completed`), output.
   - `content[].type == "text"`: Phản hồi của agent.
   - Dò chuỗi `XONG-TOAN-BO` trong `content[].text` để xác định đã hoàn tất.

3. **Kiểm tra xem có bị nghẽn chờ duyệt lệnh không**:
   ```bash
   opencode api GET /api/session/<sessionID>/permission
   ```
   Nếu `data` có phần tử, nghĩa là OpenCode đang chờ người dùng xác nhận thao tác. Có thể gửi phản hồi duyệt hoặc thông báo cho người dùng.

### Bước 5: Can thiệp và chỉnh hướng (Intervention)
- Nếu agent đi chệch hướng: Gửi tiếp một prompt điều chỉnh qua `/api/session/<sessionID>/prompt`.
- Nếu agent chạy vô tận hoặc gặp sự cố:
  ```bash
  opencode api POST /api/session/<sessionID>/interrupt
  ```
