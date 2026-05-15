/**
 * time-link.ts smoke tests (v2.3 step 4).
 *
 * No test runner is wired into the project (CLAUDE.md), so this file uses
 * inline assertions and is meant to be executed directly:
 *   bun src/lib/time-link.test.ts
 * Exits non-zero on the first failure so CI / scripts can rely on it.
 */

import {
  buildTimeLinkEmbed,
  buildTimeLinkUrl,
  formatSeconds,
  parseTimeString,
  parseYouTubeUrl,
} from "./time-link";

let passed = 0;
let failed = 0;

function check(name: string, cond: unknown, detail?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}`);
    if (detail !== undefined) console.error("       got:", detail);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, ok ? undefined : { actual, expected });
}

console.log("time-link.test.ts");

// 1. parseYouTubeUrl: basic URL → videoId only (no time params)
{
  const r = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  eq("1. parseYouTubeUrl basic watch URL", r, { videoId: "dQw4w9WgXcQ" });
}

// 2. parseYouTubeUrl + t=120s → startSeconds=120
{
  const r = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s");
  eq("2. parseYouTubeUrl with t=120s", r, {
    videoId: "dQw4w9WgXcQ",
    startSeconds: 120,
  });
}

// 3. parseYouTubeUrl: youtu.be short URL
{
  const r = parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=2m30s");
  eq("3. parseYouTubeUrl youtu.be short URL with t=2m30s", r, {
    videoId: "dQw4w9WgXcQ",
    startSeconds: 150,
  });
}

// 4. buildTimeLinkUrl with start only → ?t=120s appended
{
  const r = buildTimeLinkUrl("dQw4w9WgXcQ", 120);
  eq(
    "4. buildTimeLinkUrl(start=120) → watch URL with t=120s",
    r,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
  );
}

// 5. buildTimeLinkEmbed with start + end → embed URL with start & end
{
  const r = buildTimeLinkEmbed("dQw4w9WgXcQ", 120, 180);
  eq(
    "5. buildTimeLinkEmbed(start=120, end=180) → embed URL",
    r,
    "https://www.youtube.com/embed/dQw4w9WgXcQ?start=120&end=180",
  );
}

// 6. formatSeconds(420) + parseTimeString round-trip
{
  const formatted = formatSeconds(420);
  eq("6a. formatSeconds(420) → '7:00'", formatted, "7:00");
  const back = parseTimeString(formatted);
  eq("6b. parseTimeString('7:00') → 420 (round-trip)", back, 420);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
