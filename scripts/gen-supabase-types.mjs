#!/usr/bin/env node
/**
 * Supabase gen types — Management API 경유.
 *
 * WHY: 이 dev 머신은 username("THE E&M")에 공백/&가 있어 `bunx supabase gen types`
 * 가 깨진다(CLAUDE.md 참조). CLI 대신 Management API GET 으로 동일 결과를 얻는다.
 * access token 은 .mcp.json(gitignored)에서 읽어 시크릿을 중복 보관하지 않는다.
 *
 * Usage: node scripts/gen-supabase-types.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const mcp = JSON.parse(readFileSync(".mcp.json", "utf8"));
const token = mcp.mcpServers?.supabase?.env?.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN not found in .mcp.json");
  process.exit(2);
}
const ref = process.env.SUPABASE_PROJECT_REF ?? "xukxtzjfqfwalqpmfidb";
const OUT = "src/integrations/supabase/types.ts";

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript`,
  { headers: { Authorization: `Bearer ${token}` } },
);
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}
const json = await res.json();
if (typeof json.types !== "string" || json.types.length < 100) {
  console.error("unexpected response:", JSON.stringify(json).slice(0, 300));
  process.exit(1);
}
writeFileSync(OUT, json.types, "utf8");
console.log(`OK ${OUT} - ${json.types.length} chars`);
