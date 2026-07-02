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

export interface HectoConfig {
  env: HectoEnv;
  /** 결제창(브라우저 호출) 도메인 */
  payWindowBase: string;
  /** 서버-서버 API 도메인 */
  apiBase: string;
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

  return {
    env,
    payWindowBase: domains.payWindow,
    apiBase: domains.api,
    mchtId,
    licenseKey,
    encKey,
  };
}
