#!/usr/bin/env node
// Guard A (forbidden Supabase ref in any command) + Guard D (HEAD-moving git reset).
// PreToolUse / matcher: Bash. Blocks with exit code 2 + stderr per Claude Code hook spec.

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }

  const cmd = (payload.tool_input && payload.tool_input.command) || "";

  // Guard A — forbidden Supabase project ref anywhere in the command.
  if (cmd.includes("gypvkmspdegbuebvsctl")) {
    process.stderr.write(
      "BLOCKED: 금지 Supabase 레퍼런스. 올바른 프로젝트 = xukxtzjfqfwalqpmfidb\n"
    );
    process.exit(2);
  }

  // Guard D — block git reset that moves HEAD (or --hard). Allow `git reset HEAD <path>` unstaging.
  if (isDangerousGitReset(cmd)) {
    process.stderr.write(
      "BLOCKED: git reset 금지 — 히스토리 보존 = git revert 사용\n"
    );
    process.exit(2);
  }

  process.exit(0);
});

function isDangerousGitReset(fullCmd) {
  // A single Bash call may chain commands; inspect each segment.
  const segments = fullCmd.split(/&&|\|\||;|\n|\|/);
  for (const seg of segments) {
    const m = seg.match(/\bgit\s+reset\b(.*)/);
    if (!m) continue;

    const args = m[1].trim();
    const tokens = args.length ? args.split(/\s+/) : [];

    // Destructive / HEAD-moving mode flags.
    if (tokens.some((t) => /^--(hard|soft|merge|keep)$/.test(t))) return true;

    const positionals = tokens.filter((t) => !t.startsWith("-"));
    if (positionals.length === 0) {
      // `git reset` (default --mixed, no commit) resets the index to HEAD — does not move HEAD. Allow.
      continue;
    }

    const first = positionals[0];

    // `git reset HEAD ...` is unstaging (does not move HEAD). Allow.
    if (first === "HEAD") continue;

    // Commit-ish target that moves HEAD: HEAD~/HEAD^/@~, ORIG_HEAD, a SHA, or a remote ref.
    const movesHead =
      /^(HEAD[~^@]|@[~^]|ORIG_HEAD)/i.test(first) ||
      /^[0-9a-f]{7,40}$/i.test(first) ||
      /^origin\//.test(first);
    if (movesHead) return true;

    // Any other single positional is treated as a path (unstage) → allow.
  }
  return false;
}
