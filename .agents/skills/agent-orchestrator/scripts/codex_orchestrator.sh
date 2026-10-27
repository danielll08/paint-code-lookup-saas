#!/usr/bin/env bash
# Codex Orchestration Helper Script
# Dùng để tìm session, gửi việc vào codex queue và poll SQLite

set -euo pipefail

MARKER_DEFAULT="XONG-TOAN-BO"
STATE_DB="${HOME}/.codex/state_5.sqlite"
HISTORY_DB="${HOME}/.codex/thread_history_1.sqlite"

find_thread() {
  local target_cwd="${1:-$(pwd)}"
  echo "[Codex] Tìm thread cho thư mục: ${target_cwd}" >&2

  if [ ! -f "$STATE_DB" ]; then
    echo "Lỗi: Không tìm thấy file DB ${STATE_DB}" >&2
    exit 1
  fi

  local thread_id
  thread_id=$(sqlite3 "$STATE_DB" "SELECT id FROM threads WHERE cwd='${target_cwd}' ORDER BY updated_at DESC LIMIT 1;")

  if [ -z "$thread_id" ]; then
    echo "Không tìm thấy thread nào khớp cwd. Lấy thread mới nhất toàn cục..." >&2
    thread_id=$(sqlite3 "$STATE_DB" "SELECT id FROM threads ORDER BY updated_at DESC LIMIT 1;")
  fi

  echo "$thread_id"
}

format_prompt() {
  local task="$1"
  local marker="${2:-$MARKER_DEFAULT}"

  cat <<EOF
[NHIỆM VỤ ĐIỀU PHỐI / ORCHESTRATION TASK]
${task}

---
[RÀNG BUỘC BẮT BUỘC / STRICT CONSTRAINTS]:
1. KHÔNG rewrite git history (tuyệt đối không git reset --hard, không git push -f, không rebase).
2. KHÔNG tự ý push lên remote repository hoặc xóa branch.
3. KHÔNG chỉnh sửa hoặc in lộ nội dung các file bí mật (.env, .env.local, tokens, credentials).
4. Nếu gặp bất kỳ điểm nào mơ hồ hoặc rủi ro cao: DỪNG LẠI và hỏi/chờ xác nhận, không được tự suy đoán.
5. Báo cáo ngắn gọn tiến độ sau mỗi bước hoàn thành.
6. Khi đã hoàn tất TOÀN BỘ công việc được giao, hãy kết thúc câu trả lời cuối cùng bằng chính xác chuỗi: ${marker}
EOF
}

send_task() {
  local thread_id="$1"
  local task="$2"
  local marker="${3:-$MARKER_DEFAULT}"

  local prompt
  prompt=$(format_prompt "$task" "$marker")

  echo "[Codex] Đẩy việc vào thread ${thread_id}..."
  codex queue --thread "$thread_id" --message "$prompt"
}

watch_thread() {
  local thread_id="$1"
  local marker="${2:-$MARKER_DEFAULT}"
  local poll_interval=3

  echo "[Codex] Bắt đầu theo dõi thread ${thread_id} qua SQLite..."
  echo "[Codex] Chờ mốc hoàn tất: ${marker}"

  # Lấy ordinal cao nhất hiện tại
  local last_ordinal
  last_ordinal=$(sqlite3 "$HISTORY_DB" "SELECT COALESCE(MAX(updated_at_ordinal), 0) FROM thread_items WHERE thread_id='${thread_id}';")

  while true; do
    sleep "$poll_interval"

    # Query items mới
    local rows
    rows=$(sqlite3 -separator "|||" "$HISTORY_DB" \
      "SELECT updated_at_ordinal, item_type, json_extract(item_json, '$.text'), json_extract(item_json, '$.command'), json_extract(item_json, '$.status') \
       FROM thread_items \
       WHERE thread_id='${thread_id}' AND updated_at_ordinal > ${last_ordinal} \
       ORDER BY updated_at_ordinal ASC;")

    if [ -n "$rows" ]; then
      while IFS="|||" read -r ordinal item_type text command status; do
        last_ordinal="$ordinal"

        if [ "$item_type" = "commandExecution" ]; then
          echo "⚡ [Lệnh] ${command} (Trạng thái: ${status})"
        elif [ "$item_type" = "agentMessage" ]; then
          echo "💬 [Codex Assistant]:"
          echo "$text"
          echo ""

          if echo "$text" | grep -q "$marker"; then
            echo "🎯 [Hoàn thành] Đã phát hiện mốc đánh dấu ${marker}!"
            return 0
          fi
        fi
      done <<< "$rows"
    fi
  done
}

case "${1:-}" in
  find)
    find_thread "${2:-}"
    ;;
  send)
    send_task "$2" "$3" "${4:-$MARKER_DEFAULT}"
    ;;
  watch)
    watch_thread "$2" "${3:-$MARKER_DEFAULT}"
    ;;
  orchestrate)
    thread=$(find_thread "${3:-}")
    echo "Điều phối thread: ${thread}"
    send_task "$thread" "$2" "${4:-$MARKER_DEFAULT}"
    watch_thread "$thread" "${4:-$MARKER_DEFAULT}"
    ;;
  *)
    echo "Usage: $0 {find|send|watch|orchestrate} [args...]"
    exit 1
    ;;
esac
