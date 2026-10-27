#!/usr/bin/env node
/**
 * Autonomous Render Deployment Script
 * Triggers deployment on Render via Deploy Hook URL or Render API.
 */
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

const env = { ...process.env, ...loadEnv() };
const hookUrl = env.RENDER_DEPLOY_HOOK_URL;
const apiKey = env.RENDER_API_KEY;
const serviceId = env.RENDER_SERVICE_ID;

console.log("▶ [Deploy:Render] Starting autonomous Render deployment…");

if (!hookUrl && !(apiKey && serviceId)) {
  console.log("ℹ [Deploy:Render] No RENDER_DEPLOY_HOOK_URL or RENDER_API_KEY found in .env.local.");
  console.log("ℹ [Deploy:Render] In Render Dashboard -> Settings -> Deploy Hook, copy the URL and add to .env.local:");
  console.log("     RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxx?key=yyyy");
  console.log("ℹ [Deploy:Render] If render.yaml Blueprint is connected to GitHub, Git push automatically deploys to Render.");
  process.exit(0);
}

try {
  if (hookUrl) {
    console.log("▶ [Deploy:Render] Triggering Render Deploy Hook…");
    const res = await fetch(hookUrl, { method: "POST" });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Deploy Hook returned HTTP ${res.status}: ${text}`);
    }
    console.log("✓ [Deploy:Render] Render deploy hook triggered successfully:", text);
  } else if (apiKey && serviceId) {
    console.log("▶ [Deploy:Render] Triggering Render API…");
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Render API returned HTTP ${res.status}: ${JSON.stringify(data)}`);
    }
    console.log("✓ [Deploy:Render] Render deploy created successfully. Deploy ID:", data.id);
  }
} catch (err) {
  console.error("✖ [Deploy:Render] Deployment error:", err.message);
  process.exit(1);
}
