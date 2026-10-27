#!/usr/bin/env node
/**
 * Autonomous Full Deployment Pipeline (GitHub + Vercel + Render)
 * Executes end-to-end tests, commits, pushes to GitHub, and triggers Vercel/Render deploys.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, description) {
  console.log(`\n▶ [Pipeline] ${description}…`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`✖ [Pipeline] Failed at step: ${description}`);
    process.exit(result.status ?? 1);
  }
}

console.log("=============================================================");
console.log("🚀 STARTING AUTONOMOUS END-TO-END DEPLOYMENT PIPELINE");
console.log("=============================================================");

// Step 1: Pre-flight Verification
run("npm", ["test"], "Running Unit & Integration Tests (vitest)");

// Step 2: Push latest code to GitHub (Auto-triggers GitHub CI/CD, Vercel & Render webhooks)
run("git", ["push", "origin", "main"], "Pushing latest commits to GitHub (origin/main)");

// Step 3: Trigger Vercel CLI Deployment (if token/configured)
run("node", ["scripts/deploy-vercel.mjs"], "Executing Vercel Deployment");

// Step 4: Trigger Render Deployment (if hook/configured)
run("node", ["scripts/deploy-render.mjs"], "Executing Render Deployment");

console.log("\n=============================================================");
console.log("🎉 ALL DEPLOYMENT PIPELINES EXECUTED SUCCESSFULLY!");
console.log("=============================================================");
