#!/usr/bin/env node
// One-shot: reset a user's password via Supabase Auth Admin API
// (auth.admin.updateUserById). Generates a strong random password,
// persists it to .env.local as ADMIN_DEV_PASSWORD, and prints only
// metadata — the password is never written to stdout.
//
// Usage:
//   node scripts/reset-user-password.mjs <user_id>

import { randomInt } from "node:crypto";
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

const userId = process.argv[2];
if (!userId) {
  console.error("usage: node scripts/reset-user-password.mjs <user_id>");
  process.exit(2);
}

// Strong password: 4 char classes guaranteed (upper/lower/digit/symbol),
// remaining 12 from full no-lookalike alphabet, then Fisher-Yates shuffle.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";       // no I, O
const LOWER = "abcdefghjkmnpqrstuvwxyz";        // no i, l, o
const DIGIT = "23456789";                       // no 0, 1
const SYMBOL = "!#$%&*+=?@";
const FULL = UPPER + LOWER + DIGIT + SYMBOL;
function pick(s) { return s[randomInt(0, s.length)]; }
const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
while (chars.length < 16) chars.push(pick(FULL));
// Fisher-Yates
for (let i = chars.length - 1; i > 0; i--) {
  const j = randomInt(0, i + 1);
  [chars[i], chars[j]] = [chars[j], chars[i]];
}
const password = chars.join("");

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password,
  email_confirm: true,
});

if (error) {
  console.error("[reset-user-password] updateUserById failed:", error.message);
  process.exit(1);
}

const u = data?.user;

// Write / replace ADMIN_DEV_PASSWORD in .env.local
const line = `ADMIN_DEV_PASSWORD=${password}`;
const next = /^ADMIN_DEV_PASSWORD=.*$/m.test(envText)
  ? envText.replace(/^ADMIN_DEV_PASSWORD=.*$/m, line)
  : envText.replace(/\s*$/, "") + "\n" + line + "\n";
writeFileSync(envPath, next, "utf8");

console.log(JSON.stringify({
  ok: true,
  api_status: 200,
  user_id: u?.id,
  email: u?.email,
  email_confirmed_at: u?.email_confirmed_at,
  password_length: password.length,
  password: "[hidden, see .env.local ADMIN_DEV_PASSWORD]",
  env_updated: true,
}, null, 2));

// Workaround libuv assertion on Windows: force-exit so the Supabase client's
// lingering handles don't crash the close phase.
process.exit(0);
