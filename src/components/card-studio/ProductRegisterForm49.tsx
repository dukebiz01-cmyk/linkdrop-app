import { useEffect, useRef, useState } from "react";
import { ImageIcon, Sparkles, Plus, X, Search, Calculator, Info, Check, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
// UI-5-T4-D3c — 시세 참고(45 계승): 공용 presentational 어드바이저(무수정 import 소비만 · §0 파트너 전용).
import { PriceBandAdvisor, type PriceBandResult } from "@/components/commerce/PriceBandAdvisor";
import { GbScheduleCalendar } from "@/components/card-studio/GbScheduleCalendar";

export type ProductType = "fresh" | "processed" | "goods";
export type SaleUnit = "unit" | "box" | "weight";
export type DroppyMode = "rate" | "fixed";
export type StorageType = "room" | "cold" | "frozen";

export type ProductForm = {
  name: string;
  price: string;
  type: ProductType;
  /** fresh: 수확·발송 예정 "시작"일 / processed: 소비기한(단일) / goods: 발송 예정 "시작"일. F2① — E5g2 기간 정합. */
  harvestDate: string;
  /** F2① — fresh·goods 기간 "끝"일(시작=끝 = 하루). processed(소비기한)는 미사용. */
  harvestDateEnd: string;
  /** fresh: 품목(시세 연동) / processed: 식품 유형 / goods: 카테고리 */
  itemCategory: string;
  /** UI-5-T2-E5b — KAMIS 품목 확정 코드(fresh 후보 탭 시에만 기록 · 시세는 §0 손님 노출 금지, 코드 연동만). */
  kamisItemCode: string;
  /** fresh: 원산지 / processed: 원재료 원산지 / goods: 제조국 */
  origin: string;
  /** processed 전용: 보관 방법 */
  storage: StorageType;
  /** goods 전용: 브랜드·제조사 */
  brand: string;
  /** goods 전용: 구성·규격 */
  spec: string;
  saleUnit: SaleUnit;
  boxCount: string;
  totalWeight: string;
  weightUnknown: boolean;
  cost: string;
  freeShip: boolean;
  shipFee: string;
  droppyMode: DroppyMode;
  droppyRate: number;
  droppyFixed: string;
  plannedDiscount: string;
  quantity: string;
  headline: string;
  sellingPoints: string[];
  extraInfo: string;
  // UI-5-T5-F3-1(B안) — 이익 계산 보조 입력(대표님 입력만·payload 미편입 — blockData 명시 키 조립이라
  //   구조적 무유출). ProductForm 소속 = resetForMode 의 setCfgProduct(EMPTY_PRODUCT) 리셋 자동 편입.
  packCost: string; // 포장비(원) — 박스·아이스팩 등
  miscCost: string; // 기타비용(원) — 수수료 등
  // T5-W5a+ — 모일수록 할인(공동구매) optional 3필드: 미개설 = undefined = payload 키 미기록
  //   (additive 계약 — E5b 빌더·역파싱·지휘 3스텝과 단일 소스, W5a+ (a) 최소 접촉안).
  gbEnabled?: boolean;
  gbTiers?: { qty: number; price: number }[];
  gbFailMode?: "base" | "cancel";
};

export const EMPTY_PRODUCT: ProductForm = {
  name: "",
  price: "",
  type: "fresh",
  harvestDate: "",
  harvestDateEnd: "", // F2① — 기간 끝일.
  itemCategory: "",
  kamisItemCode: "", // E5b — KAMIS 확정 코드.
  origin: "",
  storage: "room",
  brand: "",
  spec: "",
  saleUnit: "unit",
  boxCount: "",
  totalWeight: "",
  weightUnknown: false,
  cost: "",
  freeShip: true,
  shipFee: "",
  droppyMode: "rate",
  droppyRate: 0,
  droppyFixed: "",
  plannedDiscount: "",
  quantity: "",
  headline: "",
  sellingPoints: [""],
  extraInfo: "",
  packCost: "",
  miscCost: "",
};

const TYPE_OPTIONS: { id: ProductType; label: string }[] = [
  { id: "fresh", label: "신선식품" },
  { id: "processed", label: "가공식품" },
  { id: "goods", label: "공산품·잡화" },
];

const UNIT_OPTIONS: { id: SaleUnit; label: string }[] = [
  { id: "unit", label: "낱개로" },
  { id: "box", label: "박스·묶음으로" },
  { id: "weight", label: "무게 단위로" },
];

/** 유형별 라벨·플레이스홀더·노출 필드 — 유형을 바꾸면 폼 내용이 함께 바뀐다 */
const TYPE_COPY: Record<
  ProductType,
  {
    namePh: string;
    dateLabel: string;
    dateHint: string;
    categoryLabel: string;
    categoryHint: string;
    categoryPh: string;
    categorySearch: string | null;
    originLabel: string;
    originPh: string;
    promoPh: string;
    promoNote: string;
    pointPh: string;
    allowWeight: boolean;
  }
> = {
  fresh: {
    namePh: "예: 해남 꿀고구마 5kg",
    dateLabel: "수확·발송 예정일",
    dateHint: "선택",
    categoryLabel: "품목 분류",
    categoryHint: "선택 · 시세·제철 연동용",
    categoryPh: "품목 이름을 입력하세요 (예: 옥수수)",
    categorySearch: "직접 찾기 (부류 → 품목 선택)",
    originLabel: "원산지",
    originPh: "예: 국산(충북 괴산)",
    promoPh: "재료·산지·수확 방식·특징을 적으면 AI가 더 정확한 카피를 써줘요.",
    promoNote: "원산지·재배 방식 등 사실만 적어주세요. (과장·없는 내용 금지)",
    pointPh: "예: 당도 15Brix 이상",
    allowWeight: true,
  },
  processed: {
    namePh: "예: 수제 딸기잼 300g",
    dateLabel: "소비기한(유통기한)",
    dateHint: "권장",
    categoryLabel: "식품 유형",
    categoryHint: "선택",
    categoryPh: "예: 과채가공품, 장류, 즙류",
    categorySearch: null,
    originLabel: "원재료 원산지",
    originPh: "예: 딸기 100% 국산(논산)",
    promoPh: "원재료·제조 방식·맛 특징을 적으면 AI가 더 정확한 카피를 써줘요.",
    promoNote: "원재료 함량·제조 방식 등 사실만 적어주세요. (과장·없는 내용 금지)",
    pointPh: "예: 설탕 대신 원당 사용",
    allowWeight: false,
  },
  goods: {
    namePh: "예: 소이 캔들 2구 선물세트",
    dateLabel: "발송 예정일",
    dateHint: "선택",
    categoryLabel: "카테고리",
    categoryHint: "선택",
    categoryPh: "예: 생활잡화, 캔들·디퓨저",
    categorySearch: null,
    originLabel: "제조국",
    originPh: "예: 대한민국 / 중국(OEM)",
    promoPh: "소재·사이즈·사용법·제작 방식을 적으면 AI가 더 정확한 카피를 써줘요.",
    promoNote: "소재·규격·인증 등 사실만 적어주세요. (과장·없는 내용 금지)",
    pointPh: "예: 천연 소이왁스 100%",
    allowWeight: false,
  },
};

const STORAGE_OPTIONS: { id: StorageType; label: string }[] = [
  { id: "room", label: "실온" },
  { id: "cold", label: "냉장" },
  { id: "frozen", label: "냉동" },
];

// UI-5-T7-F5-8 — 발송 안내 프리셋(가공·공산품). 프리셋 불일치 = 직접 입력 모드(파생 — 로컬 상태 0).
const SHIP_ETA_PRESETS = ["당일 발송", "1~2일", "3~5일"];

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");

// UI-5-T5-F3-2b — 품종 선택 칩 후보: Edge get-price-band VARIETY_TAGS 의 거울(정본 = Edge 사전 —
//   태깅·필터 판정은 서버. 여기는 칩 표시 전용). 항목 추가 시 양쪽 동시 수정. 별칭(연농 등)은
//   서버 태깅 소관이라 미거울(칩은 정규 품종명만).
const VARIETY_CHIPS: Record<string, string[]> = {
  옥수수: ["대학찰", "흑찰", "미백", "초당", "찰"],
  고구마: ["호박", "자색", "꿀", "밤"],
  감자: ["수미", "두백", "홍감자", "자주"],
  사과: ["시나노골드", "아리수", "부사", "홍로", "홍옥", "양광"],
  배: ["신고", "원황", "추황", "화산"],
  복숭아: ["백도", "황도", "천도"],
  포도: ["샤인머스캣", "캠벨", "거봉", "머루"],
  쌀: ["고시히카리", "신동진", "백진주", "추청", "오대"],
};

/** UI-5-T4-D3d→T5-F3-1→F3-1b(완전판 확정식·실결제액 기준 판정 반영) —
 *  정가 이익 = 판매가 − 원가 − 배송비(D3d 분기) − 드로피 할인(쿠폰 자동) − 포장비 − 기타비용 − 공유 보상(판매가 기준)
 *  할인 이익 = (판매가 − 예정 할인) − 원가 − 배송비 − 쿠폰 − 포장비 − 기타 − 공유 보상(실결제액 기준)
 *  · D3d 계승: 무료배송 = 배송비 차감 / 구매자 부담 = 제외(45 :542-555·:410-412 정본).
 *  · 공유 보상 비율형 = 기준액 × % ÷ 100 반올림 — 기준액: 정가 줄 = 판매가 / 할인 줄 = 실결제액(판매가−할인).
 *    링고 판정(F3-1b): 화면 이익 = 실지급 구조 일치 — 정본 computeProfitReceipt
 *    (commerce/ProductRegisterForm.tsx :155-162, net 기준 dropyCost) 규칙 동일식. 할인 클램프(0≤할인≤판매가)도 정본 :155 동일.
 *  · 고정형 = 45 :421-428 기준 그대로 — 0 < 고정값 ≤ 판매가 통과분만 차감(무효 = 0 취급 · 정가/할인 양쪽 동일액).
 *  · couponKrw 는 호출부 환산 완료 원 단위(정률 = 판매가 × 율 반올림). 빈 값 = 0.
 *  · 계산 단일 소스 — 표시부는 반환값만 소비(재계산 금지 · F3-1 계약 유지). */
function profitOf(v: ProductForm, couponKrw: number) {
  const p = Number(onlyDigits(v.price));
  const c = Number(onlyDigits(v.cost));
  if (!p || !c) return null;
  const fee = v.freeShip ? Number(onlyDigits(v.shipFee)) || 0 : 0;
  const pack = Number(onlyDigits(v.packCost)) || 0;
  const misc = Number(onlyDigits(v.miscCost)) || 0;
  const fixedRaw = Number(onlyDigits(v.droppyFixed));
  const fixedShare = fixedRaw > 0 && fixedRaw <= p ? Math.floor(fixedRaw) : 0;
  const shareOf = (baseKrw: number) =>
    v.droppyMode === "rate"
      ? v.droppyRate > 0
        ? Math.round((baseKrw * v.droppyRate) / 100)
        : 0
      : fixedShare;
  const discount = Math.min(Number(onlyDigits(v.plannedDiscount)) || 0, p);
  const share = shareOf(p);
  const regular = p - c - fee - couponKrw - pack - misc - share;
  const net = p - discount;
  const shareDiscounted = shareOf(net);
  return {
    regular,
    discounted: discount > 0 ? net - c - fee - couponKrw - pack - misc - shareDiscounted : null,
    share,
    shareDiscounted,
    discount,
  };
}

export function ProductRegisterForm({
  value,
  onChange,
  accent,
  photoUrl,
  onEditPhoto,
  onNotify,
  onRegister,
  registerSaving,
  registerError,
  registeredName,
  saleReady,
  onGoSalePeriod,
  onSetSaleEnd,
  saleEndIso,
  onAiWrite,
  aiWriting,
  onAiSuggestPoints,
  aiPointsLoading,
  aiPointCandidates,
  onConsumePointCandidate,
  couponDiscount,
  shipEta,
  onShipEtaChange,
}: {
  value: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  accent: string;
  /** UI-5-T7-F5-8 — 발송 안내(가공·공산품 한정 노출). 값 = 49 cfgShipEta 단일 소스
   *  (delivery 블록 '도착 예정'·미리보기 배송정보 shipNote 와 동일 상태 — 신규 값 상태 0). */
  shipEta?: string;
  onShipEtaChange?: (v: string) => void;
  /** T5-W5a++ 마개 2 — 판매 기간 확정 여부(페이지 commerceSaleReady 동일식 전달 — 폼은 존재 검사·안내만). */
  saleReady?: boolean;
  /** T5-W5b-F1 — 기간 배너 [판매 기간 설정하기] 이동(페이지 jumpToBlock 기제 — 미지정 = 버튼 미노출). */
  onGoSalePeriod?: () => void;
  /** T5-W5b-F2-A — 통합 달력 마감 기록(승인 콜백 1개): 페이지 saleEndIso 기존 경로 연결.
   *  미지정 = 마감 칩 비활성(죽은 입구 금지 — 이때 기간 배너 폴백 유지). */
  onSetSaleEnd?: (iso: string) => void;
  /** T5-W5b-F2a — 마감 표시 초기값(승인 값 prop 1개): 재편집 진입 시 기존 saleEndIso 표시.
   *  확정 신호는 saleReady 와 결합(페이지 기본값 오표시 방지) · 기록 경로(onSetSaleEnd)는 무변. */
  saleEndIso?: string | null;
  /** UI-5-T2-E5a — 상품 사진 = 스텝 1 단일 입구. 폼은 표시 전용(업로드 경로 0). */
  photoUrl?: string;
  onEditPhoto?: () => void;
  /** F2-C — 안내 토스트 위임(미지정 = 인라인 폴백 1줄). */
  onNotify?: (msg: string) => void;
  /** UI-5-T2-E5b — [상품 등록하기] 확정(사용자 탭 유래만 — 자동/링고 트리거 0). 미지정 = 버튼 미노출. */
  onRegister?: () => void;
  registerSaving?: boolean;
  registerError?: string | null;
  /** 등록 완료 상태 표시(재등록 허용 — 45 관례: 재제출 = 새 등록). */
  registeredName?: string | null;
  /** UI-5-T4-D3e→T5-F3-3 — AI 카피 입구(headline 전용): 탭 = 호출부 sendToLingo 발화(L4 카피 액션 경로).
   *  F3-3(1) 입구 단일화 — 대형 [✦ AI 카피 생성] 버튼이 유일 소비처(구 headline 칸 옆 칩 제거).
   *  숫자 불가침 — 가격·수량·날짜 칸 부착 금지. 미지정 = 버튼 미노출(죽은 입구 금지). */
  onAiWrite?: () => void;
  aiWriting?: boolean;
  /** UI-5-T5-F3-3(2) — 셀링포인트 [✦ 후보 받기]: 발화는 호출부, 후보 표시·채택은 이 폼.
   *  채택 = 대표님 칩 탭만(자동 주입 0) → 수동 입력과 동일 set("sellingPoints") 경로로 기입.
   *  onConsumePointCandidate = 채택·중복 시 후보 소진 통지(호출부 목록에서 제거). */
  onAiSuggestPoints?: () => void;
  aiPointsLoading?: boolean;
  aiPointCandidates?: string[];
  onConsumePointCandidate?: (p: string) => void;
  /** UI-5-T5-F3-1(2) — 장착 쿠폰 할인(자동 행 재료): 페이지 selectedCoupon → {value, isPercent}.
   *  null = 미장착(행 숨김). 해제/교체 = prop 재렌더로 자동 재계산. 환산(정률 = 판매가 × 율)은 폼 내부. */
  couponDiscount?: { value: number; isPercent: boolean } | null;
}) {
  const set = <K extends keyof ProductForm>(key: K, v: ProductForm[K]) => onChange({ [key]: v } as Partial<ProductForm>);
  // UI-5-T5-F3-3(2) — 후보 칩 채택: 사용자 칩 탭만("채택은 대표님" 원칙 — 자동 주입 0). 기입은 수동
  //   타이핑과 동일한 set("sellingPoints") 사슬(신규 쓰기 경로 금지) — 빈 칸 우선 채움, 없으면 행 추가.
  //   5개 상한 = 소비부 slice(0,5)(등록 :875 · 발행 :3037)와 정합 — 도달 시 안내 후 미기입.
  const adoptPoint = (p: string) => {
    const cur = value.sellingPoints;
    const filled = cur.map((s) => s.trim()).filter(Boolean);
    if (filled.includes(p)) {
      onNotify?.("이미 담겨 있어요");
      onConsumePointCandidate?.(p);
      return;
    }
    if (filled.length >= 5) {
      onNotify?.("셀링포인트는 5개까지 실려요 — 칸을 비우고 담아 주세요");
      return;
    }
    const emptyIdx = cur.findIndex((s) => !s.trim());
    const next = emptyIdx >= 0 ? cur.map((s, idx) => (idx === emptyIdx ? p : s)) : [...cur, p];
    set("sellingPoints", next);
    onConsumePointCandidate?.(p);
  };
  // UI-5-T2-E5b — KAMIS(fresh) 병합 품목 1회 로드 + 타이핑 후보 매칭(45 :383-405·:778-784 동형).
  //   시세 조회(get-price-band)는 미이식 — §0 손님 노출 금지, 코드 연동만(E5b 락).
  type KamisItem = { item_code: string; item_name: string; category_code: string };
  const [kamisAll, setKamisAll] = useState<KamisItem[]>([]);
  const [kamisOpen, setKamisOpen] = useState(false);
  useEffect(() => {
    if (value.type !== "fresh" || kamisAll.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSupabase()
          .from("kamis_items" as never)
          .select("item_code, item_name, category_code")
          .order("sort_order");
        if (!cancelled) setKamisAll((data as unknown as KamisItem[] | null) ?? []);
      } catch {
        // graceful — 품목 연동은 선택 사항(45 동일).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value.type, kamisAll.length]);
  // UI-5-T4-D3c — 시세 참고(45 :498-541 동형 이식): 트리거 = 품목 코드 "확정" 시(fresh + kamis_item_code
  //   + category_code — fuzzy 금지 락) · debounce 350ms · get-price-band Edge invoke.
  //   ⚠️ §0 락: 시세는 파트너 화면 전용 참고 — 폼 로컬 상태뿐(onChange/cfgProduct/payload 로 유출 0).
  //   F3-2a — 구 "composition 미전달" 락 해제: 45 동형 구성 파라미터·composition 전달 복원(아래 계산부).
  const [priceBand, setPriceBand] = useState<PriceBandResult | null>(null);
  const [priceBandLoading, setPriceBandLoading] = useState(false);
  const [priceBandRefresh, setPriceBandRefresh] = useState(0);
  // UI-5-T5-F3-2a — 낱개 1개 무게(g): 45 :320 동형 폼 로컬 상태(시세 개당 환산 기준 전용).
  //   ProductForm 미편입 = 등록/발행 payload 구조적 무유출(§0 시세 락 정합) · AI setField 경로 부재.
  const [singleWeightG, setSingleWeightG] = useState("");
  // F3-2a — 판매 구성 통역(45 :432-449 정본 계산 그대로): 모드 → 유효 구성(입수·총중량 kg).
  //   box=개수×총kg / unit=1개×g / weight=1단위×kg. 무게 미상이면 구성 없음(kg 비교 생략).
  //   구성 성립 시에만 앵커 축 발동(45 계약 동일 — 미입력 = 현행 표+캡션 유지).
  const composition = (() => {
    if (value.type !== "fresh" || value.weightUnknown) return null;
    if (value.saleUnit === "box") {
      const n = Math.floor(Number(value.boxCount));
      const kg = Number(value.totalWeight);
      return Number.isFinite(n) && n >= 1 && Number.isFinite(kg) && kg > 0
        ? { unitCount: n, totalKg: kg }
        : null;
    }
    if (value.saleUnit === "unit") {
      const g = Number(singleWeightG);
      return Number.isFinite(g) && g > 0 ? { unitCount: 1, totalKg: g / 1000 } : null;
    }
    const kg = Number(value.totalWeight);
    return Number.isFinite(kg) && kg > 0 ? { unitCount: 1, totalKg: kg } : null;
  })();
  // 개당 중량(g) — 총중량÷입수(45 :450-453 P5a 공식 그대로). get-price-band per_unit_weight_g 전달.
  const perUnitWeightG = composition
    ? Math.round((composition.totalKg * 1000) / composition.unitCount)
    : null;
  const unitCountForQuery = composition != null ? composition.unitCount : null;
  // F3-2b(7) — 정합성 가드 45 :454-456 동형: 개당 10g 미만 / 5kg 초과 = 확인 배너(차단 아닌 확인).
  const compositionSuspect =
    perUnitWeightG != null && (perUnitWeightG < 10 || perUnitWeightG > 5000);
  // F3-2b(5) — 품종 선택(대표님 탭만 — AI setField 부착 금지·콘텐츠 선택=대표님 원칙):
  //   폼 로컬 상태 = kind 파라미터 + 카드 상품명 표기 재료 보관. 발행 payload 편입은 기존 키 부재로
  //   보류(검증 보고 참조 — 신규 키 승인 대기). 품목 변경 시 해제(타 품목 품종 오염 방지).
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [kindCustomOpen, setKindCustomOpen] = useState(false);
  const [kindCustomText, setKindCustomText] = useState("");
  useEffect(() => {
    setSelectedKind(null);
    setKindCustomOpen(false);
    setKindCustomText("");
  }, [value.kamisItemCode]);
  const kamisItemName = value.kamisItemCode
    ? (kamisAll.find((it) => it.item_code === value.kamisItemCode)?.item_name ?? null)
    : null;
  const varietyChips = kamisItemName ? (VARIETY_CHIPS[kamisItemName] ?? []) : [];
  const kamisCategoryCode = value.kamisItemCode
    ? (kamisAll.find((it) => it.item_code === value.kamisItemCode)?.category_code ?? null)
    : null; // 45 :474-477 동형 — 병합 목록 역참조(get-price-band 필수 파라미터).
  useEffect(() => {
    if (value.type !== "fresh" || !value.kamisItemCode || !kamisCategoryCode) {
      setPriceBand(null);
      setPriceBandLoading(false);
      return;
    }
    let cancelled = false;
    setPriceBandLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const fail: PriceBandResult = {
          status: "error",
          item_code: value.kamisItemCode,
          item_name: null,
          sources: [],
          cached: false,
        };
        try {
          const { data, error } = await getSupabase().functions.invoke("get-price-band", {
            // F3-2a — 45 :520-526 동형: 구성 성립 시에만 per_unit_weight_g·unit_count 편입
            //   (Edge 무수정 — 기존 옵셔널 파라미터 소비 → unit축 번역·count-only 환산 가동).
            body: {
              item_code: value.kamisItemCode,
              category_code: kamisCategoryCode,
              ...(perUnitWeightG != null && unitCountForQuery != null
                ? { per_unit_weight_g: perUnitWeightG, unit_count: unitCountForQuery }
                : {}),
              // F3-2b — 품종 필터(선택 시에만 — 미선택 = 현행 혼합 밴드 + "품종 섞임" 캡션).
              ...(selectedKind ? { kind: selectedKind } : {}),
            },
          });
          if (cancelled) return;
          setPriceBand(error || !data ? fail : (data as PriceBandResult));
        } catch {
          if (!cancelled) setPriceBand(fail); // 참고 정보 — 무언 실패 허용(Advisor 가 작은 안내 + 재조회 제공).
        } finally {
          if (!cancelled) setPriceBandLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // F3-2a — 45 :541 동형 deps: 구성 타이핑도 debounce 350ms 재조회(연타 방지 기존 타이머 재사용).
    // F3-2b — selectedKind 편입: 품종 선택/해제 = 즉시 재조회(같은 debounce).
  }, [value.type, value.kamisItemCode, kamisCategoryCode, priceBandRefresh, perUnitWeightG, unitCountForQuery, selectedKind]);
  // 후보 = 입력 부분일치 상위 6(45 :779-784 동형 — 공백 제거 소문자 정규화).
  const normItem = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const kamisMatches =
    value.type === "fresh" && kamisOpen && value.itemCategory.trim() && !value.kamisItemCode
      ? kamisAll.filter((it) => normItem(it.item_name).includes(normItem(value.itemCategory))).slice(0, 6)
      : [];
  // F2-C 폴백(로드 실패·빈 목록 시) — 인라인 안내 1줄(2s).
  const [categoryNotice, setCategoryNotice] = useState(false);
  const categoryNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CATEGORY_PENDING_MSG = "품목 이름을 입력하면 후보를 찾아드려요";
  // ── T5-W5a+/W5a++ — 모일수록 할인(공동구매) ─────────────────────────────
  //   값 흐름 = onChange(controlled)만 · 단일 판매(기본)/미완성 = undefined = payload 미기록(additive).
  //   W5a++ F1 — 제안 불가 원인별 안내(가격/수량 미입력 · 확정 문구 2종만).
  const [gbHint, setGbHint] = useState<"price" | "qty" | null>(null);
  const gbStockN = Math.floor(Number(onlyDigits(value.quantity))) || 0;
  const gbRows = value.gbTiers ?? [];
  // 행별 유효성(W5a 지휘 동일 3규칙 — 데이터 층 무변): 양수 · qty 순오름차순 · price 순내림차순 · 마지막 qty ≤ 수량.
  const gbRowBad = (i: number): boolean => {
    const r = gbRows[i];
    if (!r || r.qty <= 0 || r.price <= 0) return true;
    if (i > 0 && (r.qty <= gbRows[i - 1].qty || r.price >= gbRows[i - 1].price)) return true;
    if (i === gbRows.length - 1 && gbStockN > 0 && r.qty > gbStockN) return true;
    return false;
  };
  const gbTiersOk = gbRows.length > 0 && !gbRows.some((_, i) => gbRowBad(i));
  // W5a++ 마개 2 — 모일수록 선택 시 필수 승격: 가격·수량·판매 기간(saleReady — 페이지 소관 값은 존재
  //   검사만) 미충족도 [상품 등록하기] 차단에 편입.
  const gbBlocked =
    value.gbEnabled === true &&
    (!gbTiersOk ||
      !value.gbFailMode ||
      !(Number(onlyDigits(value.price)) > 0) ||
      gbStockN <= 0 ||
      !saleReady);
  // W5a++ 마개 1 — 이익 계산 최저 단계 병기 재료: 최저가 = 마지막 행(price 내림차순 정본) · 시나리오 =
  //   기존 profitOf 재사용(가격만 최저가로 치환 — 계산 로직 무수정, 공유 보상 반영 방식 자동 동일).
  const gbMinPrice = value.gbEnabled === true && gbTiersOk ? gbRows[gbRows.length - 1].price : null;
  // 단계표 제안 산식([결정적 — AI 생성 숫자 아님] · W5a 지휘와 동일): 임계 후보 [3,10,20,30,50,100]
  //   중 수량 이하만 채택(사다리 천장) · 앞에서부터 최대 4단계(후보 0 = 수량 단일 폴백) ·
  //   가격 = 기본가 × (1 − 0.07×단계차수) 백원 단위 절사(단계당 7% 체감 · 하한 100원). 확정은 사장님.
  //   W5b-F1 — [행 추가] 연장 규칙(동일 결정적 산식의 연장): 임계 = 후보에서 마지막 행 다음 값
  //   (후보 소진 = 마지막 임계×2) · 천장 초과 = 추가 차단 · 가격 = 직전 행가 × 0.93 백원 절사·하한 100원.
  const buildGbProposal = (): { qty: number; price: number }[] => {
    const base = Number(onlyDigits(value.price)) || 0;
    if (base <= 0 || gbStockN <= 0) return [];
    const cands = [3, 10, 20, 30, 50, 100].filter((q) => q <= gbStockN).slice(0, 4);
    const qtys = cands.length > 0 ? cands : [gbStockN];
    return qtys.map((q, i) => ({
      qty: q,
      price: Math.max(100, Math.floor((base * (1 - 0.07 * (i + 1))) / 100) * 100),
    }));
  };
  // W5b-F1 — [행 추가] 다음 임계(연장 규칙): 마지막 행 다음 후보 · 소진 = ×2. 행 0개 = null(제안 1행 경로).
  const gbNextQty = (() => {
    const last = gbRows[gbRows.length - 1];
    if (!last) return null;
    return [3, 10, 20, 30, 50, 100].find((q) => q > last.qty) ?? last.qty * 2;
  })();
  // 천장 차단 신호: 재료 충족 상태에서 다음 임계가 수량 초과 = [행 추가] 비활성(신규 문구 0).
  const gbAddBlocked =
    gbRows.length > 0 &&
    Number(onlyDigits(value.price)) > 0 &&
    gbStockN > 0 &&
    gbNextQty != null &&
    gbNextQty > gbStockN;
  // W5b-F1 — 행 추가 = 산식 자동 채움(빈 행 폐지). 재료 미입력 = 원인별 배너 + 미추가.
  const addGbRow = () => {
    const base = Number(onlyDigits(value.price)) || 0;
    if (base <= 0) {
      setGbHint("price");
      return;
    }
    if (gbStockN <= 0) {
      setGbHint("qty");
      return;
    }
    setGbHint(null);
    if (gbRows.length === 0) {
      const first = buildGbProposal()[0];
      if (first) set("gbTiers", [first]); // 제안 받기 1행분과 동일 산출.
      return;
    }
    if (gbNextQty == null || gbNextQty > gbStockN) return; // 천장 — 미동작(버튼 비활성 병행).
    const last = gbRows[gbRows.length - 1];
    const price = Math.max(100, Math.floor((last.price * 0.93) / 100) * 100);
    set("gbTiers", [...gbRows, { qty: gbNextQty, price }]);
  };
  const notifyCategoryHint = () => {
    // E5b — KAMIS 매칭 해제(F2-C 준비 중 → 실기능): 버튼 = 매칭 열기 + 입력 유도 안내.
    setKamisOpen(true);
    if (onNotify) {
      onNotify(CATEGORY_PENDING_MSG);
      return;
    }
    setCategoryNotice(true);
    if (categoryNoticeTimer.current) clearTimeout(categoryNoticeTimer.current);
    categoryNoticeTimer.current = setTimeout(() => setCategoryNotice(false), 2000);
  };
  // F3-1(2) — 드로피 할인 자동 산출: 정률 = 판매가 × 율(반올림) / 정액 = 값 그대로. 미장착 = 0(행 숨김).
  const couponDiscountKrw = couponDiscount
    ? couponDiscount.isPercent
      ? Math.round(((Number(onlyDigits(value.price)) || 0) * couponDiscount.value) / 100)
      : Math.round(couponDiscount.value)
    : 0;
  const profit = profitOf(value, couponDiscountKrw); // D3d 배송 분기 + F3-1b 완전판 확정식(단일 소스).
  // F3-1(3) — 내역 표시용 분해값(계산 단일 소스 = profitOf — 여기는 표기 재료만).
  const bdPrice = Number(onlyDigits(value.price)) || 0;
  const bdCost = Number(onlyDigits(value.cost)) || 0;
  const bdShip = value.freeShip ? Number(onlyDigits(value.shipFee)) || 0 : 0;
  const bdPack = Number(onlyDigits(value.packCost)) || 0;
  const bdMisc = Number(onlyDigits(value.miscCost)) || 0;
  const copy = TYPE_COPY[value.type];
  const unitOptions = copy.allowWeight ? UNIT_OPTIONS : UNIT_OPTIONS.filter((o) => o.id !== "weight");

  /** 유형 변경 — 무게 판매를 지원하지 않는 유형이면 판매 단위를 되돌린다 */
  const selectType = (t: ProductType) => {
    const patch: Partial<ProductForm> = { type: t };
    if (!TYPE_COPY[t].allowWeight && value.saleUnit === "weight") patch.saleUnit = "unit";
    onChange(patch);
  };

  const focusRing = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`);
  const blurRing = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = "inset 0 0 0 1px transparent");

  return (
    <div className="space-y-4">
      {/* UI-5-T2-E5a — 상품 사진 = 표시 전용(스텝 1이 유일 업로드 입구). 업로드 input 없음. */}
      <Field label="상품 사진">
        {photoUrl ? (
          <div className="space-y-1.5">
            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-[#F4F4F5]">
              <img src={photoUrl} alt="상품 사진" className="h-full w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={onEditPhoto}
              className="text-[12px] font-bold"
              style={{ color: accent }}
            >
              사진 바꾸기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEditPhoto}
            className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5] text-[#8A8A8A]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
              <ImageIcon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-semibold">사진 올리러 가기</span>
          </button>
        )}
      </Field>

      {/* 상품명 */}
      <Field label="상품명" required>
        <input
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={copy.namePh}
          className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
      </Field>

      {/* 상품 유형 — 바꾸면 아래 필드 구성이 함께 바뀐다 */}
      <Field label="상품 유형">
        <Segmented options={TYPE_OPTIONS} value={value.type} onSelect={selectType} accent={accent} />
      </Field>

      {/* 날짜 — 유형별: 수확·발송(기간) / 소비기한(단일) / 발송(기간).
          F2① — fresh·goods 단일 date 잔재를 시작~끝 기간으로 수복(E5g2 확정 정합 · 시작=끝 = 하루).
          processed 소비기한은 의미상 단일이 정답 — 유지.
          UI-5-T7-F5-8 — goods 발송 예정일(달력 기간 축) 숨김: "주문 후 며칠" 개념과 헷갈림 유발 →
          아래 발송 안내 1칸이 대체. processed 소비기한은 발송 축이 아니라(식품 정보) 유지 판단.
          fresh 는 현행 유지(F1(재) 유형별 게이트 정합 — 칩 주입도 fresh 한정 기존 가드). */}
      {value.type !== "goods" && (
      <Field label={copy.dateLabel} hint={copy.dateHint}>
        {value.type === "processed" ? (
          <input
            type="date"
            value={value.harvestDate}
            onChange={(e) => set("harvestDate", e.target.value)}
            className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none focus:bg-white"
            style={{ boxShadow: "inset 0 0 0 1px transparent" }}
            onFocus={focusRing}
            onBlur={blurRing}
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={value.harvestDate}
              onChange={(e) => set("harvestDate", e.target.value)}
              aria-label={`${copy.dateLabel} 시작`}
              className="min-w-0 flex-1 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none focus:bg-white"
              style={{ boxShadow: "inset 0 0 0 1px transparent" }}
              onFocus={focusRing}
              onBlur={blurRing}
            />
            <span className="shrink-0 text-[12px] font-semibold text-[#8A8A8A]">~</span>
            <input
              type="date"
              value={value.harvestDateEnd}
              min={value.harvestDate || undefined}
              onChange={(e) => set("harvestDateEnd", e.target.value)}
              aria-label={`${copy.dateLabel} 끝`}
              className="min-w-0 flex-1 rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none focus:bg-white"
              style={{ boxShadow: "inset 0 0 0 1px transparent" }}
              onFocus={focusRing}
              onBlur={blurRing}
            />
          </div>
        )}
      </Field>
      )}

      {/* UI-5-T7-F5-8 — 가공·공산품 발송 안내: "주문 받고 며칠 안에 보내세요?" 선택지형.
          직접 입력 판정 = 프리셋 불일치 파생(로컬 상태 0 · 프리셋 탭 = 값 교체). */}
      {value.type !== "fresh" && onShipEtaChange && (
        <Field label="발송 안내" hint="선택">
          <p className="mb-1.5 text-[11px] font-medium text-[#8A8A8A]">
            주문 받고 며칠 안에 보내세요?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SHIP_ETA_PRESETS.map((p) => {
              const on = shipEta === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onShipEtaChange(p)}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                  style={
                    on
                      ? { backgroundColor: accent, color: "#fff" }
                      : { backgroundColor: "#F4F4F5", color: "#525252" }
                  }
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onShipEtaChange("")}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={
                !SHIP_ETA_PRESETS.includes(shipEta ?? "")
                  ? { backgroundColor: accent, color: "#fff" }
                  : { backgroundColor: "#F4F4F5", color: "#525252" }
              }
            >
              직접 입력
            </button>
          </div>
          {!SHIP_ETA_PRESETS.includes(shipEta ?? "") && (
            <input
              value={shipEta ?? ""}
              onChange={(e) => onShipEtaChange(e.target.value)}
              placeholder="예: 주문 후 2~3일"
              className="mt-1.5 w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
              style={{ boxShadow: "inset 0 0 0 1px transparent" }}
              onFocus={focusRing}
              onBlur={blurRing}
            />
          )}
          {/* 정직 안내 — 이 값이 카드 어디에 뜨는지. */}
          <p className="mt-1.5 text-[10.5px] font-medium text-[#A3A3A3]">
            받는 분 카드의 [배송정보]에 그대로 보여요
          </p>
        </Field>
      )}

      {/* 가공식품 전용 — 보관 방법 */}
      {value.type === "processed" && (
        <Field label="보관 방법">
          <Segmented options={STORAGE_OPTIONS} value={value.storage} onSelect={(id) => set("storage", id)} accent={accent} />
        </Field>
      )}

      {/* 공산품·잡화 전용 — 브랜드·제조사 */}
      {value.type === "goods" && (
        <Field label="브랜드·제조사" hint="선택">
          <input
            value={value.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="예: 포레스트 공방"
            className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
            style={{ boxShadow: "inset 0 0 0 1px transparent" }}
            onFocus={focusRing}
            onBlur={blurRing}
          />
        </Field>
      )}

      {/* 분류 — 유형별: 품목(시세 연동) / 식품 유형 / 카테고리.
          UI-5-T2-E5b — KAMIS 실매칭(45 :1226-1266 동형): 타이핑 → 후보 상위 6 → 탭 = item_code 확정
          + 상품명 자동 채움(비었을 때만). 시세 숫자 표기는 미이식(§0 — 파트너 화면까지도 코드 연동만). */}
      <Field label={copy.categoryLabel} hint={copy.categoryHint}>
        <input
          value={value.itemCategory}
          onChange={(e) => {
            onChange({ itemCategory: e.target.value, kamisItemCode: "" }); // 수정 = 확정 해제(45 동일).
            setKamisOpen(true);
          }}
          placeholder={copy.categoryPh}
          className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
        {value.type === "fresh" && value.kamisItemCode && (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: accent }}>
            <Check className="h-3 w-3" strokeWidth={2.75} />
            품목 연동됨 (코드 {value.kamisItemCode})
          </p>
        )}
        {kamisMatches.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {kamisMatches.map((it) => (
              <button
                key={it.item_code}
                type="button"
                onClick={() => {
                  // E5b — 탭 = 정확 item_code 확정 + 상품명 자동 채움(비었을 때만 — 사용자 입력 존중).
                  onChange({
                    itemCategory: it.item_name,
                    kamisItemCode: it.item_code,
                    ...(value.name.trim() ? {} : { name: it.item_name }),
                  });
                  setKamisOpen(false);
                }}
                className="flex w-full items-center gap-1.5 rounded-lg bg-[#F4F4F5] px-2.5 py-2 text-left text-[12px] font-semibold text-[#0A0A0A] active:bg-[#ECECEC]"
              >
                <Search className="h-3.5 w-3.5 text-[#8A8A8A]" strokeWidth={2.25} />
                {it.item_name}
              </button>
            ))}
          </div>
        )}
        {copy.categorySearch && (
          <>
            <button
              type="button"
              onClick={notifyCategoryHint}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] py-2 text-[12px] font-semibold text-[#525252] transition-colors active:bg-[#ECECEC]"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2.25} />
              {copy.categorySearch}
            </button>
            {categoryNotice && (
              <p className="mt-1 text-[11px] font-semibold text-[#8A8A8A] [word-break:keep-all]">{CATEGORY_PENDING_MSG}</p>
            )}
          </>
        )}
      </Field>

      {/* 원산지 — 유형별: 원산지 / 원재료 원산지 / 제조국 */}
      <Field label={copy.originLabel} required hint="상품정보제공고시">
        <input
          value={value.origin}
          onChange={(e) => set("origin", e.target.value)}
          placeholder={copy.originPh}
          className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
      </Field>

      {/* 공산품·잡화 전용 — 구성·규격 */}
      {value.type === "goods" && (
        <Field label="구성·규격" hint="선택">
          <input
            value={value.spec}
            onChange={(e) => set("spec", e.target.value)}
            placeholder="예: 캔들 2개 · 개당 120g · 박스 포장"
            className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
            style={{ boxShadow: "inset 0 0 0 1px transparent" }}
            onFocus={focusRing}
            onBlur={blurRing}
          />
        </Field>
      )}

      {/* 판매 단위 — 무게 단위는 신선식품 전용 */}
      <Field label="어떻게 판매하시겠어요?">
        <Segmented
          options={unitOptions}
          value={value.saleUnit}
          onSelect={(id) => set("saleUnit", id)}
          accent={accent}
        />

        {value.saleUnit === "box" && (
          <div className="mt-2 space-y-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput
              label="한 박스 개수"
              value={value.boxCount}
              onChange={(v) => set("boxCount", onlyDigits(v))}
              placeholder="한 박스 N개"
              suffix="개"
              accent={accent}
            />
            {!value.weightUnknown && (
              <SubInput
                label="총 무게(kg)"
                value={value.totalWeight}
                onChange={(v) => set("totalWeight", v.replace(/[^0-9.]/g, ""))}
                placeholder="총 무게 kg"
                suffix="kg"
                accent={accent}
              />
            )}
            <Checkbox
              checked={value.weightUnknown}
              onToggle={() => set("weightUnknown", !value.weightUnknown)}
              label="무게는 잘 몰라요"
              accent={accent}
            />
          </div>
        )}

        {value.saleUnit === "weight" && (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput
              label="총 무게(kg)"
              value={value.totalWeight}
              onChange={(v) => set("totalWeight", v.replace(/[^0-9.]/g, ""))}
              placeholder="총 무게 kg"
              suffix="kg"
              accent={accent}
            />
          </div>
        )}
        {/* F3-2a — 낱개 모드 1개 무게(g): 45 :1408-1420 동형 복원(시세 개당 환산 기준 — 선택 입력·
            폼 로컬 전용 = payload 무유출). 입력 시에만 앵커 축 발동(45 계약 동일). */}
        {value.type === "fresh" && value.saleUnit === "unit" && !value.weightUnknown && (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput
              label="1개 무게 약 (g)"
              value={singleWeightG}
              onChange={(v) => setSingleWeightG(onlyDigits(v))}
              placeholder="예: 300"
              suffix="g"
              accent={accent}
            />
          </div>
        )}
        {/* F3-2b(7) — 정합성 확인 배너: 45 :1453-1463 동형(차단 아닌 확인 — 구성 오입력 시 앵커 오표시 방지). */}
        {compositionSuspect && composition && (
          <div
            className="mt-2 rounded-lg bg-[#FFFBEB] px-3 py-2"
            style={{ boxShadow: "inset 0 0 0 1px #FDE68A" }}
          >
            <p className="text-[11px] font-medium leading-relaxed text-[#92400E]">
              입력값을 확인해 주세요: {composition.unitCount}개에 {composition.totalKg}kg이
              맞습니까?
            </p>
          </div>
        )}
      </Field>

      {/* F3-2b(5) — 품종 선택 칩: 품목 확정 시 사전 후보 + [직접 입력]. 탭 1번 = kind 파라미터 →
          품종 기준 시세(재탭 = 해제 → 혼합 밴드 복귀). 채택은 대표님 탭만(AI 경로 0). */}
      {value.type === "fresh" && value.kamisItemCode && (
        <div>
          <span className="mb-1 block text-[11px] font-semibold text-[#525252]">
            품종 <span className="font-medium text-[#A3A3A3]">(고르면 그 품종 기준으로 시세를 비교해요)</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {varietyChips.map((k) => {
              const on = selectedKind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setSelectedKind(on ? null : k);
                    setKindCustomOpen(false);
                  }}
                  aria-pressed={on}
                  className="min-h-[32px] rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors [word-break:keep-all]"
                  style={
                    on
                      ? { backgroundColor: accent, color: "#fff" }
                      : { backgroundColor: "#fff", color: "#404040", boxShadow: "inset 0 0 0 1px #E5E5E5" }
                  }
                >
                  {k}
                </button>
              );
            })}
            {/* 직접 입력 — 사전 밖 품종(서버는 제목 직접 포함으로 매칭). 선택분은 값 칩으로 표시. */}
            {selectedKind && !varietyChips.includes(selectedKind) && (
              <button
                type="button"
                onClick={() => setSelectedKind(null)}
                className="min-h-[32px] rounded-full px-2.5 py-1.5 text-[11px] font-semibold [word-break:keep-all]"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                {selectedKind} ×
              </button>
            )}
            <button
              type="button"
              onClick={() => setKindCustomOpen((v) => !v)}
              className="min-h-[32px] rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-[#525252] [word-break:keep-all]"
              style={{ backgroundColor: "#F4F4F5" }}
            >
              직접 입력
            </button>
          </div>
          {kindCustomOpen && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                value={kindCustomText}
                onChange={(e) => setKindCustomText(e.target.value)}
                placeholder="품종 이름 (예: 설향)"
                maxLength={20}
                className="w-full rounded-lg bg-white px-2.5 py-2 text-[12.5px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3]"
                style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = kindCustomText.trim();
                  if (!t) return;
                  setSelectedKind(t);
                  setKindCustomOpen(false);
                  setKindCustomText("");
                }}
                className="min-h-[36px] flex-none rounded-lg px-3 text-[12px] font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                적용
              </button>
            </div>
          )}
        </div>
      )}

      {/* UI-5-T4-D3c — 시세 참고(가격 입력 전 · 45 :1470-1501 형태 계승): fresh + 품목 확정 시에만.
          §0 — 파트너 화면 전용 참고(저장·손님 카드 반출 0 · 단정·권유 금지 — Advisor 내장 문구). */}
      {value.type === "fresh" && value.kamisItemCode && (priceBandLoading || priceBand) && (
        <div>
          <h3 className="text-[12.5px] font-bold text-[#0A0A0A]">시세는 이렇습니다. 참고하세요</h3>
          <PriceBandAdvisor
            priceBand={priceBand}
            loading={priceBandLoading}
            /* F3-2a — 45 :1478-1487 동형 composition 전달: totalKg 산출 → 4점 앵커·unit축 번역·
               인터넷 점·격차 문구 부활(Advisor :355 게이트 통과). 49 는 포장 종류 선택지 미보유 →
               box 라벨 = "박스" 고정("단위" 외 아무 값 = countMeaningful 성립 — Advisor :315). */
            composition={
              composition
                ? {
                    packType:
                      value.saleUnit === "box" ? "박스" : value.saleUnit === "unit" ? "낱개" : "단위",
                    unitCount: composition.unitCount,
                    totalKg: composition.totalKg,
                  }
                : null
            }
            myPriceKrw={Number(onlyDigits(value.price)) || null}
            onRefresh={() => setPriceBandRefresh((n) => n + 1)}
            /* F4b-C(7) — 품종 칩 대기 모드 재료: 어드바이저가 "칩 탭됨"을 알 유일한 경로(1줄 배선). */
            requestedKind={selectedKind}
            /* F3-2c-1 — 답부터 말하는 화면(49 opt-in): 구성 기준 헤드라인·내 가격 판정·표 접기·
               게이트 확대(표본<5 미표시)·대표값 중앙값. 45 는 미전달 = 기존 렌더 무변. */
            answerFirst
          />
        </div>
      )}

      {/* 가격 */}
      {/* T5-W5a++ — 판매 방식 입구(가격 직전 · 카드형 2택): 기본 = 단일 판매(gbEnabled undefined —
          현행 카드·재편집 하위호환 자동, gb 저장 카드 재편집 = 역파싱 gbEnabled true 로 자동 선택 복원).
          모일수록 부제 = W5a 정본 재사용. 단일 전환 = 3필드 undefined 초기화(기존 OFF 로직 재사용). */}
      <Field label="판매 방식">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={value.gbEnabled !== true}
            onClick={() => {
              setGbHint(null);
              onChange({ gbEnabled: undefined, gbTiers: undefined, gbFailMode: undefined });
            }}
            className="flex flex-col items-start rounded-xl border p-3 text-left transition-all active:scale-[0.98]"
            style={
              value.gbEnabled !== true
                ? { borderColor: accent, backgroundColor: "#EEF3FE", boxShadow: `inset 0 0 0 1px ${accent}` }
                : { borderColor: "#E8E8EC", backgroundColor: "#fff" }
            }
          >
            <span className="text-[13px] font-bold text-[#0A0A0A]">단일 판매</span>
            <span className="mt-0.5 text-[10.5px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
              정해진 가격 그대로
            </span>
          </button>
          <button
            type="button"
            aria-pressed={value.gbEnabled === true}
            onClick={() => set("gbEnabled", true)}
            className="flex flex-col items-start rounded-xl border p-3 text-left transition-all active:scale-[0.98]"
            style={
              value.gbEnabled === true
                ? { borderColor: accent, backgroundColor: "#EEF3FE", boxShadow: `inset 0 0 0 1px ${accent}` }
                : { borderColor: "#E8E8EC", backgroundColor: "#fff" }
            }
          >
            <span className="text-[13px] font-bold text-[#0A0A0A]">모일수록 할인</span>
            <span className="mt-0.5 text-[10.5px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
              여러 분이 모일수록 가격이 내려가는 판매 방식입니다
            </span>
          </button>
        </div>
      </Field>

      <Field label="가격" required>
        <div
          className="flex items-center rounded-xl bg-[#F4F4F5] px-3 focus-within:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
        >
          <span className="text-[14px] font-bold text-[#525252]">₩</span>
          <input
            value={value.price}
            onChange={(e) => set("price", onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="19900"
            className="w-full bg-transparent px-1.5 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>

        {/* F3-1b(2) — 이익 계산 카드는 공유 보상·예정 할인·수량 아래로 이동(읽기 순서: 비용 확정 → 최종 이익).
            카드 자체에 앵커/코치마커 참조 없음(grep 0) — 이동 회귀 0. */}
      </Field>

      {/* 판매 수량 — W5a++ 마개 2: 모일수록 선택 시 필수 승격(마커 동적 · 단일 판매 = 현행 그대로). */}
      <Field
        label="몇 개나 판매하시겠어요?"
        required={value.gbEnabled === true}
        hint={value.gbEnabled === true ? undefined : "선택 · 한정 수량"}
      >
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input
            value={value.quantity}
            onChange={(e) => set("quantity", onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="예: 30"
            className="w-full bg-transparent px-1 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">개</span>
        </div>
      </Field>


      {/* T5-W5a++F2 — gb 펼침(수량 직후 · 기간 배너 포함): 블록 이동만 — 내부 마크업·로직 무수정. */}
        {value.gbEnabled === true && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-1.5">
              {/* "제안" 라벨 명시 — 값 확정은 사장님 입력(NUMBER_CRITICAL · 산식 = 컴포넌트 상단 주석). */}
              <span className="inline-flex items-center rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                제안
              </span>
              <button
                type="button"
                onClick={() => {
                  // W5a++ F1 — 빈 결과 = set 생략(기존 행 보존 · 파괴적 교체 봉합) + 원인별 안내.
                  const rows = buildGbProposal();
                  if (rows.length === 0) {
                    setGbHint(Number(onlyDigits(value.price)) > 0 ? "qty" : "price");
                    return;
                  }
                  setGbHint(null);
                  set("gbTiers", rows);
                }}
                className="flex min-h-[36px] items-center rounded-lg bg-[#F4F4F5] px-3 text-[11.5px] font-bold text-[#525252] transition-colors active:bg-[#ECECEC]"
              >
                단계표 제안 받기
              </button>
            </div>
            {gbHint && (
              <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12px] font-semibold text-[#DC2626] [word-break:keep-all]">
                {gbHint === "price" ? "판매 가격을 먼저 입력해 주세요" : "판매 수량을 먼저 입력해 주세요"}
              </p>
            )}
            {gbRows.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-xl bg-[#F4F4F5] p-2 ${gbRowBad(i) ? "ring-1 ring-inset ring-[#DC2626]" : ""}`}
              >
                <input
                  value={r.qty > 0 ? String(r.qty) : ""}
                  inputMode="numeric"
                  onChange={(e) =>
                    set(
                      "gbTiers",
                      gbRows.map((x, j) => (j === i ? { ...x, qty: Number(onlyDigits(e.target.value)) || 0 } : x)),
                    )
                  }
                  className="h-10 w-0 min-w-0 flex-1 rounded-lg bg-white px-2 text-center text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none"
                  style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                />
                <span className="shrink-0 text-[11px] font-semibold text-[#8A8A8A]">개</span>
                <input
                  value={r.price > 0 ? String(r.price) : ""}
                  inputMode="numeric"
                  onChange={(e) =>
                    set(
                      "gbTiers",
                      gbRows.map((x, j) => (j === i ? { ...x, price: Number(onlyDigits(e.target.value)) || 0 } : x)),
                    )
                  }
                  className="h-10 w-0 min-w-0 flex-[1.6] rounded-lg bg-white px-2 text-center text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none"
                  style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                />
                <span className="shrink-0 text-[11px] font-semibold text-[#8A8A8A]">원</span>
                <button
                  type="button"
                  aria-label="행 삭제"
                  onClick={() => set("gbTiers", gbRows.filter((_, j) => j !== i))}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#8A8A8A] active:bg-[#ECECEC]"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
            ))}
            {gbRows.length < 6 && (
              <button
                type="button"
                aria-label="행 추가"
                onClick={addGbRow} /* W5b-F1 — 산식 자동 채움(빈 행 생성 경로 폐지). */
                disabled={gbAddBlocked}
                className="flex min-h-[36px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[#D4D4D4] text-[11.5px] font-bold text-[#8A8A8A] active:bg-[#F5F5F5] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />행 추가
              </button>
            )}
            {/* W5a++ 마개 3 — 취소 역전 고지(정본 확정). */}
            <p className="flex items-start gap-1 text-[10.5px] leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
              <Info className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2.25} />
              참여 취소가 나와도 이미 내려간 가격은 유지됩니다.
            </p>
            {/* 미달 처리(필수) — 고지 = W5a gbFail 정본 문안 그대로. */}
            <p className="flex items-start gap-1 text-[10.5px] leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
              <Info className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2.25} />
              목표 수량이 안 모이면 어떻게 할지 정해주세요. 카드에 그대로 안내됩니다.
            </p>
            <Segmented
              options={[
                { id: "base", label: "기본가로 정산" },
                { id: "cancel", label: "자동 취소" },
              ]}
              value={(value.gbFailMode ?? "") as "base" | "cancel"}
              onSelect={(id) => set("gbFailMode", id)}
              accent={accent}
            />
            {/* W5e — 통합 판매 일정 달력 = 공유 부품 소비(동작 무변 추출 — 지휘 독과 동일 컴포넌트).
                배너 처리 판단(W5b-F2-A) 유지: 콜백 부재 시 아래 기간 배너 폴백. */}
            {onSetSaleEnd && (
              <GbScheduleCalendar
                isFresh={value.type === "fresh"}
                productName={value.name}
                deadline={saleReady && saleEndIso ? saleEndIso : null}
                shipStart={value.harvestDate || null}
                shipEnd={value.harvestDateEnd || null}
                onSetDeadline={onSetSaleEnd}
                onSetShipRange={(start, end) => onChange({ harvestDate: start, harvestDateEnd: end })}
              />
            )}
            {/* 마개 2 — 기간 배너: 콜백 부재 폴백만(달력이 마감을 기록하므로 — 죽은 안내 금지). */}
            {!saleReady && !onSetSaleEnd && (
              <div className="space-y-1.5 rounded-xl bg-[#FEF2F2] px-3 py-2">
                <p className="text-[12px] font-semibold text-[#DC2626] [word-break:keep-all]">
                  판매 기간을 정해 주세요
                </p>
                {/* W5b-F1 — 이동 버튼(신규 문구 승인 1건 · 미지정 = 미노출 — 죽은 입구 금지). */}
                {onGoSalePeriod && (
                  <button
                    type="button"
                    onClick={onGoSalePeriod}
                    className="flex min-h-[36px] w-full items-center justify-center rounded-lg bg-white text-[12px] font-bold text-[#DC2626] [box-shadow:inset_0_0_0_1px_#FECACA] active:bg-[#FEF2F2]"
                  >
                    판매 기간 설정하기
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      {/* 배송 */}
      <Field label="배송">
        <Segmented
          options={[
            { id: "free", label: "무료배송(내 부담)" },
            { id: "paid", label: "배송비 별도(구매자 부담)" },
          ]}
          value={value.freeShip ? "free" : "paid"}
          onSelect={(id) => set("freeShip", id === "free")}
          accent={accent}
        />
        {/* UI-5-T4-D3d — 배송비 입력 = 양 분기 모두(구: 별도 부담만 노출 → 무료배송 시 입력 불가 결함).
            무료배송(내 부담) = 내가 낼 배송비 → 이익 계산 차감 / 별도(구매자 부담) = 마진 제외(45 규칙).
            저장 계약 무변: ship_fee_krw 는 별도 부담일 때만 payload 주입(E5b) — 무료배송 배송비 = 계산 보조 전용. */}
        <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <span className="shrink-0 text-[12px] font-semibold text-[#8A8A8A]">
            {value.freeShip ? "내가 낼 배송비" : "배송비"}
          </span>
          <input
            value={value.shipFee}
            onChange={(e) => set("shipFee", onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="예: 4000"
            className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        {value.freeShip && (
          <p className="mt-1 text-[10.5px] font-medium text-[#A3A3A3] [word-break:keep-all]">
            무료배송은 배송비를 내가 부담해요 — 아래 이익 계산에서 빠져요.
          </p>
        )}
      </Field>

      {/* 공유 보상 (Droppy) */}
      <Field label="공유 보상 (Droppy)">
        <Segmented
          options={[
            { id: "rate", label: "비율 %" },
            { id: "fixed", label: "고정 Droppy" },
          ]}
          value={value.droppyMode}
          onSelect={(id) => set("droppyMode", id as DroppyMode)}
          accent={accent}
        />

        {value.droppyMode === "rate" ? (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#525252]">공유 보상 비율</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[13px] font-extrabold tabular-nums"
                style={{ color: accent, backgroundColor: `${accent}14` }}
              >
                {value.droppyRate}%
              </span>
            </div>

            {/* 커스텀 게이지 바 */}
            <div className="relative mt-3 h-5">
              {/* 트랙 */}
              <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#E8E8EA]" />
              {/* 채워지는 부분 */}
              <div
                className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full transition-[width] duration-100"
                style={{ width: `${(value.droppyRate / 20) * 100}%`, backgroundColor: accent }}
              />
              {/* 썸 */}
              <div
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white transition-[left] duration-100"
                style={{ left: `${(value.droppyRate / 20) * 100}%`, borderColor: accent, boxShadow: `0 2px 6px -1px ${accent}66` }}
              />
              {/* 상호작용용 투명 range */}
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={value.droppyRate}
                onChange={(e) => set("droppyRate", Number(e.target.value))}
                aria-label="공유 보상 비율"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>

            <div className="mt-1.5 flex justify-between text-[10px] font-medium text-[#A3A3A3] tabular-nums">
              <span>0%</span>
              <span>20%</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
            <span className="text-[12px] font-semibold text-[#8A8A8A]">고정</span>
            <input
              value={value.droppyFixed}
              onChange={(e) => set("droppyFixed", onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="예: 500"
              className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
            <span className="text-[13px] font-semibold text-[#8A8A8A]">Droppy</span>
          </div>
        )}
        <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
          <Info className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2.25} />
          판매 성사 시 기여도에 따라 분배됩니다 · 공유만으로는 적립되지 않습니다
        </p>
      </Field>

      {/* 예정 할인 (시뮬레이션) */}
      <Field label="예정 할인" hint="시뮬레이션 · 저장하지 않아요">
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <span className="text-[12px] font-semibold text-[#8A8A8A]">할인</span>
          <input
            value={value.plannedDiscount}
            onChange={(e) => set("plannedDiscount", onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="예: 2000"
            className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        <p className="mt-1 text-[10.5px] text-[#A3A3A3]">
          {value.plannedDiscount && value.price
            ? `할인가 ${(Number(onlyDigits(value.price)) - Number(value.plannedDiscount)).toLocaleString()}원`
            : "판매가를 입력하면 계산해 드려요"}
        </p>
      </Field>

      {/* UI-5-T5-F3-1b — 이익 계산 완전판: 배송·공유 보상·예정 할인·수량 아래 배치(비용 확정 → 최종 이익
          읽기 순서 — 위 배치는 아래 값을 참조하는 역방향 시선이라 흑자 오표시 혼란의 근원). 원가 +
          포장비/기타 2칸(대표님 입력만·저장 안 함) + 드로피 할인(쿠폰 자동)·공유 보상·예정 할인 자동 행
          + 2단 표기(정가/할인 판매 시) + 적자 경고(확정 문구). 계산 = profitOf 단일 소스. */}
      <div className="rounded-xl bg-[#F7F7F8] p-2.5">
        <span className="flex items-center gap-1 text-[11px] font-bold text-[#525252]">
          <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
          이익 계산
          <span className="ml-1 font-medium text-[#A3A3A3]">선택 · 저장하지 않아요</span>
        </span>
        <div className="mt-1.5 space-y-1.5">
          <div className="flex items-center rounded-lg bg-white px-2.5">
            <span className="flex-none text-[11px] font-semibold text-[#8A8A8A]">원가</span>
            <input
              value={value.cost}
              onChange={(e) => set("cost", onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="예: 12000"
              className="w-full bg-transparent px-2 py-2 text-[12.5px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
            <span className="text-[12px] font-semibold text-[#8A8A8A]">원</span>
          </div>
          <div className="flex items-center rounded-lg bg-white px-2.5">
            <span className="flex-none text-[11px] font-semibold text-[#8A8A8A]">포장비</span>
            <input
              value={value.packCost}
              onChange={(e) => set("packCost", onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="박스·아이스팩 등"
              className="w-full bg-transparent px-2 py-2 text-[12.5px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
            <span className="text-[12px] font-semibold text-[#8A8A8A]">원</span>
          </div>
          <div className="flex items-center rounded-lg bg-white px-2.5">
            <span className="flex-none text-[11px] font-semibold text-[#8A8A8A]">기타비용</span>
            <input
              value={value.miscCost}
              onChange={(e) => set("miscCost", onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="수수료 등"
              className="w-full bg-transparent px-2 py-2 text-[12.5px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
            <span className="text-[12px] font-semibold text-[#8A8A8A]">원</span>
          </div>
        </div>
        {/* F3-1b(1) — 계산 내역: 판매가부터 이익까지 항목별 한 줄(0원 선택 항목 생략). 값은 전부
            profitOf 반환·표기 재료(bd*)만 — 표시부 재계산 금지. */}
        {profit !== null && (
          <div className="mt-1.5 space-y-0.5 rounded-lg bg-white px-2.5 py-2 text-[11px] font-medium tabular-nums text-[#525252]">
            <p className="flex justify-between">
              <span>판매가</span>
              <span>{bdPrice.toLocaleString()}원</span>
            </p>
            <p className="flex justify-between">
              <span>원가</span>
              <span>−{bdCost.toLocaleString()}원</span>
            </p>
            {bdShip > 0 && (
              <p className="flex justify-between">
                <span>배송비 (무료배송)</span>
                <span>−{bdShip.toLocaleString()}원</span>
              </p>
            )}
            {couponDiscountKrw > 0 && (
              <p className="flex justify-between">
                <span>드로피 할인 (쿠폰 연동)</span>
                <span>−{couponDiscountKrw.toLocaleString()}원</span>
              </p>
            )}
            {bdPack > 0 && (
              <p className="flex justify-between">
                <span>포장비</span>
                <span>−{bdPack.toLocaleString()}원</span>
              </p>
            )}
            {bdMisc > 0 && (
              <p className="flex justify-between">
                <span>기타비용</span>
                <span>−{bdMisc.toLocaleString()}원</span>
              </p>
            )}
            {profit.share > 0 && (
              <p className="flex justify-between">
                {/* 링고 판정(F3-1b) — 행 금액 = 정가 기준. 할인 시 실결제액 기준으로 달라지면
                    괄호에 병기(기준 차이 은폐 금지 — 금액 자체는 profitOf 반환만). */}
                <span>
                  공유 보상 ({value.droppyMode === "rate" ? `${value.droppyRate}%` : "고정"}
                  {profit.discounted != null && profit.shareDiscounted !== profit.share
                    ? ` · 할인가 기준 −${profit.shareDiscounted.toLocaleString()}원`
                    : ""})
                </span>
                <span>−{profit.share.toLocaleString()}원</span>
              </p>
            )}
            {profit.discount > 0 && (
              <p className="flex justify-between">
                <span>예정 할인</span>
                <span>−{profit.discount.toLocaleString()}원</span>
              </p>
            )}
            {/* F3-1b(1b) — 2단 표기: 할인은 예정·시뮬레이션이라 정가/할인 이익을 각 한 줄(할인 0 = 1줄). */}
            {profit.discounted != null ? (
              <>
                <p
                  className="flex justify-between border-t border-[#EFEFEF] pt-1 text-[11.5px] font-bold"
                  style={{ color: profit.regular > 0 ? accent : "#EF4444" }}
                >
                  <span>정가 판매 시 이익</span>
                  <span>{profit.regular.toLocaleString()}원</span>
                </p>
                <p
                  className="flex justify-between text-[11.5px] font-bold"
                  style={{ color: profit.discounted > 0 ? accent : "#EF4444" }}
                >
                  <span>할인 판매 시 이익</span>
                  <span>{profit.discounted.toLocaleString()}원</span>
                </p>
              </>
            ) : (
              <p
                className="flex justify-between border-t border-[#EFEFEF] pt-1 text-[11.5px] font-bold"
                style={{ color: profit.regular > 0 ? accent : "#EF4444" }}
              >
                <span>한 개 팔면 이익</span>
                <span>{profit.regular.toLocaleString()}원</span>
              </p>
            )}
            {/* W5a++ 마개 1 — 최저 단계 시나리오 병기: 계산 = 기존 profitOf 재사용(가격만 최저가 치환 —
                로직 무수정 · 공유 보상 반영 방식 자동 동일). 적자 = 기존 색 관례(#EF4444). */}
            {(() => {
              if (gbMinPrice == null) return null;
              const sc = profitOf({ ...value, price: String(gbMinPrice) }, couponDiscountKrw);
              if (sc === null) return null;
              return (
                <p
                  className="flex justify-between text-[11.5px] font-bold"
                  style={{ color: sc.regular > 0 ? accent : "#EF4444" }}
                >
                  <span>최저 단계(전원 {gbMinPrice.toLocaleString()}원 정산) 기준</span>
                  <span>{sc.regular.toLocaleString()}원</span>
                </p>
              );
            })()}
            {/* F3-1b(3) — 적자 경고: 최종 이익(할인 있으면 할인 이익) ≤ 0 — 적자 줄은 위 색으로 이미 지목. */}
            {(profit.discounted ?? profit.regular) <= 0 && (
              <p className="text-[11px] font-semibold text-[#EF4444] [word-break:keep-all]">
                이익이 없어요 — 가격을 확인해 주세요
              </p>
            )}
          </div>
        )}
      </div>

      {/* 홍보 문구 / 추가 정보 */}
      <Field label="홍보 문구" hint="선택">
        <textarea
          value={value.extraInfo}
          onChange={(e) => set("extraInfo", e.target.value)}
          rows={3}
          placeholder={copy.promoPh}
          className="w-full resize-none rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
        <p className="mt-1 text-[10.5px] text-[#A3A3A3]">{copy.promoNote}</p>

      </Field>

      {/* UI-5-T5-F3-3(1) — AI 카피 도우미: 대형 버튼 = onAiWrite 유일 입구(구 v0 목업 죽은 버튼 소생 ·
          headline 칸 옆 D3e 칩 제거 — 같은 기능 입구 2개 금지). 문구 = SAY-DO(하는 것만 약속 —
          셀링포인트는 자동 작성이 아니라 후보 제안이므로 여기서 약속하지 않는다). */}
      <div
        className="rounded-2xl p-3.5"
        style={{ backgroundColor: `${accent}0A`, boxShadow: `inset 0 0 0 1px ${accent}26` }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-[#0A0A0A]">AI 카피 도우미</p>
            <p className="text-[10.5px] font-medium text-[#8A8A8A]">홍보 한마디를 링고가 써 드려요</p>
          </div>
        </div>

        {onAiWrite && (
          <button
            type="button"
            onClick={onAiWrite}
            disabled={aiWriting}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold text-white shadow-sm transition-transform active:translate-y-px disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {aiWriting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
            )}
            {aiWriting ? "쓰는 중…" : "AI로 한마디 쓰기"}
          </button>
        )}

        {/* 헤드라인 — F3-3(1): 칸 옆 [✦ AI로 쓰기] 칩 제거(위 대형 버튼으로 입구 단일화). */}
        <div className="mt-3">
          <span className="mb-1 block text-[11px] font-semibold text-[#525252]">헤드라인</span>
          <input
            value={value.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="한 줄 홍보 문구"
            className="w-full rounded-xl bg-white px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
            onFocus={focusRing}
            onBlur={blurRing}
          />
        </div>

        {/* 셀링포인트 — F3-3(2): [✦ 후보 받기] = 링고 텍스트 제안(Edge 계약 무변 · persona "액션 금지" 준수).
            후보 칩 탭 = 대표님 채택(adoptPoint — 수동 입력과 동일 set 경로). 칩 스타일 = D3b 영상 포인트 픽 계승. */}
        <div className="mt-3">
          <span className="mb-1 flex items-center text-[11px] font-semibold text-[#525252]">
            셀링포인트
            {onAiSuggestPoints && (
              <button
                type="button"
                onClick={onAiSuggestPoints}
                disabled={aiPointsLoading}
                className="ml-auto inline-flex min-h-[28px] items-center gap-1 rounded-full border border-[#C7D7FB] bg-[#EEF3FE] px-2.5 text-[10.5px] font-bold text-[#1D4ED8] transition-transform active:scale-95 disabled:opacity-60"
              >
                {aiPointsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                ) : (
                  <span aria-hidden="true">✦</span>
                )}
                {aiPointsLoading ? "받는 중…" : "후보 받기"}
              </button>
            )}
          </span>
          {(aiPointCandidates?.length ?? 0) > 0 && (
            <div className="mb-1.5 rounded-xl bg-white px-2.5 py-2" style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}>
              <p className="text-[10.5px] font-medium text-[#8A8A8A] [word-break:keep-all]">
                링고가 제안한 후보예요 — 담을 것만 탭하세요
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {aiPointCandidates!.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => adoptPoint(p)}
                    className="rounded-full bg-[#EEF3FE] px-2.5 py-1.5 text-[11px] font-semibold text-[#1D4ED8] [word-break:keep-all] active:scale-95"
                    style={{ boxShadow: "inset 0 0 0 1px #C7D7FB" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {value.sellingPoints.map((pt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {i + 1}
                </span>
                <input
                  value={pt}
                  onChange={(e) => {
                    const next = [...value.sellingPoints];
                    next[i] = e.target.value;
                    set("sellingPoints", next);
                  }}
                  placeholder={copy.pointPh}
                  className="w-full rounded-lg bg-white px-2.5 py-2 text-[12.5px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3]"
                  style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                  onFocus={focusRing}
                  onBlur={blurRing}
                />
                {value.sellingPoints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => set("sellingPoints", value.sellingPoints.filter((_, idx) => idx !== i))}
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-[#8A8A8A] shadow-sm active:bg-[#F4F4F5]"
                    aria-label="셀링포인트 삭제"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => set("sellingPoints", [...value.sellingPoints, ""])}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-white py-2 text-[12px] font-semibold text-[#525252] shadow-sm active:bg-[#F4F4F5]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            셀링포인트 추가
          </button>
        </div>
      </div>

      {/* UI-5-T2-E5b — 상품 실등록 확정(45 관례: 폼 [등록] 탭 = 즉시 /api/drops 등록 · 재제출 = 새 등록).
          호출처 = 이 버튼 onClick 뿐(자동/링고/연출 트리거 0). 무언 실패 금지 — 오류 인라인 노출. */}
      {onRegister && (
        <div className="space-y-1.5">
          {registerError && (
            <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12px] font-semibold text-[#DC2626] [word-break:keep-all]">
              {registerError}
            </p>
          )}
          {/* W5b-F3-2 — 무언 차단 폐지: gbBlocked 시 원인별 배너(기확정 문구만 재사용 · 단계표 위반/미달
              미선택은 기존 빨간 링·required 마커가 유도 — 문구 생략 조항 적용, 신규 작문 0). */}
          {gbBlocked &&
            (() => {
              const msg = !(Number(onlyDigits(value.price)) > 0)
                ? "판매 가격을 먼저 입력해 주세요"
                : gbStockN <= 0
                  ? "판매 수량을 먼저 입력해 주세요"
                  : !saleReady
                    ? "판매 기간을 정해 주세요"
                    : null;
              return msg ? (
                <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12px] font-semibold text-[#DC2626] [word-break:keep-all]">
                  {msg}
                </p>
              ) : null;
            })()}
          {registeredName && !registerError && (
            <p className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: accent }}>
              <Check className="h-3 w-3" strokeWidth={2.75} />
              등록됨 · {registeredName} — 수정했다면 다시 등록해 주세요
            </p>
          )}
          <button
            type="button"
            onClick={onRegister}
            disabled={registerSaving || gbBlocked} /* T5-W5a+ — gb 유효성 위반/미완성 = 저장 차단. */
            className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {registerSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                등록하는 중…
              </>
            ) : registeredName ? (
              "다시 등록하기"
            ) : (
              "상품 등록하기"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- 작은 재사용 조각들 ---------- */

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[12px] font-bold text-[#0A0A0A]">{label}</span>
        {required && <span className="text-[11px] font-bold text-[#EF4444]">필수</span>}
        {hint && <span className="text-[10.5px] font-medium text-[#A3A3A3]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onSelect,
  accent,
}: {
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
  accent: string;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            className="flex-1 rounded-xl border px-2 py-2.5 text-[12px] font-bold transition-colors"
            style={
              on
                ? { backgroundColor: "#0A0A0A", borderColor: "#0A0A0A", color: "#fff" }
                : { backgroundColor: "#F4F4F5", borderColor: "transparent", color: "#525252" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SubInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
  accent: string;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold text-[#525252]">{label}</span>
      <div
        className="flex items-center rounded-lg bg-white px-2.5"
        style={{ boxShadow: "inset 0 0 0 1px transparent" }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          placeholder={placeholder}
          className="w-full bg-transparent px-1 py-2 text-[12.5px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          onFocus={(e) => (e.currentTarget.parentElement!.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
          onBlur={(e) => (e.currentTarget.parentElement!.style.boxShadow = "inset 0 0 0 1px transparent")}
        />
        <span className="text-[12px] font-semibold text-[#8A8A8A]">{suffix}</span>
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
  accent,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#525252]"
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors"
        style={
          checked
            ? { backgroundColor: accent, borderColor: accent, color: "#fff" }
            : { backgroundColor: "#fff", borderColor: "#D4D4D4" }
        }
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
