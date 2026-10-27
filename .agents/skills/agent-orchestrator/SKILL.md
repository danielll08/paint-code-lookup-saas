---
name: agent-orchestrator
description: >-
  Orchestrate, supervise, and control external coding agents (OpenCode, Codex CLI,
  Claude Code, Aider) non-interactively in the background. Use when the user wants to dispatch
  tasks to external agent CLIs, monitor execution progress without blocking interactive terminals,
  enforce strict safety guardrails and completion tokens, poll structured events, and steer or unblock the worker agent.
  Automatically triggers on phrases like "điều phối <agent> <số lượng>", "điều phối opencode", "điều phối codex".
---

# Agent Orchestrator Skill

Skill điều phối và giám sát các coding agent độc lập (OpenCode, OpenAI Codex CLI, Claude Code, Aider, v.v.) hoạt động ngầm. Tích hợp sâu với **Orca Orchestration** để quản lý đa worker (multi-agent fleet) qua terminal tabs và worktrees.

---

## 1. Cú pháp kích hoạt nhanh (Shortcut Trigger)

Bất kỳ khi nào người dùng nhập cú pháp:
```text
điều phối + [tên agent] + [số lượng] + [nội dung công việc]
```

Ví dụ:
- `điều phối opencode 1: kiểm tra toàn bộ lỗi typecheck và lint`
- `điều phối opencode 2: chia task Agent 1 làm UI, Agent 2 viết unit test`
- `điều phối codex 1: fix bug auth`
- `điều phối claude 3: refactor code theo 3 module độc lập`
- `điều phối opencode: rà soát code` (mặc định số lượng là 1)

Hệ thống sẽ **tự động**:
1. Bóc tách tên agent, số lượng worker $N$, và nội dung nhiệm vụ.
2. Với $N = 1$: Kết nối session đang mở hoặc khởi chạy qua `orca agent launch --agent <tên>`.
3. Với $N \ge 2$: Sử dụng Orca Orchestration để mở $N$ worker song song, phân chia ranh giới công việc.
4. Bọc toàn bộ prompt bằng **Khung 6 Ràng buộc Vàng**.
5. Đẩy việc ngầm và theo dõi cho đến khi thu thập đủ token `XONG-TOAN-BO` từ toàn bộ worker.

---

## 2. Nguyên lý 5 Trụ cột Điều phối (5-Pillar Architecture)

```
[1. Target Discovery] ──► [2. Prompt Guardrail] ──► [3. Queue Dispatch]
                                                             │
[5. Supervise & Steer] ◄─────────────────────────── [4. Structured Monitor]
```

1. **Target Discovery (Tìm đúng phiên / Khởi tạo worker):**
   - Xác định phiên làm việc đang chạy tương ứng với thư mục dự án (`CWD`).
   - Kiểm tra qua OpenCode API (`/api/session`), Codex SQLite (`~/.codex/state_5.sqlite`), hoặc Orca (`orca terminal list --worktree current`).
   - Nếu cần mở thêm worker: Dùng `orca agent launch --agent <id>`.
2. **Prompt Guardrail Contract (Khung an toàn):**
   - Bọc công việc vào bản hợp đồng: cấm rewrite git history, cấm push repo, cấm đọc/ghi secrets, yêu cầu báo cáo checkpoint và chốt bằng chuỗi đánh dấu sentinel `XONG-TOAN-BO`.
3. **Queue Dispatch (Đẩy việc vào hàng đợi):**
   - Sử dụng API hoặc lệnh CLI chính thức (`codex queue` hoặc `opencode api /prompt` hoặc `orca terminal send`) để gửi việc vào phiên mà không can thiệp vào cửa sổ tương tác của người dùng.
4. **Structured Monitor (Theo dõi có cấu trúc):**
   - Giám sát tiến độ qua SQLite, REST API hoặc Orca events thay vì cào terminal.
   - Bắt các sự kiện: lệnh thực thi, exit code, reasoning, và sentinel token.
5. **Supervise & Steer (Giám sát & Can thiệp):**
   - Tự động phát hiện agent kẹt chờ duyệt quyền (`permission approval`) hoặc đi lệch hướng để uốn nắn hoặc cảnh báo.

---

## 3. Tiêu chuẩn Soạn thảo Prompt Điều phối (Standard Prompt Contract)

Bất kỳ khi nào gửi việc cho worker agent, bắt buộc áp dụng mẫu sau:

```text
[NHIỆM VỤ ĐIỀU PHỐI / ORCHESTRATION TASK]
<Nội dung việc chi tiết, mục tiêu cụ thể, file liên quan>

---
[RÀNG BUỘC BẮT BUỘC / STRICT CONSTRAINTS]:
1. KHÔNG rewrite git history (tuyệt đối không git reset --hard, không git push -f, không git rebase).
2. KHÔNG tự ý push lên remote repository hoặc xóa branch.
3. KHÔNG chỉnh sửa hoặc in lộ nội dung các file bí mật (.env, .env.local, tokens, credentials).
4. Nếu gặp bất kỳ điểm nào mơ hồ hoặc rủi ro cao: DỪNG LẠI và hỏi/chờ xác nhận, không được tự suy đoán.
5. Báo cáo ngắn gọn tiến độ sau mỗi bước hoàn thành.
6. Khi đã hoàn tất TOÀN BỘ công việc được giao, hãy kết thúc câu trả lời cuối cùng bằng chính xác chuỗi: XONG-TOAN-BO
```

---

## 4. Tài liệu & Script hỗ trợ
- [opencode_protocol.md](./references/opencode_protocol.md): Hướng dẫn chi tiết OpenCode API/CLI.
- [codex_protocol.md](./references/codex_protocol.md): Hướng dẫn chi tiết Codex SQLite.
- [opencode_orchestrator.mjs](./scripts/opencode_orchestrator.mjs): Bộ công cụ điều phối Node.js.
- [opencode_orchestrator.ps1](./scripts/opencode_orchestrator.ps1): Bộ công cụ điều phối PowerShell.
- [codex_orchestrator.sh](./scripts/codex_orchestrator.sh): Bộ công cụ điều phối Codex Bash.
