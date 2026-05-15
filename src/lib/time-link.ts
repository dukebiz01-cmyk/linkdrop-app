/**
 * TimeLink helpers (v2.3 step 4) — YouTube only.
 *
 * Encodes/decodes the (videoId, startSeconds?, endSeconds?) triple stored on
 * component_blocks (video_start_seconds / video_end_seconds, see
 * check_video_time_range) into the URL forms YouTube actually supports:
 *
 *   watch?v=ID&t=Ns       → start only (end is silently dropped — watch URL
 *                            doesn't honor it)
 *   embed/ID?start=N&end=M → start + end (only embed honors end)
 *
 * Instagram / TikTok will be added in Stage 2+.
 */

/* ---------------------------- Public API types ---------------------------- */

export interface ParsedYouTubeUrl {
  videoId: string;
  /** Start offset in whole seconds, if the URL carried `t=` / `start=`. */
  startSeconds?: number;
  /** End offset in whole seconds, if the URL carried `end=` (embed form). */
  endSeconds?: number;
}

export interface BuildEmbedOptions {
  autoplay?: boolean;
}

/* ------------------------------- Constants -------------------------------- */

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,}$/;

/* --------------------- parseYouTubeUrl (input → triple) ------------------- */

/**
 * Parse a YouTube URL into its videoId + optional time range. Returns null
 * for non-YouTube hosts, malformed URLs, or any path shape we don't
 * recognize. Recognized shapes:
 *
 *   youtube.com/watch?v=ID       (also m. / music. / www.)
 *   youtu.be/ID
 *   youtube.com/shorts/ID
 *   youtube.com/embed/ID
 *   youtube.com/v/ID
 *
 * Time params accepted:
 *   ?t=120s | ?t=2m30s | ?t=120 | ?start=120 | ?end=180
 */
export function parseYouTubeUrl(url: string): ParsedYouTubeUrl | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) return null;

  const videoId = extractVideoId(host, u);
  if (!videoId) return null;

  const startRaw = u.searchParams.get("t") ?? u.searchParams.get("start");
  const endRaw = u.searchParams.get("end");

  const startSeconds = startRaw == null ? undefined : decodeTimeParam(startRaw);
  const endSeconds = endRaw == null ? undefined : decodeTimeParam(endRaw);

  const out: ParsedYouTubeUrl = { videoId };
  if (typeof startSeconds === "number") out.startSeconds = startSeconds;
  if (typeof endSeconds === "number") out.endSeconds = endSeconds;
  return out;
}

function extractVideoId(host: string, u: URL): string | null {
  if (host === "youtu.be") {
    const id = u.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  // youtube.com family
  const path = u.pathname;
  if (path === "/watch") {
    const id = u.searchParams.get("v") ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  const seg = path.match(/^\/(shorts|embed|v)\/([^/?#]+)/);
  if (seg) {
    const id = seg[2];
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  return null;
}

/**
 * Decode `t` / `start` / `end` values. Accepts:
 *   "120"     → 120
 *   "120s"    → 120
 *   "2m30s"   → 150
 *   "1h2m3s"  → 3723
 * Returns undefined for unparsable input (so callers can drop bad params
 * silently rather than poisoning the result).
 */
function decodeTimeParam(raw: string): number | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const h = m[1] ? Number(m[1]) : 0;
  const min = m[2] ? Number(m[2]) : 0;
  const sec = m[3] ? Number(m[3]) : 0;
  return h * 3600 + min * 60 + sec;
}

/* ------------------------ buildTimeLinkUrl (watch) ------------------------ */

/**
 * Build the canonical watch URL. `endSeconds` is intentionally dropped — the
 * watch URL doesn't honor it; use buildTimeLinkEmbed when you need a window.
 */
export function buildTimeLinkUrl(
  videoId: string,
  startSeconds?: number,
  _endSeconds?: number,
): string {
  assertVideoId(videoId);
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  const start = normalizeNonNegativeInt(startSeconds);
  return start == null ? base : `${base}&t=${start}s`;
}

/* ----------------------- buildTimeLinkEmbed (embed) ----------------------- */

/**
 * Build the embed URL. Honors both start and end; appends autoplay=1 when
 * options.autoplay is true.
 */
export function buildTimeLinkEmbed(
  videoId: string,
  startSeconds?: number,
  endSeconds?: number,
  options?: BuildEmbedOptions,
): string {
  assertVideoId(videoId);
  const params = new URLSearchParams();
  const start = normalizeNonNegativeInt(startSeconds);
  const end = normalizeNonNegativeInt(endSeconds);
  if (start != null) params.set("start", String(start));
  if (end != null) params.set("end", String(end));
  if (options?.autoplay) params.set("autoplay", "1");
  const qs = params.toString();
  const base = `https://www.youtube.com/embed/${videoId}`;
  return qs ? `${base}?${qs}` : base;
}

function assertVideoId(id: string): void {
  if (!VIDEO_ID_RE.test(id)) {
    throw new Error(`time-link: invalid videoId ${JSON.stringify(id)}`);
  }
}

function normalizeNonNegativeInt(n: number | undefined): number | null {
  if (n == null) return null;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/* --------------------------- formatSeconds (UI) --------------------------- */

/**
 * Format whole seconds as `M:SS` (or `H:MM:SS` for ≥ 1h). Examples:
 *   420  → "7:00"
 *   65   → "1:05"
 *   5025 → "1:23:45"
 * Negative or non-finite inputs throw — they shouldn't reach the UI.
 */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`formatSeconds: expected non-negative finite number, got ${seconds}`);
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/* ---------------------- parseTimeString (UI inverse) ---------------------- */

/**
 * Parse a `M:SS` / `H:MM:SS` string back to seconds. Returns null for any
 * unrecognized shape. Accepts whitespace around the input.
 *   "7:00"    → 420
 *   "1:05"    → 65
 *   "1:23:45" → 5025
 *   "invalid" → null
 */
export function parseTimeString(str: string): number | null {
  if (typeof str !== "string") return null;
  const s = str.trim();
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map((p) => Number(p));
  if (parts.length === 2) {
    const [m, sec] = nums;
    if (sec >= 60) return null;
    return m * 60 + sec;
  }
  const [h, m, sec] = nums;
  if (m >= 60 || sec >= 60) return null;
  return h * 3600 + m * 60 + sec;
}
