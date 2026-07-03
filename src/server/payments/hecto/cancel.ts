// 헥토파이낸셜 신용카드 취소 API (APICancel.do) — 요청 조립 (서버 전용, v1.6).
//   규격 출처: hecto MCP 문서 pg/credit-card/09-card-cancel.md (hectofinancial-mcp-server 0.3.3) 확인 적용.
//   ⚠️ 해시(pktHash) 조합: SHA256( trdDt + trdTm + mchtId + mchtTrdNo + cnclAmt평문 + licenseKey ).
//      ← 주문/노티와 필드 구성·순서가 다름. 이 순서 그대로.
//   금액(cnclAmt): 주문 trdAmt 와 동일하게 AES-256-ECB-Base64(평문) 암호화 전송(해시엔 평문).
//   본문 봉투: { params: {...}, data: {...} } (문서 요청 예시와 동일 구조).
import { getHectoConfig } from "./config";
import { aesEcbEncryptBase64, sha256Hex } from "./crypto";

// 09-card-cancel.md 고정값(전문 규격, 문서 "고정값" 명시).
export const HECTO_CANCEL_PATH = "/spay/APICancel.do";
export const HECTO_CANCEL_VER = "0A19"; // 전문 버전(고정)
export const HECTO_CANCEL_METHOD = "CA"; // 결제수단(고정)
export const HECTO_CANCEL_BIZ_TYPE = "C0"; // 업무구분(취소용 고정)
export const HECTO_CANCEL_ENC_CD = "23"; // 암호화 구분(고정)
export const HECTO_CANCEL_CRC_KRW = "KRW"; // 국내결제

export interface BuildCancelInput {
  /** 원거래번호 = 결제 시 헥토가 발급한 trdNo(취소 기준). */
  orgTrdNo: string;
  /** 취소 금액(원, 정수). 전체취소면 원결제 금액. */
  cancelAmountKrw: number;
  /** 취소회차. 부분취소 시 순차 증가(001, 002…). 기본 "001". */
  cnclOrd?: string;
  /** 테스트 재현용 고정 시각(미지정 시 현재 KST). */
  now?: Date;
  /** 테스트 재현용 고정 취소 주문번호(미지정 시 자동 채번). */
  mchtTrdNo?: string;
}

export interface CancelRequest {
  /** 서버-서버 호출 엔드포인트(apiBase + APICancel.do). */
  endpoint: string;
  mchtId: string;
  ver: string;
  method: string;
  bizType: string;
  encCd: string;
  /** 취소용 신규 채번(원거래번호와 별개). */
  mchtTrdNo: string;
  /** yyyyMMdd (KST) */
  trdDt: string;
  /** HHmmss (KST) */
  trdTm: string;
  /** SHA-256 hex 무결성 해시 */
  pktHash: string;
  orgTrdNo: string;
  crcCd: string;
  cnclOrd: string;
  /** AES-256-ECB-Base64(취소금액 평문) */
  cnclAmt: string;
  /** POST 본문(헥토 규격 params/data 봉투). */
  body: { params: Record<string, string>; data: Record<string, string> };
}

/** Date → KST(UTC+9) 기준 {yyyyMMdd, HHmmss}. (order.ts toKstParts 와 동일 규칙, 커플링 회피 위해 자립.) */
function toKstParts(d: Date): { trdDt: string; trdTm: string } {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const MM = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const HH = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  const ss = String(kst.getUTCSeconds()).padStart(2, "0");
  return { trdDt: `${yyyy}${MM}${dd}`, trdTm: `${HH}${mm}${ss}` };
}

/** LDC + yyyyMMddHHmmss(KST) + 랜덤4 = 취소용 유일 주문번호(원거래번호와 별개 채번). */
function genCancelMchtTrdNo(trdDt: string, trdTm: string): string {
  const rand4 = String(Math.floor(1000 + Math.random() * 9000));
  return `LDC${trdDt}${trdTm}${rand4}`;
}

export async function buildCancelRequest(input: BuildCancelInput): Promise<CancelRequest> {
  const cfg = getHectoConfig();
  const { trdDt, trdTm } = toKstParts(input.now ?? new Date());
  const mchtTrdNo = input.mchtTrdNo ?? genCancelMchtTrdNo(trdDt, trdTm);
  const cnclOrd = input.cnclOrd ?? "001";

  // 취소금액 평문(정수 문자열). 암호화(cnclAmt)와 해시(pktHash) 둘 다 이 평문을 입력으로 쓴다.
  const plainAmount = String(Math.trunc(input.cancelAmountKrw));
  const cnclAmt = aesEcbEncryptBase64(plainAmount, cfg.encKey);
  const pktHash = await sha256Hex(
    trdDt + trdTm + cfg.mchtId + mchtTrdNo + plainAmount + cfg.licenseKey,
  );

  const params: Record<string, string> = {
    mchtId: cfg.mchtId,
    ver: HECTO_CANCEL_VER,
    method: HECTO_CANCEL_METHOD,
    bizType: HECTO_CANCEL_BIZ_TYPE,
    encCd: HECTO_CANCEL_ENC_CD,
    mchtTrdNo,
    trdDt,
    trdTm,
  };
  const data: Record<string, string> = {
    pktHash,
    orgTrdNo: input.orgTrdNo,
    crcCd: HECTO_CANCEL_CRC_KRW,
    cnclOrd,
    cnclAmt,
  };

  return {
    endpoint: `${cfg.apiBase}${HECTO_CANCEL_PATH}`,
    mchtId: cfg.mchtId,
    ver: HECTO_CANCEL_VER,
    method: HECTO_CANCEL_METHOD,
    bizType: HECTO_CANCEL_BIZ_TYPE,
    encCd: HECTO_CANCEL_ENC_CD,
    mchtTrdNo,
    trdDt,
    trdTm,
    pktHash,
    orgTrdNo: input.orgTrdNo,
    crcCd: HECTO_CANCEL_CRC_KRW,
    cnclOrd,
    cnclAmt,
    body: { params, data },
  };
}
