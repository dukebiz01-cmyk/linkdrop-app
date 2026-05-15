#!/usr/bin/env node
// Build payload-deploy.json for extract-url-metadata and invoke mcp-supabase-write.mjs.
// Done in JS because embedding a 13KB Deno TS file inside a JSON string by hand is fragile.

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const fnPath = resolve(root, "supabase/functions/extract-url-metadata/index.ts");
const fnContent = readFileSync(fnPath, "utf8");

const payload = {
  tool: "deploy_edge_function",
  args: {
    name: "extract-url-metadata",
    entrypoint_path: "index.ts",
    verify_jwt: true,
    files: [{ name: "index.ts", content: fnContent }],
  },
};

const payloadPath = resolve(here, "tmp/payload-deploy-extract.json");
writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf8");

const result = spawnSync("node", [resolve(here, "mcp-supabase-write.mjs"), payloadPath], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
