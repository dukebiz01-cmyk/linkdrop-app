// 헥토파이낸셜 표준결제창 v1 — 환경/키 설정 (서버 전용).
//   env 접근은 프로젝트 표준(client.server.ts)과 동일: getWorkerEnv()(Cloudflare live env) → process.env 폴백.
//   testbed 에서만 헥토 공식 문서의 공개 공용값을 기본값으로 허용. prod 는 반드시 env 로 주입(누락 시 throw).
import { getWorkerEnv } from "@/lib/worker-env.server";

export type HectoEnv = "testbed" | "prod";

/** getWorkerEnv(ALS) → process.env 순으로 첫 유효(non-blank) 값. */
function readEnv(name: string): string | undefined {
  const wenv = (getWorkerEnv() ?? {}) as Record<string, string | undefined>;
  const fromWorker = wenv[name];
  if (typeof fromWorker === "string" && fromWorker.trim()) return fromWorker.trim();
  const fromProc =
    typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  if (typeof fromProc === "string" && fromProc.trim()) return fromProc.trim();
  return undefined;
}

// 결제창/API 도메인 (헥토 문서).
const DOMAINS: Record<HectoEnv, { payWindow: string; api: string }> = {
  testbed: { payWindow: "https://tbnpg.settlebank.co.kr", api: "https://tbgw.settlebank.co.kr" },
  prod: { payWindow: "https://npg.settlebank.co.kr", api: "https://gw.settlebank.co.kr" },
};

// testbed 공개 공용값 (헥토 공식 문서). prod 에서는 기본값 fallback 금지.
const TESTBED_DEFAULTS = {
  mchtId: "nxca_jt_il",
  licenseKey: "ST1009281328226982205",
  encKey: "pgSettle30y739r82jtd709yOfZ2yK5K",
} as const;

// v1.5 결제창 SDK — 표준결제창 SDK 스크립트 경로.
//   ⚠️ 정확한 파일명/버전은 헥토 표준결제창 개발가이드(hecto MCP)에서 확정 후 HECTO_PAYWINDOW_SDK_PATH env 로 교체.
//   아래 기본값은 문서 표준 경로이나 실테스트 전 반드시 검증. (전역 객체 = SETTLE_PG)
const DEFAULT_SDK_PATH = "/resources/js/v1/SettlePG_v1.2.js";
// 노티/리턴/취소 URL 베이스 — 로컬 dev 기본. cloudflared 터널 사용 시 HECTO_NOTI_BASE env 로 공개 URL 주입.
const DEFAULT_NOTI_BASE = "http://localhost:8080";

export interface HectoConfig {
  env: HectoEnv;
  /** 결제창(브라우저 호출) 도메인 */
  payWindowBase: string;
  /** 서버-서버 API 도메인 */
  apiBase: string;
  /** 노티/next/cancel URL 베이스(공개 접근 가능 호스트) */
  notiBase: string;
  /** 결제창 SDK 스크립트 전체 URL(payWindowBase + 경로) */
  payWindowSdkUrl: string;
  mchtId: string;
  /** 해시(pktHash) 생성 키 = 라이선스 키 */
  licenseKey: string;
  /** 민감필드 AES 암호화 키(32자=AES-256) */
  encKey: string;
}

export function getHectoConfig(): HectoConfig {
  const env: HectoEnv = readEnv("HECTO_ENV") === "prod" ? "prod" : "testbed";
  const domains = DOMAINS[env];
  const allowDefault = env === "testbed";

  const mchtId = readEnv("HECTO_MCHT_ID") ?? (allowDefault ? TESTBED_DEFAULTS.mchtId : undefined);
  const licenseKey =
    readEnv("HECTO_LICENSE_KEY") ?? (allowDefault ? TESTBED_DEFAULTS.licenseKey : undefined);
  const encKey = readEnv("HECTO_ENC_KEY") ?? (allowDefault ? TESTBED_DEFAULTS.encKey : undefined);

  if (!mchtId || !licenseKey || !encKey) {
    const missing = [
      ...(!mchtId ? ["HECTO_MCHT_ID"] : []),
      ...(!licenseKey ? ["HECTO_LICENSE_KEY"] : []),
      ...(!encKey ? ["HECTO_ENC_KEY"] : []),
    ];
    // prod 인데 키 누락 → 기본값 fallback 없이 즉시 실패(운영 안전).
    throw new Error(`[hecto] Missing key(s) for env=${env}: ${missing.join(", ")}`);
  }

  const notiBase = (readEnv("HECTO_NOTI_BASE") ?? DEFAULT_NOTI_BASE).replace(/\/+$/, "");
  const sdkPath = readEnv("HECTO_PAYWINDOW_SDK_PATH") ?? DEFAULT_SDK_PATH;

  return {
    env,
    payWindowBase: domains.payWindow,
    apiBase: domains.api,
    notiBase,
    payWindowSdkUrl: `${domains.payWindow}${sdkPath}`,
    mchtId,
    licenseKey,
    encKey,
  };
}
