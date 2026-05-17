#!/usr/bin/env node
// One-shot: create a fresh test user via Supabase Auth admin API and
// persist the generated password to .env.local as TEST_USER_PASSWORD.
//
// Never prints the password to stdout — it lives only in .env.local.
//
// Usage:
//   node scripts/create-test-user.mjs <email> [role]
//   defaults: role=maker

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(repoRoot, ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local not found at " + envPath);
  process.exit(2);
}

const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SECRET_KEY in .env.local");
  process.exit(2);
}

const [, , emailArg, roleArg] = process.argv;
const email = emailArg || "test-fresh@linkdrop.test";
const role = roleArg || "maker";

// 16-char password from a no-lookalike alphabet + one symbol guarantee
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const bytes = randomBytes(15);
const body = Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
const password = body + "!"; // 16 chars total, ensures one symbol

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { role },
});

if (error) {
  console.error("[create-test-user] admin.createUser failed:", error.message);
  process.exit(1);
}

const newId = data.user?.id ?? "(unknown id)";

// Write/replace TEST_USER_PASSWORD in .env.local
const line = `TEST_USER_PASSWORD=${password}`;
let nextEnv;
if (/^TEST_USER_PASSWORD=.*$/m.test(envText)) {
  nextEnv = envText.replace(/^TEST_USER_PASSWORD=.*$/m, line);
} else {
  nextEnv = envText.replace(/\s*$/, "") + "\n" + line + "\n";
}
writeFileSync(envPath, nextEnv, "utf8");

console.log(JSON.stringify({
  ok: true,
  user_id: newId,
  email,
  role,
  email_confirmed: true,
  password: "[hidden, see .env.local TEST_USER_PASSWORD]",
}, null, 2));
