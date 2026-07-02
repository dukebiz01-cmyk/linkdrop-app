// 헥토파이낸셜 표준결제창 v1 — 카드 단건결제 주문 생성 (서버 전용).
//   결제창 호출에 필요한 파라미터(암호화 금액 + 무결성 해시 포함)를 조립한다.
//   해시 규격(헥토 표준결제창): SHA256( mchtId + method + mchtTrdNo + trdDt + trdTm + 금액평문 + licenseKey ).
import { getHectoConfig } from "./config";
import { aesEcbEncryptBase64, sha256Hex } from "./crypto";

// 카드 결제창 규격 method 코드값(헥토 표준결제창: card=신용카드).
export const HECTO_CARD_METHOD = "card";

export interface CreateCardOrderInput {
  /** 결제 금액(원, 정수). */
  amountKrw: number;
  /** 주문명(상품명). */
  orderName: string;
  /** 테스트 재현용 고정 시각(미지정 시 현재 KST). */
  now?: Date;
  /** 테스트 재현용 고정 주문번호(미지정 시 자동 생성 = 랜덤 포함). */
  mchtTrdNo?: string;
  /** 승인결과 통보(noti) 수신 URL. 미지정 시 자리표시. */
  notiUrl?: string;
  /** 결제 완료 후 이동 URL. 미지정 시 자리표시. */
  nextUrl?: string;
  /** 결제 취소 후 이동 URL. 미지정 시 자리표시. */
  cancUrl?: string;
}

export interface CardOrder {
  /** 결제창(브라우저 호출) 도메인 = 헥토 규격상 env 파라미터. */
  env: string;
  mchtId: string;
  method: string;
  mchtTrdNo: string;
  /** yyyyMMdd (KST) */
  trdDt: string;
  /** HHmmss (KST) */
  trdTm: string;
  /** AES-256-ECB-Base64(금액 평문) */
  trdAmt: string;
  /** SHA-256 hex 무결성 해시 */
  pktHash: string;
  notiUrl: string;
  nextUrl: string;
  cancUrl: string;
  orderName: string;
}

/** Date → KST(UTC+9) 기준 {yyyyMMdd, HHmmss}. */
function toKstParts(d: Date): { trdDt: string; trdTm: string } {
  // UTC epoch + 9h → KST 벽시계. getUTC* 로 읽어 로컬타임존 영향 제거.
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const MM = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const HH = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  const ss = String(kst.getUTCSeconds()).padStart(2, "0");
  return { trdDt: `${yyyy}${MM}${dd}`, trdTm: `${HH}${mm}${ss}` };
}

/** LD + yyyyMMddHHmmss(KST) + 랜덤4자리 = 유일 주문번호. */
function genMchtTrdNo(trdDt: string, trdTm: string): string {
  const rand4 = String(Math.floor(1000 + Math.random() * 9000));
  return `LD${trdDt}${trdTm}${rand4}`;
}

const PLACEHOLDER = {
  noti: "https://app.drop.how/api/hecto/noti",
  next: "https://app.drop.how/api/hecto/return",
  canc: "https://app.drop.how/api/hecto/cancel",
} as const;

export async function createCardOrder(input: CreateCardOrderInput): Promise<CardOrder> {
  const cfg = getHectoConfig();
  const { trdDt, trdTm } = toKstParts(input.now ?? new Date());
  const mchtTrdNo = input.mchtTrdNo ?? genMchtTrdNo(trdDt, trdTm);

  // 금액 평문(정수 문자열). 암호화(trdAmt)와 해시(pktHash) 둘 다 이 평문을 입력으로 쓴다.
  const plainAmount = String(Math.trunc(input.amountKrw));
  const method = HECTO_CARD_METHOD;

  const trdAmt = aesEcbEncryptBase64(plainAmount, cfg.encKey);
  const pktHash = await sha256Hex(
    cfg.mchtId + method + mchtTrdNo + trdDt + trdTm + plainAmount + cfg.licenseKey,
  );

  return {
    env: cfg.payWindowBase,
    mchtId: cfg.mchtId,
    method,
    mchtTrdNo,
    trdDt,
    trdTm,
    trdAmt,
    pktHash,
    notiUrl: input.notiUrl ?? PLACEHOLDER.noti,
    nextUrl: input.nextUrl ?? PLACEHOLDER.next,
    cancUrl: input.cancUrl ?? PLACEHOLDER.canc,
    orderName: input.orderName,
  };
}

// ─────────────────────────────────────────────────────────────
// 노티(결과통보) 검증 — 헥토 정본 규격.
//   수신 trdDtm(14자리 yyyyMMddHHmmss)을 trdDt(앞8)/trdTm(뒤6)으로 분해하고
//   검증 해시 = SHA256( outStatCd + trdDt + trdTm + mchtId + mchtTrdNo + trdAmt평문 + licenseKey ).
//   (요청 해시와 필드 구성/순서가 다르므로 별도 함수로 분리 — route·verify 공유.)
// ─────────────────────────────────────────────────────────────

/** trdDtm(14: yyyyMMddHHmmss) → { trdDt(앞8), trdTm(뒤6) }. */
export function splitTrdDtm(trdDtm: string): { trdDt: string; trdTm: string } {
  return { trdDt: trdDtm.slice(0, 8), trdTm: trdDtm.slice(8, 14) };
}

export interface NotiHashFields {
  /** 결과 상태 코드 */
  outStatCd: string;
  /** 거래일시 14자리(yyyyMMddHHmmss) */
  trdDtm: string;
  mchtId: string;
  mchtTrdNo: string;
  /** 금액 평문(정수 문자열) */
  trdAmt: string;
}

/** 노티 정본 검증 해시(SHA-256 hex) 산출. licenseKey 는 서버 설정값(수신 안 함). */
export async function buildNotiVerifyHash(
  fields: NotiHashFields,
  licenseKey: string,
): Promise<string> {
  const { trdDt, trdTm } = splitTrdDtm(fields.trdDtm);
  return sha256Hex(
    fields.outStatCd +
      trdDt +
      trdTm +
      fields.mchtId +
      fields.mchtTrdNo +
      fields.trdAmt +
      licenseKey,
  );
}
