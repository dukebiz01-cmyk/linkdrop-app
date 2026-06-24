#!/usr/bin/env node
// Guard A (forbidden Supabase ref) + Guard B (forbidden colors) for write/edit tools.
// PreToolUse. Blocks with exit code 2 + stderr message per Claude Code hook spec.
// Node-based (no bash assumptions) so the "THE E&M" path (space + &) can't break it.

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    // Unparseable stdin → never block.
    process.exit(0);
  }

  const input = payload.tool_input || {};
  const filePath =
    input.file_path || input.path || input.notebook_path || "";

  // Collect the text being written across Write / Edit / MultiEdit / NotebookEdit shapes.
  const parts = [];
  if (typeof input.content === "string") parts.push(input.content);
  if (typeof input.new_string === "string") parts.push(input.new_string);
  if (typeof input.new_source === "string") parts.push(input.new_source);
  if (Array.isArray(input.edits)) {
    for (const e of input.edits) {
      if (e && typeof e.new_string === "string") parts.push(e.new_string);
    }
  }
  const content = parts.join("\n");

  const isMarkdown = /\.mdx?$/i.test(filePath);

  // Guard A — forbidden (abandoned/leaked) Supabase project ref.
  // Exception: .md docs may legitimately document the "do not use" rule.
  if (!isMarkdown && content.includes("gypvkmspdegbuebvsctl")) {
    process.stderr.write(
      "BLOCKED: 금지 Supabase 레퍼런스. 올바른 프로젝트 = xukxtzjfqfwalqpmfidb\n"
    );
    process.exit(2);
  }

  // Guard B (brand color block) removed 2026-06-25 — design lock released: blue/navy accent allowed, no specific color code enforced.

  process.exit(0);
});
