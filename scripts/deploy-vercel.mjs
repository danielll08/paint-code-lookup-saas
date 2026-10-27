#!/usr/bin/env node
/**
 * Autonomous Vercel Deployment Script
 * Runs production deployment to Vercel without manual browser interaction.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const res = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq !== -1) {
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      res[k] = v;
    }
  }
  return res;
}

function getVercelToken(env) {
  if (env.VERCEL_TOKEN) return env.VERCEL_TOKEN;
  try {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
    const authPath = path.join(appData, "com.vercel.cli", "Data", "auth.json");
    if (fs.existsSync(authPath)) {
      const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
      if (auth.token) return auth.token;
    }
  } catch {}
  return undefined;
}

const env = { ...process.env, ...loadEnv() };
const vercelToken = getVercelToken(env);
const vercelOrgId = env.VERCEL_ORG_ID || "team_o4H7p6vOtHm66PGXqi5lVEAa";
const vercelProjectId = env.VERCEL_PROJECT_ID || "prj_r8n42kkMoXjR4JlKPe35itIf5GJn";

console.log("▶ [Deploy:Vercel] Starting autonomous Vercel deployment…");

const args = ["deploy", "--prod", "--yes"];
if (vercelToken) {
  args.push("--token", vercelToken);
}

const npxCmd = process.platform === "win32" ? "vercel.cmd" : "vercel";
const deploy = spawnSync(npxCmd, args, {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    VERCEL_ORG_ID: vercelOrgId,
    VERCEL_PROJECT_ID: vercelProjectId,
    ...(vercelToken ? { VERCEL_TOKEN: vercelToken } : {}),
  },
});

if (deploy.status !== 0) {
  console.error("✖ [Deploy:Vercel] Vercel CLI deployment failed.");
  process.exit(deploy.status ?? 1);
}

console.log("✓ [Deploy:Vercel] Deployment to Vercel completed successfully!");
