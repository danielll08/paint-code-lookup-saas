// Local stand-in for Supabase + Stripe so the real app can be exercised end to end:
//   * embedded PostgreSQL with the project's migrations
//   * PostgREST (what supabase-js talks to for .from()/.rpc())
//   * a gateway on :55400 that serves /rest/v1 -> PostgREST and emulates the
//     GoTrue endpoints the app uses (signup + email verify, password login,
//     PKCE code exchange, refresh, recovery, update user, Google OAuth authorize)
//     with real ES256-signed JWTs + JWKS.
//   * stripe-mock on :12111
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E2E = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(E2E, "..");
const OUT = path.join(E2E, ".output");
const BIN = path.join(E2E, ".bin");
const EXE = process.platform === "win32" ? ".exe" : "";
const APP_PORT = Number(process.env.APP_PORT ?? 3200);
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJECT, "package.json"));
const EmbeddedPostgres = require("embedded-postgres").default;
const pg = require("pg");

const PG_PORT = 55432;
const REST_PORT = 55433;
const GATEWAY_PORT = 55400;
const SUPABASE_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

// ---------------------------------------------------------------- keys / JWT
// Keys persist across restarts: the publishable key is inlined into the Next build.
const keyFile = path.join(OUT, "keys.json");
if (!fs.existsSync(keyFile)) {
  const pair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  fs.writeFileSync(keyFile, JSON.stringify({ private: pair.privateKey.export({ format: "jwk" }) }));
}
const privateKey = crypto.createPrivateKey({ key: JSON.parse(fs.readFileSync(keyFile, "utf8")).private, format: "jwk" });
const publicKey = crypto.createPublicKey(privateKey);
const KID = "e2e-key-1";
const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "ES256", use: "sig", key_ops: ["verify"] };
const JWKS = { keys: [publicJwk] };

function getGoogleOAuthCredentials() {
  let clientId = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID;
  let clientSecret = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    const envPath = path.join(PROJECT, ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const mId = line.match(/^SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID\s*=\s*(.*)$/);
        if (mId) clientId = mId[1].trim().replace(/^['"]|['"]$/g, "");
        const mSec = line.match(/^SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET\s*=\s*(.*)$/);
        if (mSec) clientSecret = mSec[1].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return { clientId, clientSecret };
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");
function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: KID }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.sign("sha256", Buffer.from(`${header}.${body}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${body}.${b64url(sig)}`;
}
function verifyJwt(token) {
  const [h, p, s] = (token ?? "").split(".");
  if (!s) return null;
  const ok = crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  if (!ok) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

const now = () => Math.floor(Date.now() / 1000);
const envFile = path.join(OUT, "app.env.json");
const previousEnv = fs.existsSync(envFile) ? JSON.parse(fs.readFileSync(envFile, "utf8")) : {};
const ANON_KEY = previousEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && verifyJwt(previousEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ? previousEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  : signJwt({ role: "anon", iss: "e2e", iat: now(), exp: now() + 86400 * 30 });
const SERVICE_KEY = previousEnv.SUPABASE_SECRET_KEY && verifyJwt(previousEnv.SUPABASE_SECRET_KEY)
  ? previousEnv.SUPABASE_SECRET_KEY
  : signJwt({ role: "service_role", iss: "e2e", iat: now(), exp: now() + 86400 * 30 });

// ---------------------------------------------------------------- postgres
// Fixed location so a run that was killed is cleaned up by the next one.
const dataDir = path.join(OUT, "pgdata");
fs.rmSync(dataDir, { recursive: true, force: true });
const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PG_PORT,
  persistent: false,
  onLog: () => {},
});
await server.initialise();
await server.start();
await server.createDatabase("app");
const pool = new pg.Pool({ host: "localhost", port: PG_PORT, user: "postgres", password: "postgres", database: "app" });

await pool.query(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE authenticator LOGIN PASSWORD 'authenticator' NOINHERIT;
  GRANT anon, authenticated, service_role TO authenticator;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT '{}'::jsonb);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE PUBLICATION supabase_realtime;
`);
const migDir = path.join(PROJECT, "supabase", "migrations");
for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith(".sql")).sort()) {
  await pool.query(fs.readFileSync(path.join(migDir, f), "utf8"));
}
console.log("[stack] postgres ready + migrations applied");

// ---------------------------------------------------------------- postgrest
const restConf = path.join(OUT, "postgrest.conf");
fs.writeFileSync(
  restConf,
  [
    `db-uri = "postgres://authenticator:authenticator@localhost:${PG_PORT}/app"`,
    `db-schemas = "public"`,
    `db-anon-role = "anon"`,
    `server-port = ${REST_PORT}`,
    `jwt-secret = ${JSON.stringify(JSON.stringify(JWKS))}`,
    `log-level = "warn"`,
  ].join("\n"),
);
for (const tool of ["postgrest", "stripe-mock"]) {
  if (!fs.existsSync(path.join(BIN, `${tool}${EXE}`))) {
    console.error(`[stack] ${tool} not found in e2e/.bin - run \`npm run e2e:setup\` first.`);
    process.exit(1);
  }
}
// The Windows PostgREST build loads libpq.dll, which embedded-postgres ships.
const pgBin = path.join(PROJECT, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
const children = [];
const rest = spawn(path.join(BIN, `postgrest${EXE}`), [restConf], {
  env: process.platform === "win32" ? { ...process.env, PATH: `${pgBin};${process.env.PATH}` } : process.env,
  stdio: ["ignore", "inherit", "inherit"],
});
children.push(rest);
const stripeMock = spawn(path.join(BIN, `stripe-mock${EXE}`), ["-http-port", "12111", "-https-port", "12112"], {
  stdio: ["ignore", "ignore", "inherit"],
});
children.push(stripeMock);

// ---------------------------------------------------------------- fake GoTrue
const users = new Map(); // email -> user record
const authCodes = new Map(); // code -> { userId, challenge }
const verifyTokens = new Map(); // token -> { email, type, redirectTo, challenge }
const refreshTokens = new Map(); // token -> userId
const mailbox = []; // { to, type, link }

function publicUser(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.confirmedAt,
    confirmed_at: u.confirmedAt,
    app_metadata: { provider: u.provider, providers: [u.provider] },
    user_metadata: u.metadata,
    identities: [],
    created_at: u.createdAt,
    updated_at: u.createdAt,
    is_anonymous: false,
  };
}
function userById(id) {
  for (const u of users.values()) if (u.id === id) return u;
  return null;
}
async function createUser(email, password, metadata, provider, confirmed) {
  const u = {
    id: crypto.randomUUID(),
    email,
    password,
    metadata: metadata ?? {},
    provider,
    confirmedAt: confirmed ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
  users.set(email, u);
  // Same trigger path as Supabase: inserting into auth.users creates public.users.
  await pool.query("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)", [u.id, email, u.metadata]);
  return u;
}
function session(u) {
  const iat = now();
  const access = signJwt({
    sub: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    iat,
    exp: iat + 3600,
    iss: `${SUPABASE_URL}/auth/v1`,
    session_id: crypto.randomUUID(),
    aal: "aal1",
    is_anonymous: false,
    app_metadata: { provider: u.provider },
    user_metadata: u.metadata,
  });
  const refresh = crypto.randomBytes(16).toString("hex");
  refreshTokens.set(refresh, u.id);
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: iat + 3600,
    refresh_token: refresh,
    user: publicUser(u),
  };
}
const s256 = (verifier) => crypto.createHash("sha256").update(verifier).digest("base64url");
function issueCode(userId, challenge) {
  const code = crypto.randomUUID();
  authCodes.set(code, { userId, challenge });
  return code;
}
function withCode(redirectTo, code) {
  const url = new URL(redirectTo);
  url.searchParams.set("code", code);
  return url.toString();
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const authError = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg });

async function handleAuth(req, res, url, body) {
  const route = url.pathname.replace(/^\/auth\/v1/, "");
  const json = body.length ? JSON.parse(body.toString() || "{}") : {};
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");

  if (route === "/.well-known/jwks.json") return send(res, 200, JWKS);

  if (route === "/signup" && req.method === "POST") {
    if (users.has(json.email)) return authError(res, 422, "user_already_exists", "User already registered");
    if ((json.password ?? "").length < 6) return authError(res, 422, "weak_password", "Password should be at least 6 characters");
    const u = await createUser(json.email, json.password, json.data, "email", false);
    const token = crypto.randomUUID();
    verifyTokens.set(token, { email: u.email, type: "signup", redirectTo: url.searchParams.get("redirect_to"), challenge: json.code_challenge });
    mailbox.push({ to: u.email, type: "signup", link: `${SUPABASE_URL}/auth/v1/verify?token=${token}&type=signup` });
    return send(res, 200, publicUser(u)); // no session: confirmation required
  }

  if (route === "/verify" && req.method === "GET") {
    const t = verifyTokens.get(url.searchParams.get("token"));
    if (!t) return send(res, 400, { error: "invalid token" });
    verifyTokens.delete(url.searchParams.get("token"));
    const u = users.get(t.email);
    if (t.type === "signup") u.confirmedAt = new Date().toISOString();
    const code = issueCode(u.id, t.challenge);
    res.writeHead(303, { Location: withCode(t.redirectTo, code) });
    return res.end();
  }

  if (route === "/recover" && req.method === "POST") {
    const u = users.get(json.email);
    if (u) {
      const token = crypto.randomUUID();
      verifyTokens.set(token, { email: u.email, type: "recovery", redirectTo: url.searchParams.get("redirect_to"), challenge: json.code_challenge });
      mailbox.push({ to: u.email, type: "recovery", link: `${SUPABASE_URL}/auth/v1/verify?token=${token}&type=recovery` });
    }
    return send(res, 200, {});
  }

  if (route === "/authorize" && req.method === "GET") {
    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    const isGoogle = url.searchParams.get("provider") === "google";
    if (clientId && clientSecret && isGoogle && APP_PORT === 3000) {
      const state = Buffer.from(
        JSON.stringify({
          redirect_to: url.searchParams.get("redirect_to"),
          code_challenge: url.searchParams.get("code_challenge"),
        })
      ).toString("base64url");
      const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleAuthUrl.searchParams.set("client_id", clientId);
      googleAuthUrl.searchParams.set("redirect_uri", `${SUPABASE_URL}/auth/v1/callback`);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("state", state);
      googleAuthUrl.searchParams.set("access_type", "offline");
      googleAuthUrl.searchParams.set("prompt", "select_account");
      res.writeHead(302, { Location: googleAuthUrl.toString() });
      return res.end();
    }

    // Emulates the Google consent screen accepting immediately.
    const email = "google.user@gmail.test";
    const u = users.get(email) ?? (await createUser(email, null, { full_name: "Google User" }, "google", true));
    const code = issueCode(u.id, url.searchParams.get("code_challenge"));
    res.writeHead(302, { Location: withCode(url.searchParams.get("redirect_to"), code) });
    return res.end();
  }

  if (route === "/callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const rawState = url.searchParams.get("state");
    let state = {};
    try {
      state = JSON.parse(Buffer.from(rawState, "base64url").toString());
    } catch {}

    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    if (code && clientId && clientSecret) {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: `${SUPABASE_URL}/auth/v1/callback`,
            grant_type: "authorization_code",
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.id_token) {
          const userinfo = JSON.parse(Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString());
          if (userinfo?.email) {
            const email = userinfo.email;
            const fullName = userinfo.name ?? userinfo.email.split("@")[0];
            const u = users.get(email) ?? (await createUser(email, null, { full_name: fullName }, "google", true));
            const authCode = issueCode(u.id, state.code_challenge);
            res.writeHead(302, { Location: withCode(state.redirect_to, authCode) });
            return res.end();
          }
        }
      } catch (err) {
        console.error("[stack] Google OAuth callback error:", err);
      }
    }
    if (state.redirect_to) {
      res.writeHead(302, { Location: `${state.redirect_to}${state.redirect_to.includes("?") ? "&" : "?"}error=Google+sign-in+failed` });
      return res.end();
    }
    return send(res, 400, { error: "oauth_callback_failed" });
  }

  if (route === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const u = users.get(json.email);
      if (!u || u.password !== json.password) return authError(res, 400, "invalid_credentials", "Invalid login credentials");
      if (!u.confirmedAt) return authError(res, 400, "email_not_confirmed", "Email not confirmed");
      return send(res, 200, session(u));
    }
    if (grant === "pkce") {
      const entry = authCodes.get(json.auth_code);
      if (!entry) return authError(res, 400, "flow_state_not_found", "invalid flow state");
      if (entry.challenge && s256(json.code_verifier ?? "") !== entry.challenge) {
        return authError(res, 400, "bad_code_verifier", "code challenge does not match previously saved code verifier");
      }
      authCodes.delete(json.auth_code);
      return send(res, 200, session(userById(entry.userId)));
    }
    if (grant === "refresh_token") {
      const userId = refreshTokens.get(json.refresh_token);
      if (!userId) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(json.refresh_token);
      return send(res, 200, session(userById(userId)));
    }
  }

  const claims = verifyJwt(bearer);
  const me = claims?.sub ? userById(claims.sub) : null;

  if (route === "/user" && req.method === "GET") {
    if (!me) return authError(res, 401, "bad_jwt", "invalid JWT");
    return send(res, 200, publicUser(me));
  }
  if (route === "/user" && req.method === "PUT") {
    if (!me) return authError(res, 401, "bad_jwt", "invalid JWT");
    if (json.password) me.password = json.password;
    return send(res, 200, publicUser(me));
  }
  if (route === "/logout" && req.method === "POST") {
    res.writeHead(204);
    return res.end();
  }

  return send(res, 404, { error: `fake auth: ${req.method} ${route} not implemented` });
}

function proxyRest(req, res, url, body) {
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: REST_PORT,
      method: req.method,
      path: url.pathname.replace(/^\/rest\/v1/, "") + url.search,
      headers: { ...req.headers, host: `127.0.0.1:${REST_PORT}`, "content-length": body.length },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (e) => send(res, 502, { message: e.message }));
  upstream.end(body);
}

const gateway = http.createServer(async (req, res) => {
  const url = new URL(req.url, SUPABASE_URL);
  const body = await readBody(req);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE",
      });
      return res.end();
    }
    if (url.pathname.startsWith("/rest/v1")) return proxyRest(req, res, url, body);
    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url, body);
    if (url.pathname === "/__test/mail") {
      const to = url.searchParams.get("to");
      return send(res, 200, mailbox.filter((m) => !to || m.to === to));
    }
    if (url.pathname === "/__test/sql" && req.method === "POST") {
      const { sql, params } = JSON.parse(body.toString());
      const result = await pool.query(sql, params ?? []);
      return send(res, 200, result.rows);
    }
    return send(res, 404, { error: "not found" });
  } catch (error) {
    console.error("[gateway]", error);
    return send(res, 500, { error: String(error) });
  }
});
gateway.listen(GATEWAY_PORT, "127.0.0.1");

// Wait for PostgREST to come up.
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${REST_PORT}/`, { headers: { Authorization: `Bearer ${ANON_KEY}` } });
    if (r.status < 500) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

fs.writeFileSync(
  envFile,
  JSON.stringify(
    {
      NEXT_PUBLIC_SITE_URL: `http://localhost:${APP_PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
      SUPABASE_SECRET_KEY: SERVICE_KEY,
      STRIPE_SECRET_KEY: "sk_test_e2e",
      STRIPE_WEBHOOK_SECRET: "whsec_e2e_secret",
      STRIPE_API_BASE: "http://localhost:12111",
      // Price id of stripe-mock's fixture subscription, so invoice.paid maps to the Pro plan.
      STRIPE_PRICE_PRO: "price_1PgafmB7WZ01zgkW6dKueIc5",
      PAINT_API_TIMEOUT_MS: "3000",
      MOCK_PAINT_API_LATENCY_MS: "300",
      CRON_SECRET: "cron_e2e",
    },
    null,
    2,
  ),
);
console.log(`[stack] READY gateway=${SUPABASE_URL} rest=:${REST_PORT} stripe-mock=:12111`);

const shutdown = async () => {
  children.forEach((c) => c.kill());
  gateway.close();
  await pool.end().catch(() => {});
  await server.stop().catch(() => {});
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
