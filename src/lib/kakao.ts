/**
 * Kakao JS SDK loader + share helper (v2.3 step 5).
 *
 * Loads https://t1.kakaocdn.net/kakao_js_sdk/2.7.1/kakao.min.js on first
 * use, calls Kakao.init(VITE_KAKAO_JS_KEY) exactly once, and exposes
 * shareToKakao() which fires the standard "feed"-type Kakao Talk share
 * sheet. Failures (missing key, SDK load failure) fall back to copying
 * the link URL to the clipboard so the user can still paste it manually.
 *
 * The Lovable UI (/create Step 6) calls shareToKakao directly — it does
 * NOT need to call initKakao first; the share helper lazy-inits.
 *
 * Usage:
 *   const result = await shareToKakao({
 *     title: "성수동 카페 투어",
 *     description: "Duke가 추천하는 카페 5곳",
 *     imageUrl: "https://.../thumb.jpg",
 *     linkUrl: "https://drop-link-cloudless.lovable.app/d/abc123",
 *     buttons: [{ title: "보러 가기", link: "https://.../d/abc123" }],
 *   });
 *   if (result.fallback === "clipboard") toast("URL을 복사했어요");
 */

/* ------------------------------ SDK typings ------------------------------ */

interface KakaoLink {
  mobileWebUrl: string;
  webUrl: string;
}

interface KakaoFeedShareOptions {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: KakaoLink;
  };
  buttons?: Array<{ title: string; link: KakaoLink }>;
}

interface KakaoSDK {
  init(jsKey: string): void;
  isInitialized(): boolean;
  Share: {
    sendDefault(options: KakaoFeedShareOptions): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

/* --------------------------------- API ----------------------------------- */

export interface ShareToKakaoOptions {
  title: string;
  description: string;
  imageUrl: string;
  /** Canonical share URL — also copied to clipboard on fallback. */
  linkUrl: string;
  /** Optional CTA buttons rendered in the Kakao Talk feed card. */
  buttons?: Array<{ title: string; link: string }>;
}

export type KakaoErrorCode = "no_key" | "ssr_unavailable" | "sdk_load_failed" | "init_failed";

export class KakaoError extends Error {
  code: KakaoErrorCode;
  constructor(code: KakaoErrorCode, message: string) {
    super(message);
    this.name = "KakaoError";
    this.code = code;
  }
}

export interface ShareToKakaoResult {
  /** True when Kakao.Share.sendDefault was invoked successfully. */
  ok: boolean;
  /**
   * Set when the share path failed and the SDK helper recovered another
   * way. Today the only fallback is "clipboard" (linkUrl was copied).
   * Undefined fallback + ok=false means even clipboard write failed —
   * caller should show the URL inline so the user can copy by hand.
   */
  fallback?: "clipboard";
  /** Populated only on failure, for telemetry / friendly toasts. */
  error?: KakaoError;
}

/* ----------------------------- Implementation ---------------------------- */

const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.1/kakao.min.js";
const PLACEHOLDER_KEY = "PLACEHOLDER";

let sdkPromise: Promise<KakaoSDK> | null = null;

function getKakaoKey(): string | null {
  const raw = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === PLACEHOLDER_KEY) return null;
  return trimmed;
}

function loadSdkScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-kakao-sdk="1"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new KakaoError("sdk_load_failed", "카카오 SDK를 불러오지 못했어요.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.kakaoSdk = "1";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "1";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new KakaoError("sdk_load_failed", "카카오 SDK를 불러오지 못했어요.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

/**
 * Idempotent init. Resolves with the SDK on success, rejects with
 * KakaoError on failure (no key, SSR, network, init refusal). Safe to
 * call from anywhere — repeat calls reuse the cached promise so the
 * `<script>` tag is appended at most once.
 */
export function initKakao(): Promise<KakaoSDK> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    if (typeof window === "undefined") {
      throw new KakaoError("ssr_unavailable", "카카오 SDK는 브라우저에서만 사용할 수 있어요.");
    }
    const key = getKakaoKey();
    if (!key) {
      throw new KakaoError("no_key", "VITE_KAKAO_JS_KEY 환경변수가 설정되지 않았어요.");
    }
    if (!window.Kakao) {
      await loadSdkScript(SDK_URL);
    }
    const sdk = window.Kakao;
    if (!sdk) {
      throw new KakaoError("sdk_load_failed", "카카오 SDK 전역(window.Kakao)이 비어 있어요.");
    }
    if (!sdk.isInitialized()) {
      try {
        sdk.init(key);
      } catch (err) {
        throw new KakaoError("init_failed", err instanceof Error ? err.message : String(err));
      }
    }
    return sdk;
  })().catch((err) => {
    // Reset the singleton so callers can retry after fixing the env / network.
    sdkPromise = null;
    throw err;
  });
  return sdkPromise;
}

/**
 * Open the Kakao Talk share sheet. Falls back to copying linkUrl to the
 * clipboard when the SDK can't run (missing key, network, SSR, etc.).
 * Never throws — callers branch on the returned `fallback` field.
 *
 * Note: Kakao.Share.sendDefault is fire-and-forget; user cancel after
 * the sheet opens is invisible to us and not surfaced as an error
 * (per spec: 사용자 취소는 정상 흐름).
 */
export async function shareToKakao(options: ShareToKakaoOptions): Promise<ShareToKakaoResult> {
  try {
    const sdk = await initKakao();
    sdk.Share.sendDefault({
      objectType: "feed",
      content: {
        title: options.title,
        description: options.description,
        imageUrl: options.imageUrl,
        link: { mobileWebUrl: options.linkUrl, webUrl: options.linkUrl },
      },
      buttons: options.buttons?.map((b) => ({
        title: b.title,
        link: { mobileWebUrl: b.link, webUrl: b.link },
      })),
    });
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof KakaoError
        ? err
        : new KakaoError("init_failed", err instanceof Error ? err.message : String(err));
    const copied = await copyToClipboard(options.linkUrl);
    return copied ? { ok: false, fallback: "clipboard", error } : { ok: false, error };
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  if (typeof document === "undefined") return false;
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Test seam: forget the cached SDK promise (for retry / unit tests). */
export function __resetKakaoForTesting(): void {
  sdkPromise = null;
}
