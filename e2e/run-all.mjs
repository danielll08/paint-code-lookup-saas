// Orchestrates the local stack (e2e/stack.mjs) and the real Next.js app.
//
//   npm run test:e2e   fresh stack -> next build + start (:3200) -> e2e/run.mjs -> teardown
//   npm run demo       fresh stack -> seeded demo account -> next dev (:3000), until Ctrl+C
//
// No Supabase/Stripe account needed. Run `npm run e2e:setup` once first.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E2E = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(E2E, "..");
const OUT = path.join(E2E, ".output");
const require = createRequire(path.join(PROJECT, "package.json"));
const NEXT = require.resolve("next/dist/bin/next");
const GATEWAY = "http://127.0.0.1:55400";

const mode = process.argv[2] === "demo" ? "demo" : "test";
const skipBuild = process.argv.includes("--no-build");
const port = mode === "demo" ? 3000 : 3200;
fs.mkdirSync(OUT, { recursive: true });

const children = [];

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
}
function cleanup() {
  children.forEach(killTree);
}
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

/** Spawn a process, tee its output to a log file, resolve once `ready` matches. */
function start(name, command, args, { env = process.env, ready, logFile }) {
  const child = spawn(command, args, { cwd: PROJECT, env, detached: process.platform !== "win32" });
  children.push(child);
  const log = fs.createWriteStream(path.join(OUT, logFile));
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      log.write(chunk);
      if (mode === "demo") process.stdout.write(chunk);
      buffer += chunk;
      if (ready && ready.test(buffer)) {
        ready = null;
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (ready) reject(new Error(`${name} exited with code ${code} before it was ready - see e2e/.output/${logFile}`));
    });
  });
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: PROJECT, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${path.basename(args[0])} ${args[1] ?? ""} failed`);
}

async function seedDemoUser() {
  const email = "demo@paintcode.test";
  await fetch(`${GATEWAY}/auth/v1/signup?redirect_to=${encodeURIComponent(`http://localhost:${port}/auth/callback`)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Demo12345!", data: { full_name: "Demo Garage" } }),
  });
  const [mail] = await (await fetch(`${GATEWAY}/__test/mail?to=${email}`)).json();
  await fetch(mail.link, { redirect: "manual" }); // confirms the email address
  await fetch(`${GATEWAY}/__test/sql`, {
    method: "POST",
    body: JSON.stringify({
      sql: "SELECT public.grant_credits(id, 20, 'TOPUP_PURCHASE', 'evt_demo_seed', 'Demo top-up: +20 credits') FROM public.users WHERE email = $1",
      params: [email],
    }),
  });
}

try {
  console.log("▶ starting local Supabase/Stripe stack…");
  await start("stack", process.execPath, [path.join(E2E, "stack.mjs")], {
    env: { ...process.env, APP_PORT: String(port) },
    ready: /\[stack\] READY/,
    logFile: "stack.log",
  });
  const appEnv = {
    ...process.env,
    ...JSON.parse(fs.readFileSync(path.join(OUT, "app.env.json"), "utf8")),
    // Keep the e2e build (with its inlined test keys) away from the normal .next folder.
    NEXT_DIST_DIR: ".next-e2e",
  };

  if (mode === "demo") {
    await seedDemoUser();
    await start("next dev", process.execPath, [NEXT, "dev", "-p", String(port)], { env: appEnv, ready: /Ready in/, logFile: "app.log" });
    console.log(`
  ┌──────────────────────────────────────────────────────────────┐
    App:            http://localhost:${port}
    Demo login:     demo@paintcode.test / Demo12345!  (20 credits)
    Sign-up emails: ${GATEWAY}/__test/mail
    Test plates:    AB12CDE (found) NF.. NP.. ER.. SL.. FO.. (see README)
    Press Ctrl+C to stop (all data is discarded).
  └──────────────────────────────────────────────────────────────┘`);
    await new Promise(() => {}); // keep running until Ctrl+C
  }

  if (!skipBuild) {
    console.log("▶ next build…");
    run(process.execPath, [NEXT, "build"], appEnv);
  }
  console.log(`▶ next start -p ${port}…`);
  await start("next start", process.execPath, [NEXT, "start", "-p", String(port)], { env: appEnv, ready: /Ready in/, logFile: "app.log" });

  console.log("▶ running e2e checks…");
  const result = spawnSync(process.execPath, [path.join(E2E, "run.mjs")], { cwd: PROJECT, stdio: "inherit" });

  const serverErrors = fs
    .readFileSync(path.join(OUT, "app.log"), "utf8")
    .split("\n")
    .filter((line) => /\bError\b/.test(line));
  if (serverErrors.length) console.log(`\n✖ ${serverErrors.length} server error line(s) in e2e/.output/app.log:\n${serverErrors.slice(0, 5).join("\n")}`);
  else console.log("✓ no server errors logged");

  cleanup();
  process.exit(result.status === 0 && serverErrors.length === 0 ? 0 : 1);
} catch (error) {
  console.error(`✖ ${error.message}`);
  cleanup();
  process.exit(1);
}
