#!/usr/bin/env node
// Guard C — typecheck gate. Stop event. Blocks finishing (exit 2) when typecheck regresses.
//
// The repo has pre-existing type errors that are OUT OF SCOPE to fix (app source is locked).
// A zero-tolerance gate would trap every session, so this is a REGRESSION gate: it blocks only
// when the current error count exceeds the recorded baseline (.claude/hooks/tsc-baseline.json).
// That still catches any NEW type error introduced before finishing, which is the point.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    /* ignore */
  }

  // Infinite-loop guard: if we already blocked once this turn, don't re-block.
  if (payload.stop_hook_active) process.exit(0);

  const cwd = process.cwd();

  // Pick the typecheck command: `bun run typecheck` if the script exists, else `bunx tsc --noEmit`.
  let hasTypecheckScript = false;
  try {
    const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
    hasTypecheckScript = Boolean(pkg.scripts && pkg.scripts.typecheck);
  } catch {
    /* ignore */
  }
  const command = hasTypecheckScript ? "bun run typecheck" : "bunx tsc --noEmit";

  const res = spawnSync(command, { shell: true, encoding: "utf8", cwd });
  const out = `${res.stdout || ""}${res.stderr || ""}`;

  // tsc passed cleanly → nothing to gate.
  if (res.status === 0) process.exit(0);

  const currentCount = (out.match(/error TS\d+/g) || []).length;

  // Read the recorded baseline. If missing, fail open (don't trap the session).
  let baseline = null;
  try {
    const b = JSON.parse(
      readFileSync(path.join(cwd, ".claude", "hooks", "tsc-baseline.json"), "utf8")
    );
    if (typeof b.errorCount === "number") baseline = b.errorCount;
  } catch {
    /* no baseline */
  }

  if (baseline === null) {
    // No baseline to compare against — do not block on pre-existing debt.
    process.exit(0);
  }

  if (currentCount > baseline) {
    process.stderr.write(
      `BLOCKED: 타입체크 회귀 — 새 타입 에러 ${currentCount - baseline}개 (현재 ${currentCount} > 기준 ${baseline}). 끝내기 전에 수정하세요.\n`
    );
    process.stderr.write(out);
    process.exit(2);
  }

  // At or below baseline → pre-existing errors only, allow finishing.
  process.exit(0);
});
