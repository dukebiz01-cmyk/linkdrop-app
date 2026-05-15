#!/usr/bin/env node
// Apply a Supabase migration via the MCP server's apply_migration tool,
// bypassing the committed --read-only flag in .mcp.json.
//
// Why this exists:
//   The repo's .mcp.json keeps --read-only for safety. CLAUDE.md documents
//   the workaround: "invoke the MCP server stdio directly without the flag
//   instead of editing the config and restarting." This is that script.
//
// Usage:
//   node scripts/apply-migration.mjs <migration_name> <path_to_sql_file>
//
// Token + project ref are read from .mcp.json so we don't duplicate secrets.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , migrationName, sqlPath] = process.argv;
if (!migrationName || !sqlPath) {
  console.error("Usage: node apply-migration.mjs <migration_name> <sql_path>");
  process.exit(2);
}

const repoRoot = resolve(import.meta.dirname, "..");
const mcpConfig = JSON.parse(readFileSync(resolve(repoRoot, ".mcp.json"), "utf8"));
const supabase = mcpConfig.mcpServers?.supabase;
if (!supabase) throw new Error(".mcp.json missing mcpServers.supabase");

// Strip --read-only when locating the stdio entrypoint and project-ref.
const stdioPath = supabase.args.find((a) => a.endsWith("stdio.js"));
const projectRef = supabase.args.find((a) => a.startsWith("--project-ref="));
if (!stdioPath || !projectRef) throw new Error("Unexpected .mcp.json args shape");

const token = supabase.env?.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing in .mcp.json");

const sql = readFileSync(resolve(repoRoot, sqlPath), "utf8");

const child = spawn(
  "node",
  [stdioPath, projectRef], // intentionally no --read-only
  {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    stdio: ["pipe", "pipe", "inherit"],
  }
);

const pending = new Map();
let buffer = "";
let nextId = 1;

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      console.error("[non-json stdout]", line);
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  }
});

function send(method, params, withId = true) {
  const msg = { jsonrpc: "2.0", method, params };
  if (withId) {
    const id = nextId++;
    msg.id = id;
    const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    child.stdin.write(JSON.stringify(msg) + "\n");
    return p;
  }
  child.stdin.write(JSON.stringify(msg) + "\n");
  return Promise.resolve();
}

const timer = setTimeout(() => {
  console.error("Timed out after 120s");
  child.kill();
  process.exit(1);
}, 120_000);

try {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "linkdrop-apply-migration", version: "1.0.0" },
  });
  await send("notifications/initialized", {}, false);

  const result = await send("tools/call", {
    name: "apply_migration",
    arguments: { name: migrationName, query: sql },
  });

  console.log(JSON.stringify(result, null, 2));
  clearTimeout(timer);
  child.kill();
  process.exit(0);
} catch (err) {
  clearTimeout(timer);
  console.error("apply_migration failed:", err.message);
  child.kill();
  process.exit(1);
}
