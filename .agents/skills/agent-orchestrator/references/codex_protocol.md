# Codex Orchestration Protocol

Giao thức điều phối và giám sát Codex CLI thông qua SQLite & hàng đợi CLI.

## 1. Tìm đúng phiên đang mở (Session Discovery)

1. **Tìm tiến trình:**
   ```bash
   ps aux | grep -i codex | grep -v grep
   ```
   Lọc dòng chạy binary codex thật (bỏ qua các tiến trình phụ trợ của ChatGPT app), lấy PID.

2. **Xác nhận thư mục làm việc (CWD):**
   ```bash
   lsof -p <PID> | grep cwd
   ```

3. **Truy vấn DB lưu trạng thái phiên:**
   Codex lưu trạng thái tại `~/.codex/state_5.sqlite`, bảng `threads` (cột: `id`, `cwd`, `title`, `updated_at`).
   ```bash
   sqlite3 ~/.codex/state_5.sqlite "SELECT id, cwd, title, updated_at FROM threads WHERE cwd='<CWD>' ORDER BY updated_at DESC LIMIT 5;"
   ```

4. **Đối chiếu hoạt động gần nhất:**
   Kiểm tra `~/.codex/thread_history_1.sqlite` (bảng `thread_items`). Thread nào có hoạt động gần nhất:
   ```bash
   sqlite3 ~/.codex/thread_history_1.sqlite "SELECT thread_id, max(created_at_ms) FROM thread_items GROUP BY thread_id ORDER BY max(created_at_ms) DESC LIMIT 5;"
   ```
   Thread nào khớp CWD và có thời gian khớp tiến trình đang chạy chính là thread đích.

---

## 2. Soạn nội dung việc & Gửi vào phiên (Task Dispatch)

### Khung ràng buộc bắt buộc:
- **Ràng buộc cấm:** Không rewrite git history, không git push, không đụng file chứa bí mật (.env, secrets).
- **Mốc báo cáo:** Báo cáo ngắn sau mỗi bước lớn.
- **Chuỗi đánh dấu:** Kết thúc toàn bộ bằng `XONG-TOAN-BO`.
- **Dừng khi mơ hồ:** Dừng và hỏi khi gặp rủi ro hoặc không rõ yêu cầu.

### Lệnh gửi hàng đợi chính thức:
```bash
codex queue --thread <UUID> --message "<nội dung việc đã bọc quy tắc>"
```
Lệnh này chỉ đẩy tin nhắn vào hàng đợi, không chiếm hoặc đụng vào terminal tương tác của người dùng.

---

## 3. Theo dõi tiến độ qua SQLite (Progress Monitoring)

Bảng `thread_items` trong `~/.codex/thread_history_1.sqlite` có các cột:
- `thread_id`
- `item_type`
- `item_json`
- `updated_at_ordinal` (dùng mốc này để bắt cả item mới lẫn item được cập nhật khi lệnh chạy xong có exitCode).

### Phân loại item_type quan trọng:
1. `agentMessage`: Nội dung tại `item_json.text` (lời agent giao tiếp).
2. `commandExecution`:
   - `item_json.command`: Lệnh đang/đã chạy.
   - `item_json.status`: Trạng thái (`completed`).
   - `item_json.exitCode`: Mã trả về.
   - `item_json.aggregatedOutput`: Kết quả chạy lệnh.

### Vòng lặp giám sát (Polling Loop):
Mỗi vài giây, query các item có `updated_at_ordinal > last_seen`:
```sql
SELECT updated_at_ordinal, item_type, json_extract(item_json, '$.text'), json_extract(item_json, '$.command'), json_extract(item_json, '$.status')
FROM thread_items
WHERE thread_id = '<UUID>' AND updated_at_ordinal > <LAST_SEEN>
ORDER BY updated_at_ordinal ASC;
```
Dò chuỗi `XONG-TOAN-BO` trong `agentMessage` để biết khi nào hoàn thành.

---

## 4. Giám sát & Can thiệp (Supervision & Steering)

- Đọc từng `agentMessage` và `commandExecution`.
- Nếu lệch hướng hoặc vi phạm ràng buộc: Gửi tiếp một lệnh `codex queue --thread <UUID> --message "..."` để uốn nắn.
- Nếu im lặng bất thường: Kiểm tra xem có đang chờ người dùng bấm duyệt (approval) trên terminal thật không.
