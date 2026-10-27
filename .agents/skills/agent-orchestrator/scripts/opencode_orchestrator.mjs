#!/usr/bin/env node
/**
 * OpenCode CLI & API Orchestrator
 * Điều phối, gửi việc an toàn, theo dõi tiến độ và can thiệp OpenCode.
 */

import { execFileSync, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const COMPLETION_MARKER_DEFAULT = 'XONG-TOAN-BO';

function getOpenCodeBin() {
  if (process.platform === 'win32') {
    const defaultWinBin = path.join(
      process.env.APPDATA || '',
      'npm',
      'node_modules',
      '@opencode',
      'cli',
      'bin',
      'opencode.exe'
    );
    if (fs.existsSync(defaultWinBin)) return defaultWinBin;
  }
  return 'opencode';
}

function callApi(method, endpoint, body = null, extraArgs = []) {
  const bin = getOpenCodeBin();
  const args = ['api', method, endpoint, ...extraArgs];

  if (body) {
    args.push('-d', JSON.stringify(body));
  }

  try {
    const raw = execFileSync(bin, args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    });
    return raw.trim() ? JSON.parse(raw) : null;
  } catch (err) {
    const errOutput = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`OpenCode API error [${method} ${endpoint}]: ${errOutput}`);
  }
}

/**
 * Tìm session phù hợp với thư mục dự án
 */
export function findSession(targetDir = process.cwd()) {
  const normalizedTarget = path.resolve(targetDir).toLowerCase();
  const res = callApi('GET', '/api/session');
  if (!res || !res.data || res.data.length === 0) {
    return null;
  }

  const matching = res.data.filter((s) => {
    if (!s.location || !s.location.directory) return false;
    return path.resolve(s.location.directory).toLowerCase() === normalizedTarget;
  });

  if (matching.length > 0) {
    matching.sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0));
    return matching[0];
  }

  // Fallback sang session có updated mới nhất toàn cục nếu không khớp chính xác
  res.data.sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0));
  return res.data[0];
}

/**
 * Bọc prompt bằng bộ khung ràng buộc an toàn (Safety Guardrails)
 */
export function wrapPrompt(taskText, marker = COMPLETION_MARKER_DEFAULT, extraConstraints = []) {
  const defaultConstraints = [
    'KHÔNG rewrite git history (tuyệt đối không git reset --hard, không git push -f, không rebase).',
    'KHÔNG tự ý push lên remote repository hoặc xóa branch.',
    'KHÔNG chỉnh sửa hoặc in lộ nội dung các file bí mật (.env, .env.local, tokens, credentials).',
    'Nếu gặp bất kỳ điểm nào mơ hồ hoặc rủi ro cao: DỪNG LẠI và hỏi/chờ xác nhận, không được tự suy đoán.',
    'Báo cáo ngắn gọn tiến độ sau mỗi bước hoàn thành.',
    `Khi đã hoàn tất TOÀN BỘ công việc được giao, hãy kết thúc câu trả lời cuối cùng bằng chính xác chuỗi: ${marker}`,
  ];

  const allConstraints = [...defaultConstraints, ...extraConstraints];

  return `[NHIỆM VỤ ĐIỀU PHỐI / ORCHESTRATION TASK]
${taskText.trim()}

---
[RÀNG BUỘC BẮT BUỘC / STRICT CONSTRAINTS]:
${allConstraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`;
}

/**
 * Gửi việc vào session
 */
export function sendTask(sessionId, taskText, marker = COMPLETION_MARKER_DEFAULT, extraConstraints = []) {
  const wrapped = wrapPrompt(taskText, marker, extraConstraints);
  const res = callApi('POST', `/api/session/${sessionId}/prompt`, {
    text: wrapped,
    resume: true,
  });
  return { success: true, sessionId, wrappedPrompt: wrapped, response: res };
}

/**
 * Kiểm tra quyền đang chờ duyệt (Pending permissions)
 */
export function checkPermissions(sessionId) {
  const res = callApi('GET', `/api/session/${sessionId}/permission`);
  return res?.data || [];
}

/**
 * Giám sát phiên làm việc
 */
export async function watchSession(sessionId, marker = COMPLETION_MARKER_DEFAULT, options = {}) {
  const pollIntervalMs = options.pollIntervalMs || 2500;
  const timeoutMs = options.timeoutMs || 300000; // 5 phút
  const startTime = Date.now();
  let seenMessageIds = new Set();
  let lastState = null;

  console.log(`[Orchestrator] Bắt đầu theo dõi session: ${sessionId}`);
  console.log(`[Orchestrator] Mốc đánh dấu hoàn tất: "${marker}"`);

  // Nạp các message hiện có để không in lại lịch sử cũ
  try {
    const initial = callApi('GET', `/api/session/${sessionId}/message`, null, ['--param', 'order=desc', '--param', 'limit=50']);
    if (initial?.data) {
      initial.data.forEach((m) => seenMessageIds.add(m.id));
    }
  } catch (e) {
    // Session mới có thể chưa có message
  }

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    // 1. Kiểm tra session info
    const sessionInfo = callApi('GET', `/api/session/${sessionId}`)?.data;
    if (!sessionInfo) continue;

    // 2. Kiểm tra permissions
    const perms = checkPermissions(sessionId);
    if (perms.length > 0) {
      console.warn(`\n⚠️ [CẢNH BÁO] OpenCode đang chờ duyệt quyền cho ${perms.length} thao tác!`);
      perms.forEach((p) => {
        console.warn(` - Request ID: ${p.id}, Tool: ${p.tool || 'Unknown'}, Action: ${JSON.stringify(p.input || {})}`);
      });
    }

    // 3. Đọc messages mới nhất (hỗ trợ phân trang cho session dài)
    const msgRes = callApi('GET', `/api/session/${sessionId}/message`, null, ['--param', 'order=desc', '--param', 'limit=20']);
    if (msgRes?.data) {
      const recent = [...msgRes.data].reverse();
      for (const msg of recent) {
        if (!seenMessageIds.has(msg.id)) {
          seenMessageIds.add(msg.id);

          if (msg.type === 'assistant' && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === 'tool') {
                const cmd = part.state?.input?.command || JSON.stringify(part.state?.input || {});
                console.log(`⚡ [Tool Call] ${part.name || 'tool'}: ${cmd}`);
                if (part.state?.status === 'completed') {
                  console.log(`   └─ Trạng thái: hoàn tất`);
                }
              } else if (part.type === 'text') {
                console.log(`💬 [OpenCode Assistant]:\n${part.text}\n`);
                if (part.text.includes(marker)) {
                  console.log(`\n🎯 [Hoàn thành] Phát hiện mốc "${marker}"!`);
                  return {
                    completed: true,
                    outcome: 'succeeded',
                    markerFound: true,
                    finalMessage: part.text,
                    sessionInfo,
                  };
                }
              }
            }
          } else if (msg.type === 'idle' && msg.outcome === 'succeeded') {
            console.log(`\n🏁 [Idle] Session đã chuyển sang trạng thái nhàn rỗi (idle).`);
            return {
              completed: true,
              outcome: 'succeeded',
              markerFound: false,
              sessionInfo,
            };
          }
        }
      }
    }

    // Kiểm tra nếu idle sau khi đã bắt đầu
    if (sessionInfo.time?.idle && sessionInfo.time?.idle >= (sessionInfo.time?.updated || 0)) {
      if (Date.now() - startTime > 10000) { // Chờ ít nhất 10s để tránh bắt nhầm mốc idle ban đầu
        return {
          completed: true,
          outcome: sessionInfo.outcome || 'idle',
          markerFound: false,
          sessionInfo,
        };
      }
    }
  }

  return { completed: false, timeout: true };
}

// CLI handler
const [,, command, ...rest] = process.argv;

if (command === 'find') {
  const dir = rest[0] || process.cwd();
  const session = findSession(dir);
  console.log(JSON.stringify(session, null, 2));
} else if (command === 'send') {
  const sessionId = rest[0];
  const task = rest.slice(1).join(' ');
  if (!sessionId || !task) {
    console.error('Usage: node opencode_orchestrator.mjs send <sessionId> <task...>');
    process.exit(1);
  }
  const res = sendTask(sessionId, task);
  console.log(JSON.stringify(res, null, 2));
} else if (command === 'watch') {
  const sessionId = rest[0];
  const marker = rest[1] || COMPLETION_MARKER_DEFAULT;
  if (!sessionId) {
    console.error('Usage: node opencode_orchestrator.mjs watch <sessionId> [marker]');
    process.exit(1);
  }
  watchSession(sessionId, marker).then((res) => {
    console.log('\n[Kết quả giám sát]:', JSON.stringify(res, null, 2));
  });
} else if (command === 'orchestrate') {
  const task = rest.join(' ');
  if (!task) {
    console.error('Usage: node opencode_orchestrator.mjs orchestrate <task...>');
    process.exit(1);
  }
  const session = findSession(process.cwd());
  if (!session) {
    console.error('Không tìm thấy session OpenCode nào cho thư mục này!');
    process.exit(1);
  }
  console.log(`[Orchestrator] Điều phối phiên ${session.id} (Dự án: ${session.location?.directory})`);
  sendTask(session.id, task);
  watchSession(session.id, COMPLETION_MARKER_DEFAULT).then((res) => {
    console.log('\n[Orchestrator] Kết quả điều phối:', JSON.stringify(res, null, 2));
  });
}
