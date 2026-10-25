// One-time setup for the local stack: downloads PostgREST + stripe-mock for this
// OS into e2e/.bin and installs Playwright's Chromium.   npm run e2e:setup
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E2E = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(E2E, ".bin");
const EXE = process.platform === "win32" ? ".exe" : "";
const require = createRequire(path.join(E2E, "..", "package.json"));

const POSTGREST = "v16.5";
const STRIPE_MOCK = "0.206.0";
const key = `${process.platform}-${process.arch}`;

const ASSETS = {
  "win32-x64": [`postgrest-${POSTGREST}-windows-x86-64.zip`, `stripe-mock_${STRIPE_MOCK}_windows_amd64.zip`],
  "linux-x64": [`postgrest-${POSTGREST}-linux-static-x86-64.tar.xz`, `stripe-mock_${STRIPE_MOCK}_linux_amd64.tar.gz`],
  "linux-arm64": [`postgrest-${POSTGREST}-linux-static-aarch64.tar.xz`, `stripe-mock_${STRIPE_MOCK}_linux_arm64.tar.gz`],
  "darwin-arm64": [`postgrest-${POSTGREST}-macos-aarch64.tar.xz`, `stripe-mock_${STRIPE_MOCK}_darwin_arm64.tar.gz`],
  "darwin-x64": [`postgrest-${POSTGREST}-macos-x86-64.tar.xz`, `stripe-mock_${STRIPE_MOCK}_darwin_amd64.tar.gz`],
}[key];
if (!ASSETS) {
  console.error(`Unsupported platform ${key}`);
  process.exit(1);
}

// Windows' bundled bsdtar extracts .zip; GNU tar (e.g. from Git Bash) does not.
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

async function install(tool, url) {
  const target = path.join(BIN, `${tool}${EXE}`);
  if (fs.existsSync(target)) {
    console.log(`✓ ${tool} already installed`);
    return;
  }
  console.log(`↓ ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `${tool}-`));
  const archive = path.join(work, path.basename(url));
  fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  const extracted = path.join(work, "x");
  fs.mkdirSync(extracted);
  const result = spawnSync(TAR, ["-xf", archive, "-C", extracted], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Could not extract ${archive}`);
  const binary = findFile(extracted, `${tool}${EXE}`);
  if (!binary) throw new Error(`${tool}${EXE} not found in ${url}`);
  fs.copyFileSync(binary, target);
  fs.chmodSync(target, 0o755);
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`✓ ${tool} -> ${path.relative(process.cwd(), target)}`);
}

fs.mkdirSync(BIN, { recursive: true });
await install("postgrest", `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST}/${ASSETS[0]}`);
await install("stripe-mock", `https://github.com/stripe/stripe-mock/releases/download/v${STRIPE_MOCK}/${ASSETS[1]}`);

console.log("↓ Playwright Chromium");
const playwrightCli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
const pw = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], { stdio: "inherit" });
process.exit(pw.status ?? 1);
