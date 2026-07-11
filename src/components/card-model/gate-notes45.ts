// FIX-42 — 발행 게이트 능동 안내 정본(§13 — COACH_NOTES 패턴: LLM 생성 아님, 서버 호출 0).
//   규격 = 이유 1 + 행동 1 + 여지 카피("준비되면 발행하시면 돼요") — 체크리스트 낭독·재촉 금지.
//   키 = steps 정본의 coach 키(단일 소스). "거의 다 됐어요" 리드는 미충족 1개일 때만 앞에 붙는다
//   (여러 개 남았는데 "X만 하면 발행" 화법은 거짓 — 진실 경계).
//   순수 모듈 분리 이유: 발화 결정(스테이지·dedupe)을 프로덕션 경로 그대로 실측 가능하게.
import type { LingoStage } from "./useLingoChat";

export const GATE_NOTES: Record<string, string> = {
  product:
    "가격까지 있어야 친구가 주문을 결심해요. 상품 등록을 마쳐 주세요 — 준비되면 발행하시면 돼요.",
  shipBasis:
    "언제 받는지 알려줘야 안심하고 사요. 판매기간이나 발송일 하나만 정해 주세요 — 준비되면 발행하시면 돼요.",
  content: "카드는 영상에서 시작해요. 영상 하나만 담아 주세요 — 준비되면 발행하시면 돼요.",
  coupon:
    "쿠폰이 있어야 지금 누를 이유가 생겨요. 쿠폰 한 장만 연결해 주세요 — 준비되면 발행하시면 돼요.",
  calendar:
    "받을 날짜가 있어야 예약이 시작돼요. 예약 캘린더만 확정해 주세요 — 준비되면 발행하시면 돼요.",
  store: "주소가 있어야 손님이 안심해요. 매장 정보만 저장해 주세요 — 준비되면 발행하시면 돼요.",
  tagline: "그 한 줄이 카드의 목소리예요. 내 한마디만 적어 주세요 — 준비되면 발행하시면 돼요.",
};

export type GateUtteranceInput = {
  /** meta.stage 수신값 — 미수신(null)은 호출부에서 "guide"로 정규화(서버 신규 기본값 동일). */
  stage: LingoStage;
  /** 첫 미충족 필수 단계의 coach 키(방향등 순서 = currentTarget 과 동일 소스). */
  coachKey: string;
  /** 세션 내 이미 발화한 상태 키들(1상태 1발화 dedupe). */
  spokenKeys: string[];
  /** 미충족 필수 단계 수 — 1개일 때만 "거의 다 됐어요" 리드(진실 경계). */
  unmetRequiredCount: number;
};

/** 발화 텍스트 또는 null(침묵 — 배지·방향등이 이어받음). null 이면 spokenKeys 에 추가 금지. */
export function decideGateUtterance(i: GateUtteranceInput): string | null {
  if (i.stage === "standby") return null; // 발화 없이 배지만(§13 stage 연동).
  if (i.stage === "assist" && i.spokenKeys.length > 0) return null; // 게이트 도달 시 1회.
  if (i.spokenKeys.includes(i.coachKey)) return null; // 같은 미충족 상태 재발화 금지.
  const note = GATE_NOTES[i.coachKey];
  if (!note) return null;
  return (i.unmetRequiredCount === 1 ? "거의 다 됐어요. " : "") + note;
}
