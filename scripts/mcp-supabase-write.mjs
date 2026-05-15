#!/usr/bin/env node
/**
 * One-off MCP stdio caller for Supabase server WITHOUT --read-only.
 * Reads a JSON payload from process.argv[2] (a file path).
 * Payload shape: { "tool": "<tool_name>", "args": {...} }
 *
 * Usage:
 *   node scripts/mcp-supabase-write.mjs payload.json
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STDIO_PATH =
  process.env.SUPABASE_MCP_STDIO ??
  "C:\\Users\\THE E&M\\AppData\\Roaming\\npm\\node_modules\\@supabase\\mcp-server-supabase\\dist\\transports\\stdio.js";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "xukxtzjfqfwalqpmfidb";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error(
    "SUPABASE_ACCESS_TOKEN env var required. Read it from your local .mcp.json (gitignored) and export it before running.",
  );
  process.exit(2);
}

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error("usage: node mcp-supabase-write.mjs <payload.json>");
  process.exit(2);
}

const payload = JSON.parse(readFileSync(resolve(payloadPath), "utf8"));
if (!payload.tool || !payload.args) {
  console.error("payload must have { tool, args }");
  process.exit(2);
}

const child = spawn("node", [STDIO_PATH, `--project-ref=${PROJECT_REF}`], {
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN },
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const responses = new Map();
let nextId = 1;

function send(msg) {
  const id = msg.id ?? null;
  const data = JSON.stringify(msg) + "\n";
  child.stdin.write(Buffer.from(data, "utf8"));
  return id;
}

function waitFor(id) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout for id ${id}`)), 60_000);
    const check = () => {
      if (responses.has(id)) {
        clearTimeout(t);
        res(responses.get(id));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null) responses.set(msg.id, msg);
    } catch {
      // ignore non-JSON output
    }
  }
});

async function main() {
  // initialize
  const initId = nextId++;
  send({
    jsonrpc: "2.0",
    id: initId,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "linkdrop-mcp-helper", version: "0.1.0" },
    },
  });
  await waitFor(initId);

  // initialized notification (no id)
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  // tools/call
  const callId = nextId++;
  send({
    jsonrpc: "2.0",
    id: callId,
    method: "tools/call",
    params: { name: payload.tool, arguments: payload.args },
  });
  const result = await waitFor(callId);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  child.stdin.end();
  child.kill();
}

main().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
