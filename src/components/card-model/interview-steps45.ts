// FIX-48+50 — "번호 인터뷰" 좌표계 단일 정본(순수 모듈 · 판정 로직 복제 0).
//   이 파일은 순서·번호·라벨·앵커(덱 블록/폼 필드)만 소유한다. done 계산은 여기서 하지 않고,
//   호출부(CardStudioPage45 스텝퍼·덱 배지 / ProductRegisterForm45 폼 마커)가 기존에 이미
//   계산한 done 값을 signals 로 넘겨 resolveInterviewDone 이 "매핑"만 한다(신규 판정 금지).
//   설계 정본(Duke 확정): 발행 = 항상 마지막 번호. 선택 항목은 번호 없음((+) — 여기 미포함).

export type InterviewMode = "general" | "reserve" | "commerce";
/** 상품판매 판매/등록 방식 — 커머스 여정 분기(quick=빠른등록 / full=일반판매 / groupBuy=공동구매). */
export type SalesMethod = "quick" | "full" | "groupBuy";

export interface InterviewStep {
  /** 1-based 표시 번호(발행 = 마지막). */
  no: number;
  /** done 조회용 안정 키(resolveInterviewDone 스위치 키 = signals 필드명 근거). */
  key: string;
  /** 스텝퍼·배지 라벨(60대 가독 — 짧게). */
  label: string;
  /** 배지 앵커 — 덱 블록 id(있으면 그 카드 헤더에 번호 배지). */
  deckBlock?: string;
  /** 폼 마커 앵커 — ProductRegisterForm45 필드 키(있으면 그 Field 라벨에 번호 마커). */
  formField?: string;
  /** 도킹 등 건너뛰기 허용 단계((+스킵)). */
  skippable?: boolean;
  /** 조건부 단계(공동구매 모집마감 — 입력 시에만 유효, 미입력도 발행 게이트 아님). */
  conditional?: boolean;
  /** 종단 발행 단계. */
  publish?: boolean;
}

/** done 조회 signals — 호출부가 기존 계산값을 그대로 채워 넘긴다(신규 판정 로직 금지). */
export interface InterviewSignals {
  // 커머스 폼 신호(formProgress45 확장분)
  photoSet?: boolean;
  nameSet?: boolean;
  priceSet?: boolean;
  originSet?: boolean;
  gbTargetSet?: boolean;
  gbPriceSet?: boolean;
  gbDeadlineSet?: boolean;
  // 스튜디오 단계 신호(steps 정본 done 재사용)
  shipBasisDone?: boolean;
  dockDone?: boolean;
  videoDone?: boolean;
  taglineDone?: boolean;
  couponDone?: boolean;
  calendarDone?: boolean;
  storeAddrDone?: boolean;
  facilitiesDone?: boolean;
  publishDone?: boolean;
}

const PUBLISH: InterviewStep = { no: 0, key: "publish", label: "발행", publish: true };

/** 모드×판매방식 → 번호 여정(발행 포함). 번호는 1..n 재부여(발행 = n). */
export function getInterviewJourney(
  mode: InterviewMode,
  method: SalesMethod = "full",
): InterviewStep[] {
  let steps: InterviewStep[];
  if (mode === "general") {
    steps = [
      { no: 0, key: "video", label: "영상", deckBlock: "content" },
      { no: 0, key: "tagline", label: "한마디", deckBlock: "content" },
    ];
  } else if (mode === "reserve") {
    steps = [
      { no: 0, key: "video", label: "영상", deckBlock: "content" },
      { no: 0, key: "coupon", label: "쿠폰", deckBlock: "coupon" },
      { no: 0, key: "calendar", label: "캘린더", deckBlock: "calendar" },
      { no: 0, key: "storeAddr", label: "매장주소", deckBlock: "link" },
      { no: 0, key: "facilities", label: "시설", deckBlock: "link" },
    ];
  } else if (method === "quick") {
    // 커머스 · 빠른 등록(원포토)
    steps = [
      { no: 0, key: "photo", label: "사진", deckBlock: "product", formField: "photo" },
      { no: 0, key: "name", label: "상품명 확인", deckBlock: "product", formField: "name" },
      { no: 0, key: "price", label: "가격", deckBlock: "product", formField: "price" },
      { no: 0, key: "origin", label: "원산지", deckBlock: "product", formField: "origin" },
    ];
  } else if (method === "groupBuy") {
    // 커머스 · 공동구매
    steps = [
      { no: 0, key: "photo", label: "사진", deckBlock: "product", formField: "photo" },
      { no: 0, key: "name", label: "상품명", deckBlock: "product", formField: "name" },
      { no: 0, key: "origin", label: "원산지", deckBlock: "product", formField: "origin" },
      { no: 0, key: "price", label: "기본가", deckBlock: "product", formField: "price" },
      { no: 0, key: "gbTarget", label: "목표인원", deckBlock: "product", formField: "gbTarget" },
      { no: 0, key: "gbPrice", label: "달성가", deckBlock: "product", formField: "gbPrice" },
      { no: 0, key: "shipBasis", label: "발송기준", deckBlock: "seasonal" },
      { no: 0, key: "gbDeadline", label: "모집마감", deckBlock: "product", formField: "gbDeadline", conditional: true },
    ];
  } else {
    // 커머스 · 일반 판매(자세히 등록)
    steps = [
      { no: 0, key: "photo", label: "사진", deckBlock: "product", formField: "photo" },
      { no: 0, key: "name", label: "상품명", deckBlock: "product", formField: "name" },
      { no: 0, key: "origin", label: "원산지", deckBlock: "product", formField: "origin" },
      { no: 0, key: "price", label: "가격", deckBlock: "product", formField: "price" },
      { no: 0, key: "shipBasis", label: "발송기준", deckBlock: "seasonal" },
      { no: 0, key: "dock", label: "도킹", deckBlock: "dock", skippable: true },
    ];
  }
  return [...steps, { ...PUBLISH }].map((s, i) => ({ ...s, no: i + 1 }));
}

/** signals 기반 done 매핑(신규 판정 금지 — 기존 계산값 조회만). 미주입 신호 = 미완(false). */
export function resolveInterviewDone(key: string, s: InterviewSignals): boolean {
  switch (key) {
    case "photo":
      return !!s.photoSet;
    case "name":
      return !!s.nameSet;
    case "price":
      return !!s.priceSet;
    case "origin":
      return !!s.originSet;
    case "gbTarget":
      return !!s.gbTargetSet;
    case "gbPrice":
      return !!s.gbPriceSet;
    case "gbDeadline":
      return !!s.gbDeadlineSet;
    case "shipBasis":
      return !!s.shipBasisDone;
    case "dock":
      return !!s.dockDone;
    case "video":
      return !!s.videoDone;
    case "tagline":
      return !!s.taglineDone;
    case "coupon":
      return !!s.couponDone;
    case "calendar":
      return !!s.calendarDone;
    case "storeAddr":
      return !!s.storeAddrDone;
    case "facilities":
      return !!s.facilitiesDone;
    case "publish":
      return !!s.publishDone;
    default:
      return false;
  }
}

/** 3상태 파생 — 완료 / 현재(첫 미완) / 대기. 조건부 미완은 현재 지목에서 제외(발행 게이트 아님). */
export type InterviewStepState = "done" | "current" | "pending";

export function computeInterviewStates(
  steps: InterviewStep[],
  s: InterviewSignals,
): Array<{ step: InterviewStep; done: boolean; state: InterviewStepState }> {
  const withDone = steps.map((step) => ({ step, done: resolveInterviewDone(step.key, s) }));
  // 현재 = 조건부가 아닌 첫 미완 단계(조건부·발행은 현재 지목 대상이나 게이트 판정은 호출부 canPublish 소관).
  const currentIdx = withDone.findIndex((x) => !x.done && !x.step.conditional);
  return withDone.map((x, i) => ({
    ...x,
    state: x.done ? "done" : i === currentIdx ? "current" : "pending",
  }));
}

/** 덱 블록 배지용 — 해당 블록에 걸린 첫 번호 + 그 블록 전 단계 done 여부. */
export function blockBadge(
  steps: InterviewStep[],
  blockId: string,
  s: InterviewSignals,
): { no: number; done: boolean } | null {
  const forBlock = steps.filter((st) => st.deckBlock === blockId);
  if (forBlock.length === 0) return null;
  return {
    no: forBlock[0].no,
    done: forBlock.every((st) => resolveInterviewDone(st.key, s)),
  };
}
