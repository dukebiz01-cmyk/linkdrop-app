import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { resizeToJpegBlob } from "@/lib/image-upload";
// FIX-36 — 이익 계산 정본(순수 함수) 재사용: 드로피 차감 = 이 폼의 dropy_rate/dropy_fixed 그대로,
//   기준액 = 상품 실결제액(판매가−할인, 배송비 제외). 임의 비율 창작 0(진실경계).
import {
  computeProfitReceipt,
  computeBreakEvenPrice,
} from "@/components/commerce/ProductRegisterForm";
// FIX-37 — 상품 상세정보 고시표(유형별) 행 빌더 — 순수 모듈 분리(라벨 = 실제 고시 항목 명칭).
import { buildNoticeRows45 } from "./product-notice45";
// FIX-45 — 시세 엔진 원형 복원: 구 폼 정본 PriceBandAdvisor 무수정 재사용(공용 presentational
//   — 구 폼(studio-build) 화면 무변경, import 만). 시세는 생산자 화면 전용(§0 — /d·미리보기 미노출).
import { PriceBandAdvisor, type PriceBandResult } from "@/components/commerce/PriceBandAdvisor";
// FIX-45 보완 b — 내 가격 위치 1줄(순수 모듈 · 정규화 실패 = 미렌더).
import { buildPricePositionLines } from "./price-position45";
// FIX-48+50 — 번호 인터뷰 좌표계(폼 필수 마커 번호 = 판매방식별 단일 정본).
import { getInterviewJourney, type SalesMethod } from "./interview-steps45";

/**
 * ProductRegisterForm45 — v0-45 정본 3유형(신선/가공/공산품) 상품 등록 폼 실배선 이식.
 * 정본: docs/ref/v0-45-product-register-form.tsx (777줄, controlled 프레젠테이션).
 *
 * 기존 src/components/commerce/ProductRegisterForm.tsx 는 무수정(구 스튜디오가 사용 중) —
 * CardStudioPage45 임베드만 이 폼으로 교체(FIX-13).
 *
 * 실배선(정본 mock → 실):
 *   · 사진: resizeToJpegBlob → product-images 버킷(RLS 첫 세그먼트=userId) → publicUrl.
 *   · KAMIS 품목(fresh): kamis_items 병합 목록 1회 로드 → 검색 후보 탭 = 정확 item_code 확정
 *     (기존 ProductRegisterForm CAT-2 경로와 동일 소스 — 시세는 §0 손님 노출 금지, 코드 연동만).
 *   · AI 카피: POST /api/generate-promo-copy (기존 경로 그대로).
 *   · 드로피: rate 0<r≤0.20(정본 슬라이더 30%→20% 상향 보정 — get_feed_dropy_reward 가드 동일)
 *     / fixed 0<f≤price. 위반 시 저장 차단 안내.
 *   · 저장: onSubmit(payload) — 기존 /api/drops self_upload 계약 필드 + blocks[0].block_data 에
 *     전체 키(기존 키 정합 + 45 신규 키: product_type/sale_unit/storage_method/expiry_date/
 *     ship_date/made_in/brand/spec/free_ship/ship_fee 등) 동봉. /api/drops 는 body.blocks 를
 *     패스스루(:190-192 실측)하므로 서버 무변경으로 저장된다. 렌더는 미주입=미렌더.
 */

export type ProductType45 = "fresh" | "processed" | "goods";
// FIX-15 — 타사 등록 체계 기준 판매단위 확장: 가공품 = 낱개·팩·병·봉지·캔·박스·포대·세트 /
//   공산품 = 낱개·세트·박스 / 신선 = 낱개·박스·무게(기존). sale_unit 키에 그대로 저장.
export type SaleUnit45 =
  | "unit"
  | "pack"
  | "bottle"
  | "bag"
  | "can"
  | "box"
  | "sack"
  | "set"
  | "weight";
export type StorageType45 = "room" | "cold" | "frozen";

export type ProductRegisterPayload45 = {
  self_upload: true;
  image_url: string;
  name: string;
  price_krw: number;
  headline: string;
  selling_points: string[];
  is_fresh: boolean;
  harvest_date: string | null;
  stock_limit: number | null;
  price_band_enabled: false;
  kamis_item_code?: string | null;
  blocks: Array<{ block_kind: "product"; position: 0; block_data: Record<string, unknown> }>;
};

export type ProductRegisterResult45 = { shareUuid: string; shareUrl: string };

// S4-5 — 배송방법 선택지 단일 소스(구 CardStudioPage45:356 COURIERS 이동 — 스튜디오는 재수입).
//   직접 전달 = 현장 수령 겸용(기존 상수 구성 그대로).
export const COURIERS45 = ["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배", "직접 전달"];

const TYPE_OPTIONS: { id: ProductType45; label: string }[] = [
  { id: "fresh", label: "신선식품" },
  { id: "processed", label: "가공식품" },
  { id: "goods", label: "공산품·잡화" },
];
// FIX-15 — 유형별 판매단위 세트.
const UNIT_LABELS: Record<SaleUnit45, string> = {
  unit: "낱개",
  pack: "팩",
  bottle: "병",
  bag: "봉지",
  can: "캔",
  box: "박스",
  sack: "포대",
  set: "세트",
  weight: "무게",
};
const UNIT_OPTIONS_BY_TYPE: Record<ProductType45, { id: SaleUnit45; label: string }[]> = {
  fresh: [
    { id: "unit", label: "낱개로" },
    { id: "box", label: "박스·묶음으로" },
    { id: "weight", label: "무게 단위로" },
  ],
  processed: [
    { id: "unit", label: "낱개" },
    { id: "pack", label: "팩" },
    { id: "bottle", label: "병" },
    { id: "bag", label: "봉지" },
    { id: "can", label: "캔" },
    { id: "box", label: "박스" },
    { id: "sack", label: "포대" },
    { id: "set", label: "세트" },
  ],
  goods: [
    { id: "unit", label: "낱개" },
    { id: "set", label: "세트" },
    { id: "box", label: "박스" },
  ],
};
// 묶음형 단위 — "1{단위} = N개 / N kg" 구성 입력 대상(신선 box 는 기존 boxCount UI 유지).
const BUNDLE_UNITS = new Set<SaleUnit45>(["pack", "box", "sack", "set"]);
// FIX-36 — fresh 포장 단위 프리셋(박스·묶음 판매 시). "기타"는 라벨·저장에서 "묶음"으로 표기.
const FRESH_PACK_TYPES = ["박스", "망", "봉", "포대", "기타"];
// FIX-15 b) — 공산품 카테고리 프리셋 1뎁스("기타" 선택 시 직접입력 노출).
const GOODS_CATEGORY_PRESETS = [
  "생활용품",
  "주방용품",
  "캠핑·레저",
  "굿즈·기념품",
  "패션잡화",
  "문구",
  "반려용품",
  "유아·완구",
  "디지털 소품",
  "기타",
];
const STORAGE_OPTIONS: { id: StorageType45; label: string }[] = [
  { id: "room", label: "실온" },
  { id: "cold", label: "냉장" },
  { id: "frozen", label: "냉동" },
];

// 유형별 라벨·플레이스홀더 — 정본 TYPE_COPY 그대로.
const TYPE_COPY: Record<
  ProductType45,
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

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");
// FIX-45c — 한글 받침 유무 → 조사(이나/나) 선택. 마지막 글자가 한글이 아니면 '나'.
const josaIna = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? "이나" : "나";
};
// FIX-45c — 판매 수량 라벨·단위 파생(A안 · 순수): 라벨·단위가 판매 구성을 따라감.
//   저장(stock_limit)은 구성 단위 개수 그대로(키·값 변환 금지) — 표기만 동기화.
//   weight="총 몇 kg" / fresh box=포장 단위(박스·망·봉·포대·묶음) / 낱개='개' / 그 외 UNIT_LABELS.
export function qtyUnitMeta45(
  type: ProductType45,
  saleUnit: SaleUnit45,
  freshPackLabel: string,
): { unit: string; label: string } {
  if (saleUnit === "weight") return { unit: "kg", label: "총 몇 kg 판매하시겠어요?" };
  const unit =
    saleUnit === "unit" ? "개" : type === "fresh" ? freshPackLabel : UNIT_LABELS[saleUnit];
  return { unit, label: `몇 ${unit}${josaIna(unit)} 판매하시겠어요?` };
}
// FIX-36 — 구 profitOf(판매가−원가만) 제거: 이익 계산은 computeProfitReceipt(정본) 단일 호출.
// KAMIS 검색 정규화 — 기존 CAT-2 규칙 동일(공백·괄호 제거 + 소문자).
function normalizeItemText(s: string): string {
  return s.toLowerCase().replace(/[\s()（）]/g, "");
}

type KamisItemFull = { item_code: string; item_name: string; category_code: string };

// FIX-34 — 폼 진행 신호(onBusyChange 와 같은 가벼운 콜백 방식): 링고 마이크로 안내용.
//   name 은 입력된 실값 그대로(진실 경계 — 창작 금지).
export type ProductFormProgress45 = {
  nameSet: boolean;
  priceSet: boolean;
  photoSet: boolean;
  name: string;
  // FIX-48+50 — 커머스 번호 인터뷰 신호(스텝퍼·번호 배지 done 매핑용). 미주입 = 미완.
  //   판정 로직 복제 아님 — 폼이 이미 계산한 파생값을 그대로 방출만.
  salesMethod?: "quick" | "full" | "groupBuy";
  originSet?: boolean;
  gbTargetSet?: boolean;
  gbPriceSet?: boolean;
  gbDeadlineSet?: boolean;
  /** S4-5 — 배송 스텝 신호(배송방법 선택 = done). */
  shipMethodSet?: boolean;
  /** S4-6 — 배송정보 셀 라이브 미리보기 재료(buildShippingView 입력 — 파생값 방출만, 판정 0). */
  shipMethod?: string;
  freeShip?: boolean;
  shipFeeKrw?: number | null;
  shipNote?: string;
  harvestDate?: string;
};

export function ProductRegisterForm45({
  accent,
  onSubmit,
  onImageChange,
  onBusyChange,
  onProgress,
  fieldPatch,
  onFieldPatchResult,
  contactPhone = null,
}: {
  accent: string;
  onSubmit: (payload: ProductRegisterPayload45) => Promise<ProductRegisterResult45>;
  /** 사진 업로드 즉시 미러(제출 전 미리보기·발행 가드 충족 — 기존 임베드 계약 동일). */
  onImageChange?: (url: string) => void;
  /** FIX-14 — 폼 내부 비동기(등록/사진/AI카피)를 호스트 스트립 busy 로 결합. null = 유휴. */
  onBusyChange?: (busy: string | null) => void;
  /** FIX-34 — 단계 내 세부 진행 신호(이름 확정·가격·사진) — 호스트 마이크로 안내 결합. */
  onProgress?: (p: ProductFormProgress45) => void;
  /** FIX-48+50 P2 — 링고 인터뷰 setField 부착 요청(확인 게이트 통과분). restore = undo 복원(검증 우회). */
  fieldPatch?: { seq: number; fields: { field: string; value: string }[]; restore?: boolean };
  /** 부착 결과 회신(성공 = ok+prev(undo용) / 검증 실패 = ok:false+reason(정직 안내)). restore 는 미회신. */
  onFieldPatchResult?: (r: {
    seq: number;
    results: { field: string; ok: boolean; prev: string; reason?: string }[];
  }) => void;
  /** FIX-37 — partners.contact_phone(읽기전용). 고시표 소비자상담 전화 자동 채움 — 쓰기 금지,
   *  수정은 매장정보 블록에서 유도. 미주입/null = "미등록" 정직 표기. */
  contactPhone?: string | null;
}) {
  // ── 폼 상태 (정본 ProductForm 동형) ──
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  // FIX-34 — 이름 확정 고리(blur 확정 → 체크 표시 + 진행 신호). 수정 시작 시 해제.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [type, setType] = useState<ProductType45>("fresh");
  const [harvestDate, setHarvestDate] = useState("");
  // FIX-24 — 수확·발송 예정일 기간화(순차배송): 종료일. fresh/goods 만 사용,
  //   시작일과 같으면 단일일 취급(_end 미저장). processed(소비기한)는 단일 유지.
  const [harvestDateEnd, setHarvestDateEnd] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [storage, setStorage] = useState<StorageType45>("room");
  const [brand, setBrand] = useState("");
  const [spec, setSpec] = useState("");
  const [saleUnit, setSaleUnit] = useState<SaleUnit45>("unit");
  // FIX-36 — fresh 박스·묶음 판매의 포장 단위(박스/망/봉/포대). 라벨·unit_label·pack_type 저장에 사용.
  const [freshPackType, setFreshPackType] = useState("박스");
  const [boxCount, setBoxCount] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [weightUnknown, setWeightUnknown] = useState(false);
  // FIX-45 — 낱개 모드 1개 무게(g): 구 폼 정본 유실분 복원(시세 개당 환산 기준).
  const [singleWeightG, setSingleWeightG] = useState("");
  // FIX-45 — 시세 조회 상태(구 폼 정본 이식: debounce 350ms + 수동 재조회 카운터).
  const [priceBand, setPriceBand] = useState<PriceBandResult | null>(null);
  const [priceBandLoading, setPriceBandLoading] = useState(false);
  const [priceBandRefresh, setPriceBandRefresh] = useState(0);
  // FIX-15 — 묶음형 구성: "1{단위} = N개"(unitQty) 또는 "1{단위} = N kg"(unitWeight).
  const [unitQty, setUnitQty] = useState("");
  const [unitWeight, setUnitWeight] = useState("");
  // FIX-15 b) — 공산품 카테고리 프리셋 선택값("기타"면 직접입력 itemCategory 사용).
  const [goodsPreset, setGoodsPreset] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  // FIX-36b — 기타잡비(포장·부자재·수수료 등): 사장님 직접 입력만(추정·자동 채움 금지 §0).
  //   표시용·미저장. 미입력 = 0 취급 + 영수증 행 미렌더.
  const [miscCost, setMiscCost] = useState("");
  // FIX-40 — 공동구매 v1(선택 · 발행 조건 아님): 목표 인원 + 달성 시 할인가.
  //   저장은 payload jsonb 키 2개만(group_buy_target_n/group_buy_price_krw) — 정산 무접촉.
  const [groupBuyOn, setGroupBuyOn] = useState(false);
  const [groupBuyN, setGroupBuyN] = useState("");
  const [groupBuyPrice, setGroupBuyPrice] = useState("");
  // FIX-36c — 공동구매 모집 마감일(자정 마감 기본 — 날짜만 저장, group_buy_deadline jsonb 1키).
  const [groupBuyDeadline, setGroupBuyDeadline] = useState("");
  // FIX-36c — 길잡이 b: 목표 이익 입력(선택 · 표시용 · 미저장).
  const [targetProfit, setTargetProfit] = useState("");
  const [freeShip, setFreeShip] = useState(true);
  const [shipFee, setShipFee] = useState("");
  // S4-5 — 배송 스텝: 배송방법(COURIERS45 · "" = 미선택 = 미저장)·안내문구(선택 입력).
  const [shipMethod, setShipMethod] = useState("");
  const [shipNote, setShipNote] = useState("");
  const [droppyMode, setDroppyMode] = useState<"rate" | "fixed">("rate");
  const [droppyRate, setDroppyRate] = useState(0);
  const [droppyFixed, setDroppyFixed] = useState("");
  const [plannedDiscount, setPlannedDiscount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [headline, setHeadline] = useState("");
  const [sellingPoints, setSellingPoints] = useState<string[]>([""]);
  const [extraInfo, setExtraInfo] = useState("");
  // FIX-38 — 원포토(빠른 등록) 모드: 사진 1장 → 이름 확인 → AI 카피 제안 → 가격·발송일·원산지.
  //   기존 자세히 등록의 대체가 아닌 공존 경로(토글). 같은 state·handleSubmit·payload 계약을
  //   그대로 쓰므로 FIX-36/37 필드·FIX-42 게이트 판정 전부 동일 경유(우회 0).
  //   READ 판정: 사진→이름·분류 탐지 Edge 는 부재(detect-product 는 영상 텍스트 전용) → 그
  //   부분은 "준비 중" 정직 표기. AI 카피는 실존 generate-promo-copy(image_url 비전) 재사용.
  const [quickMode, setQuickMode] = useState(false);
  // FIX-48+50 P1.5 커밋3 — 비필수 비용·보상 필드 "(+) 더 입력" 접힘 그룹(시각 그룹핑만 · 로직 무변경).
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);
  // FIX-37 — 상품 상세정보 고시(상품정보제공고시) 직접 입력분. 폼 기존 입력(상품명·원산지·
  //   분류·소비기한·보관방법·브랜드)은 자동 미러라 여기 중복 입력 없음. 미입력 = "" 스냅샷.
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeProducer, setNoticeProducer] = useState(""); // 생산자(수입자)·소재지
  const [noticeMadeDate, setNoticeMadeDate] = useState(""); // fresh — 제조연월일(포장일·생산연도)
  const [noticeHandling, setNoticeHandling] = useState(""); // fresh — 보관방법 또는 취급방법
  const [noticeIngredients, setNoticeIngredients] = useState(""); // processed — 원재료명 및 함량
  const [noticeModel, setNoticeModel] = useState(""); // goods — 모델명
  const [noticeAsManager, setNoticeAsManager] = useState(""); // goods — A/S 책임자

  // ── 실배선 상태 ──
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedUuid, setSavedUuid] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // KAMIS(fresh) — 병합 품목 목록 1회 로드 + 검색 후보.
  const [kamisAll, setKamisAll] = useState<KamisItemFull[]>([]);
  const [kamisItemCode, setKamisItemCode] = useState<string | null>(null);
  const [kamisOpen, setKamisOpen] = useState(false);

  useEffect(() => {
    if (type !== "fresh" || kamisAll.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSupabase()
          .from("kamis_items" as never)
          .select("item_code, item_name, category_code")
          .order("sort_order");
        if (!cancelled) setKamisAll((data as unknown as KamisItemFull[] | null) ?? []);
      } catch {
        // graceful — 품목 연동은 선택 사항.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, kamisAll.length]);

  const copy = TYPE_COPY[type];
  const unitOptions = UNIT_OPTIONS_BY_TYPE[type];
  const priceNum = Number(onlyDigits(price)) || 0;
  // FIX-36 — 이익 영수증(표시용·미저장): 정본 computeProfitReceipt 단일 호출(재발명 0).
  //   판매가·원가 둘 다 입력됐을 때만 계산(미완 입력 = 미렌더 — 0·추정치 창작 금지).
  //   배송비: 무료배송(내 부담)만 비용 차감 / 구매자 부담은 제외(병기만) — 정본 규칙 그대로.
  const costNum = cost !== "" ? Number(cost) : null;
  const shipFeeNum = shipFee !== "" ? Math.floor(Number(shipFee)) : null;
  const discountNum = plannedDiscount !== "" ? Number(plannedDiscount) : 0;
  // FIX-36c — 공동구매 시 예정 할인 숨김(달성가가 곧 할인) → 할인 차감도 0(잔존값 무시).
  //   일반 모드는 기존과 동일(36b 패리티 유지).
  const effDiscount = groupBuyOn ? 0 : discountNum;
  // FIX-36b — 기타잡비: 입력분만(미입력 = 0 · 행 미렌더).
  const miscNum = miscCost !== "" ? Math.floor(Number(miscCost)) : null;
  // 고정 Droppy — 제출 가드 동일(0<f≤price 통과분만 차감 반영, 무효 = 0 취급).
  const droppyFixedNum =
    droppyMode === "fixed" &&
    droppyFixed &&
    Number(droppyFixed) > 0 &&
    Number(droppyFixed) <= priceNum
      ? Math.floor(Number(droppyFixed))
      : null;
  // FIX-36 — fresh 포장 단위 표시 라벨("기타"는 "묶음"). UI·제출 스냅샷 공용.
  const freshPackLabel = freshPackType === "기타" ? "묶음" : freshPackType;

  // FIX-45 — 판매 구성 통역(구 폼 정본 계산 그대로): 모드 → 유효 구성(입수·총중량 kg).
  //   box=개수×총kg / unit=1개×g / weight=1단위×kg. 무게 미상이면 구성 없음(kg 비교 생략).
  const composition = (() => {
    if (type !== "fresh" || weightUnknown) return null;
    if (saleUnit === "box") {
      const n = Math.floor(Number(boxCount));
      const kg = Number(totalWeight);
      return Number.isFinite(n) && n >= 1 && Number.isFinite(kg) && kg > 0
        ? { unitCount: n, totalKg: kg }
        : null;
    }
    if (saleUnit === "unit") {
      const g = Number(singleWeightG);
      return Number.isFinite(g) && g > 0 ? { unitCount: 1, totalKg: g / 1000 } : null;
    }
    const kg = Number(totalWeight);
    return Number.isFinite(kg) && kg > 0 ? { unitCount: 1, totalKg: kg } : null;
  })();
  // 개당 중량(g) — 총중량÷입수(구 폼 P5a 공식 그대로). get-price-band per_unit_weight_g 전달.
  const perUnitWeightG = composition
    ? Math.round((composition.totalKg * 1000) / composition.unitCount)
    : null;
  // 정합성 가드 — 개당 10g 미만 / 5kg 초과면 확인 배너(차단 아닌 확인 — 구 폼 동일).
  const compositionSuspect =
    perUnitWeightG != null && (perUnitWeightG < 10 || perUnitWeightG > 5000);
  const unitCountForQuery = composition != null ? composition.unitCount : null;
  // 선언문 — 구 폼 문구 그대로(괄호 축약 노출 금지).
  const compositionLabel = composition
    ? saleUnit === "box"
      ? `${composition.unitCount}개들이 한 ${freshPackLabel}(${composition.totalKg}kg)`
      : saleUnit === "unit"
        ? `낱개 1개`
        : `${composition.totalKg}kg 단위`
    : null;
  const declarationLine =
    composition && perUnitWeightG != null
      ? saleUnit === "box"
        ? `${composition.unitCount}개들이 한 ${freshPackLabel}(${composition.totalKg}kg) · 개당 약 ${perUnitWeightG.toLocaleString("ko-KR")}g — 이 기준으로 시세를 비교해요`
        : saleUnit === "unit"
          ? `낱개 1개 · 약 ${perUnitWeightG.toLocaleString("ko-KR")}g — 이 기준으로 시세를 비교해요`
          : `${composition.totalKg}kg 단위 판매 — 이 기준으로 시세를 비교해요`
      : null;
  // FIX-45 — 확정 품목의 부류 코드(get-price-band 필수 파라미터) — 병합 목록에서 역참조.
  const kamisCategoryCode = kamisItemCode
    ? (kamisAll.find((it) => it.item_code === kamisItemCode)?.category_code ?? null)
    : null;
  // FIX-45 보완 b — 내 가격 위치 1줄(순수 모듈 · 정규화 실패 = 미렌더 · 사실만).
  const pricePositionLines = buildPricePositionLines({
    myPriceKrw: priceNum > 0 ? priceNum : null,
    totalKg: composition?.totalKg ?? null,
    unitCount: composition?.unitCount ?? null,
    // '개' 의미 — 무게 단위 판매는 제외(구 폼 countMeaningful 동일).
    countMeaningful: composition != null && saleUnit !== "weight",
    wholesaleAvgKg: priceBand?.wholesale?.avg ?? null,
    onlineUnitAvg:
      priceBand?.online_axes?.unit && priceBand.online_axes.unit.n > 0
        ? priceBand.online_axes.unit.avg
        : null,
    onlineKgAvg:
      priceBand?.online_axes?.kg && priceBand.online_axes.kg.n > 0
        ? priceBand.online_axes.kg.avg
        : priceBand?.online?.status === "ok"
          ? (priceBand.online.avg ?? null)
          : null,
  });

  // FIX-45 — 시세 조회(구 폼 정본 effect 이식): 확정 품목 코드로만 발화(fuzzy 금지 락),
  //   구성 타이핑 연타 방지 debounce 350ms, 수동 재조회 dep. detach 주의 — invoke 메서드 직접 호출.
  useEffect(() => {
    if (type !== "fresh" || !kamisItemCode || !kamisCategoryCode) {
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
          item_code: kamisItemCode,
          item_name: null,
          sources: [],
          cached: false,
        };
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase.functions.invoke("get-price-band", {
            body: {
              item_code: kamisItemCode,
              category_code: kamisCategoryCode,
              ...(perUnitWeightG != null && unitCountForQuery != null
                ? { per_unit_weight_g: perUnitWeightG, unit_count: unitCountForQuery }
                : {}),
            },
          });
          if (cancelled) return;
          setPriceBand(error || !data ? fail : (data as PriceBandResult));
        } catch {
          if (!cancelled) setPriceBand(fail);
        } finally {
          if (!cancelled) setPriceBandLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, kamisItemCode, kamisCategoryCode, perUnitWeightG, unitCountForQuery, priceBandRefresh]);
  const receipt =
    priceNum > 0 && costNum != null
      ? computeProfitReceipt({
          priceKrw: priceNum,
          discountKrw: effDiscount,
          costKrw: costNum,
          shippingMode: freeShip ? "free" : "paid",
          shippingFeeKrw: shipFeeNum ?? 0,
          dropyMode: droppyMode,
          dropyPercent: droppyRate,
          dropyFixedKrw: droppyFixedNum,
          miscCostKrw: miscNum,
        })
      : null;
  // FIX-40 — 공동구매 파생: 유효(N≥2 · 0<달성가<기본가) 통과분만. 영수증 2줄 병기용.
  const gbTargetN = groupBuyOn && groupBuyN !== "" ? Math.floor(Number(groupBuyN)) : null;
  const gbPriceNum = groupBuyOn && groupBuyPrice !== "" ? Math.floor(Number(groupBuyPrice)) : null;
  const gbValid =
    gbTargetN != null &&
    gbTargetN >= 2 &&
    gbPriceNum != null &&
    gbPriceNum > 0 &&
    priceNum > 0 &&
    gbPriceNum < priceNum;
  // 달성가 기준 이익 — 같은 정본 함수, priceKrw 만 달성가로(달성 시 이익도 정직 표시).
  const gbReceipt =
    gbValid && costNum != null
      ? computeProfitReceipt({
          priceKrw: gbPriceNum,
          discountKrw: effDiscount,
          costKrw: costNum,
          shippingMode: freeShip ? "free" : "paid",
          shippingFeeKrw: shipFeeNum ?? 0,
          dropyMode: droppyMode,
          dropyPercent: droppyRate,
          dropyFixedKrw: droppyFixedNum,
          miscCostKrw: miscNum,
        })
      : null;
  // FIX-36c — 길잡이 역산(정본 computeBreakEvenPrice · 사장님 입력값만): a 손익분기 / b 목표 이익.
  //   비용(원가) 입력 완료 시에만(추정 0 — 영수증 렌더 게이트와 동일).
  const breakEvenBase = {
    discountKrw: effDiscount,
    costKrw: costNum,
    shippingMode: (freeShip ? "free" : "paid") as "free" | "paid",
    shippingFeeKrw: shipFeeNum ?? 0,
    dropyMode: droppyMode,
    dropyPercent: droppyRate,
    dropyFixedKrw: droppyFixedNum,
    miscCostKrw: miscNum,
  };
  const breakEvenPrice = costNum != null ? computeBreakEvenPrice(breakEvenBase) : null;
  const targetProfitNum = targetProfit !== "" ? Math.floor(Number(targetProfit)) : null;
  const targetPrice =
    costNum != null && targetProfitNum != null && targetProfitNum > 0
      ? computeBreakEvenPrice({ ...breakEvenBase, targetProfitKrw: targetProfitNum })
      : null;

  // FIX-34 — 진행 신호 방출(변경 필드는 override 로 전달 — setState 직후 stale 값 방지).
  const emitProgress = (over: Partial<ProductFormProgress45> = {}) =>
    onProgress?.({
      nameSet: nameConfirmed && !!name.trim(),
      priceSet: priceNum > 0,
      photoSet: !!imageUrl,
      name: name.trim(),
      // FIX-48+50 — 번호 인터뷰 신호(파생값 재사용 · 신규 판정 0): 방식·원산지·공동구매 유효성.
      salesMethod: quickMode ? "quick" : groupBuyOn ? "groupBuy" : "full",
      originSet: !!origin.trim(),
      gbTargetSet: gbTargetN != null && gbTargetN >= 2,
      gbPriceSet: gbPriceNum != null && gbPriceNum > 0 && priceNum > 0 && gbPriceNum < priceNum,
      gbDeadlineSet: !!groupBuyDeadline.trim(),
      // S4-5 — 배송 스텝 신호(배송방법 선택 = done).
      shipMethodSet: !!shipMethod,
      // S4-6 — 배송정보 셀 라이브 재료(구매자 부담 배송비만 — ship_fee_krw 저장 규칙 동일).
      shipMethod,
      freeShip,
      shipFeeKrw: !freeShip && shipFee ? Math.floor(Number(shipFee)) : null,
      shipNote,
      harvestDate,
      ...over,
    });
  // 마운트 시 1회 동기화 — 폼 재마운트(패널 접힘/재장착) 후 호스트의 낡은 진행 상태 초기화.
  useEffect(() => {
    emitProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // FIX-48+50 — 번호 인터뷰 신호(방식·원산지·공동구매·사진·이름·가격) 변경 시 진행신호 재방출.
  //   스텝퍼가 필드 입력을 라이브로 따라오게 함. handleFormProgress 등가 가드로 루프 없음.
  useEffect(() => {
    emitProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMode, groupBuyOn, origin, groupBuyN, groupBuyPrice, groupBuyDeadline, price, imageUrl, name, nameConfirmed, shipMethod, freeShip, shipFee, shipNote, harvestDate]);

  // FIX-48+50 P2 — 링고 인터뷰 setField 부착: 스튜디오 fieldPatch 수신 → 필드별 검증·부착·prev 회신.
  //   검증 = 폼 handleSubmit 규칙 준용(가격>0 / 목표인원 N≥2 / 달성가 0<x<기본가). restore(undo)는
  //   검증 우회·prev 그대로·미회신. 안전장치 무접촉: 부착은 상태 세팅만(발행·사진·결제·삭제 불가).
  const patchSeqRef = useRef(0);
  useEffect(() => {
    if (!fieldPatch || fieldPatch.seq === patchSeqRef.current) return;
    patchSeqRef.current = fieldPatch.seq;
    if (fieldPatch.restore) {
      // undo 복원 — prev 그대로 세팅(검증 우회, 회신 없음).
      for (const { field, value } of fieldPatch.fields) {
        if (field === "productName") {
          setName(value);
          setNameConfirmed(!!value.trim());
        } else if (field === "productPrice") setPrice(value);
        else if (field === "origin") setOrigin(value);
        else if (field === "stockQty") setQuantity(value);
        else if (field === "gbTargetCount") setGroupBuyN(value);
        else if (field === "gbTargetPrice") setGroupBuyPrice(value);
        else if (field === "salesMethod") {
          // LINGO-DRIVE-1 D-3 — 방식 복원(수동 세그먼트 onSelect 정본 미러 — 아래 케이스와 동일).
          const q = value === "quick";
          setQuickMode(q);
          if (q && type !== "fresh") selectType("fresh");
          setGroupBuyOn(value === "groupBuy");
        }
      }
      return;
    }
    const results = fieldPatch.fields.map(({ field, value }) => {
      const v = (value ?? "").trim();
      switch (field) {
        case "productName": {
          const prev = name;
          if (!v) return { field, ok: false, prev, reason: "상품명을 알려주세요." };
          setName(v);
          setNameConfirmed(true);
          return { field, ok: true, prev };
        }
        case "productPrice": {
          const prev = price;
          const d = onlyDigits(v);
          if (!d || Number(d) <= 0) return { field, ok: false, prev, reason: "가격은 0보다 커야 해요." };
          setPrice(d);
          return { field, ok: true, prev };
        }
        case "origin": {
          const prev = origin;
          if (!v) return { field, ok: false, prev, reason: `${copy.originLabel}을(를) 알려주세요.` };
          setOrigin(v);
          return { field, ok: true, prev };
        }
        case "stockQty": {
          const prev = quantity;
          const d = onlyDigits(v);
          if (!d || Number(d) < 1) return { field, ok: false, prev, reason: "수량은 1개 이상이어야 해요." };
          setQuantity(d);
          return { field, ok: true, prev };
        }
        case "gbTargetCount": {
          const prev = groupBuyN;
          const d = onlyDigits(v);
          if (!d || Number(d) < 2)
            return { field, ok: false, prev, reason: "공동구매 목표 인원은 2명 이상이어야 해요." };
          setGroupBuyOn(true);
          setGroupBuyN(d);
          return { field, ok: true, prev };
        }
        case "gbTargetPrice": {
          const prev = groupBuyPrice;
          const d = onlyDigits(v);
          const n = Number(d);
          if (!d || n <= 0) return { field, ok: false, prev, reason: "달성 할인가는 0보다 커야 해요." };
          if (priceNum > 0 && n >= priceNum)
            return { field, ok: false, prev, reason: "달성 할인가는 기본 판매가보다 낮아야 해요." };
          setGroupBuyOn(true);
          setGroupBuyPrice(d);
          return { field, ok: true, prev };
        }
        case "salesMethod": {
          // LINGO-DRIVE-1 D-3 — 판매방식 전환: 수동 세그먼트 onSelect 정본 미러
          //   (등록 방법 세그먼트의 setQuickMode+selectType / 판매 방식 세그먼트의 setGroupBuyOn
          //   — 신규 쓰기 경로 0). 링고 0단계 확장(빠른/일반/공동구매)이 이 브리지로 반영.
          const prev = quickMode ? "quick" : groupBuyOn ? "groupBuy" : "full";
          if (v !== "quick" && v !== "full" && v !== "groupBuy") {
            return { field, ok: false, prev, reason: "판매 방식을 알 수 없어요." };
          }
          const q = v === "quick";
          setQuickMode(q);
          if (q && type !== "fresh") selectType("fresh");
          setGroupBuyOn(v === "groupBuy");
          return { field, ok: true, prev };
        }
        default:
          return { field, ok: false, prev: "", reason: "지원하지 않는 항목이에요." };
      }
    });
    onFieldPatchResult?.({ seq: fieldPatch.seq, results });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldPatch]);
  const isBundle = type !== "fresh" && BUNDLE_UNITS.has(saleUnit);

  // FIX-45c — 판매 수량 라벨·단위(판매 구성 동기화) + 환산 확인 1줄.
  //   환산 = 사장님 선언값 곱셈만(수량 × 선언 단위 무게) — 선언 무게 없으면 미렌더(추정 금지).
  //   weight 모드는 입력 자체가 kg — 환산 불필요(미렌더).
  const qtyMeta = qtyUnitMeta45(type, saleUnit, freshPackLabel);
  const qtyNum = quantity && Number(quantity) >= 1 ? Math.floor(Number(quantity)) : null;
  const qtyPerUnitKg =
    type === "fresh"
      ? weightUnknown || saleUnit === "weight"
        ? null
        : saleUnit === "box"
          ? totalWeight && Number(totalWeight) > 0
            ? Number(totalWeight)
            : null
          : singleWeightG && Number(singleWeightG) > 0
            ? Number(singleWeightG) / 1000
            : null
      : isBundle && unitWeight && Number(unitWeight) > 0
        ? Number(unitWeight)
        : null;
  const qtyConversionLine =
    qtyNum != null && qtyPerUnitKg != null
      ? `총 ${qtyNum.toLocaleString("ko-KR")}${qtyMeta.unit} = ${(
          Math.round(qtyNum * qtyPerUnitKg * 1000) / 1000
        ).toLocaleString("ko-KR")}kg 판매`
      : null;

  // FIX-15 c) — 유형 전환 시 해당 없는 단위·구성값 초기화(잔존 오염 방지).
  const selectType = (t: ProductType45) => {
    setType(t);
    setSaleUnit("unit");
    setFreshPackType("박스"); // FIX-36 — 포장 단위도 초기화(잔존 오염 방지 동일 규칙).
    setBoxCount("");
    setTotalWeight("");
    setWeightUnknown(false);
    setSingleWeightG(""); // FIX-45 — 낱개 무게도 초기화(동일 규칙).
    setUnitQty("");
    setUnitWeight("");
    setGoodsPreset(null);
    if (t !== "fresh") setKamisItemCode(null);
    if (t === "processed") setHarvestDateEnd(""); // FIX-24 — 소비기한은 단일(범위 잔존 방지).
  };

  // KAMIS 후보 — 입력 부분일치 상위 6(확정은 탭만 — 정확 item_code).
  const kamisMatches =
    type === "fresh" && kamisOpen && itemCategory.trim()
      ? kamisAll
          .filter((it) => normalizeItemText(it.item_name).includes(normalizeItemText(itemCategory)))
          .slice(0, 6)
      : [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setUploading(true);
    onBusyChange?.("상품 사진을 올리는 중…"); // FIX-14 — 호스트 스트립 busy 결합.
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        toast.error("로그인이 필요해요.");
        setImagePreview(null);
        return;
      }
      const blob = await resizeToJpegBlob(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) {
        toast.error("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setImagePreview(null);
        return;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      setImagePreview(pub.publicUrl);
      onImageChange?.(pub.publicUrl);
      emitProgress({ photoSet: true }); // FIX-34 — 사진 진행 신호.
      toast.success("사진을 업로드했어요.");
    } catch (err) {
      console.error("[ProductRegisterForm45] upload:", err);
      toast.error("사진 처리 중 문제가 생겼어요.");
      setImagePreview(null);
    } finally {
      setUploading(false);
      onBusyChange?.(null);
      URL.revokeObjectURL(localUrl);
    }
  }

  // AI 카피 — 기존 /api/generate-promo-copy 경로 그대로(ProductCopyEditor :51 동형).
  async function generateCopy() {
    if (aiLoading) return;
    if (!name.trim() || priceNum <= 0) {
      toast.info("상품명과 가격을 먼저 입력해 주세요.");
      return;
    }
    setAiLoading(true);
    onBusyChange?.("AI가 카피를 쓰는 중…"); // FIX-14 — 호스트 스트립 busy 결합.
    try {
      const res = await fetch("/api/generate-promo-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: name.trim(),
          price_krw: priceNum,
          notes: extraInfo.trim(),
          image_url: imageUrl,
          category: itemCategory.trim() || null,
        }),
      });
      const json = (await res.json()) as { headline?: string; selling_points?: string[]; message?: string };
      if (!res.ok) {
        toast.error(json.message ?? "카피 생성에 실패했어요. 직접 입력해 주세요.");
        return;
      }
      if (typeof json.headline === "string") setHeadline(json.headline);
      if (Array.isArray(json.selling_points) && json.selling_points.length > 0) {
        setSellingPoints(json.selling_points.slice(0, 5));
      }
    } catch {
      toast.error("카피 생성 중 연결이 끊겼어요. 직접 입력해 주세요.");
    } finally {
      setAiLoading(false);
      onBusyChange?.(null);
    }
  }

  async function handleSubmit() {
    if (saving) return;
    setFormError(null);
    // 필수 가드 — 사진·이름·가격·원산지(정본 required + 상품정보제공고시).
    if (!imageUrl) return setFormError("상품 사진을 올려주세요.");
    if (!name.trim()) return setFormError("상품명을 입력해주세요.");
    // FIX-38 — 원포토(빠른 등록): 이름 확인(확정) 없이는 등록 진행 불가(§0 — 미확정 이름 저장 금지).
    if (quickMode && !nameConfirmed) {
      return setFormError(
        "이름 확인이 필요해요 — 상품명을 적고 칸 밖을 눌러 체크로 확정해 주세요.",
      );
    }
    if (priceNum <= 0) return setFormError("가격을 입력해주세요.");
    if (!origin.trim()) return setFormError(`${copy.originLabel}을(를) 입력해주세요.`);
    // FIX-40 — 공동구매 유효성: 목표 N ≥ 2 · 0 < 달성가 < 기본 판매가(아니면 저장 차단 + 사유).
    if (groupBuyOn) {
      if (gbTargetN == null || gbTargetN < 2) {
        return setFormError("공동구매 목표 인원은 2명 이상이어야 해요.");
      }
      if (gbPriceNum == null || gbPriceNum <= 0 || gbPriceNum >= priceNum) {
        return setFormError("공동구매 달성 할인가는 기본 판매가보다 낮아야 해요.");
      }
      // FIX-36c — 모집 마감 ≤ 판매기간 마감. 폼이 아는 기간 = 수확·발송(FIX-24) 종료일
      //   (판매기간 캘린더는 호스트 seasonal 블록 — 폼 밖). 날짜 미입력이면 비교 대상 없음 = 통과.
      const saleEnd = (harvestDateEnd || harvestDate).trim();
      if (groupBuyDeadline && saleEnd && groupBuyDeadline > saleEnd) {
        return setFormError("공동구매 모집 마감일은 수확·발송 마감일보다 늦을 수 없어요.");
      }
    }
    // 드로피 검증 — get_feed_dropy_reward 가드 동일: rate 0<r≤0.20 / fixed 0<f≤price.
    const rate = droppyMode === "rate" && droppyRate > 0 ? droppyRate / 100 : null;
    if (rate != null && (rate <= 0 || rate > 0.2)) return setFormError("공유 보상 비율은 20%까지예요.");
    const fixed = droppyMode === "fixed" && droppyFixed ? Math.floor(Number(droppyFixed)) : null;
    if (fixed != null && (fixed <= 0 || fixed > priceNum)) {
      return setFormError("고정 Droppy는 1 이상, 판매가 이하로 입력해 주세요.");
    }

    const points = sellingPoints.map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const qty = quantity && Number(quantity) >= 1 ? Math.floor(Number(quantity)) : null;
    const isFresh = type === "fresh";
    // FIX-15 — 카테고리: 공산품은 프리셋(기타 = 직접입력) / 그 외 기존 itemCategory.
    const categoryVal =
      type === "goods"
        ? goodsPreset && goodsPreset !== "기타"
          ? goodsPreset
          : itemCategory.trim()
        : itemCategory.trim();
    // FIX-15 — 묶음형 구성 라벨("1박스 · 20개입" / "1팩 · 1.5kg"). 미입력 = 미저장(미렌더).
    const unitQtyNum = isBundle && unitQty && Number(unitQty) >= 1 ? Math.floor(Number(unitQty)) : null;
    const unitWeightNum = isBundle && unitWeight && Number(unitWeight) > 0 ? Number(unitWeight) : null;
    const unitLabel =
      unitQtyNum != null
        ? `1${UNIT_LABELS[saleUnit]} · ${unitQtyNum}개입`
        : unitWeightNum != null
          ? `1${UNIT_LABELS[saleUnit]} · ${unitWeightNum}kg`
          : null;
    // FIX-36 — fresh 묶음 스냅샷: 포장 단위(망/박스/봉/포대) + 기존 box_count/total_weight_kg 값으로
    //   unit_label 생성(FIX-15 가공·공산품과 같은 소비 키 — 거울 무접촉으로 카드 표시).
    const freshQtyNum =
      isFresh && saleUnit === "box" && boxCount && Number(boxCount) >= 1
        ? Math.floor(Number(boxCount))
        : null;
    const freshWeightNum =
      isFresh && saleUnit !== "unit" && !weightUnknown && totalWeight && Number(totalWeight) > 0
        ? Number(totalWeight)
        : null;
    const freshUnitLabel =
      isFresh && saleUnit === "box" && (freshQtyNum != null || freshWeightNum != null)
        ? `1${freshPackLabel}${freshQtyNum != null ? ` · ${freshQtyNum}개입` : ""}${freshWeightNum != null ? ` · ${freshWeightNum}kg` : ""}`
        : isFresh && saleUnit === "weight" && freshWeightNum != null
          ? `${freshWeightNum}kg 단위`
          : null;
    // 날짜 키 매핑 — fresh=harvest_date(기존 키) / processed=expiry_date / goods=ship_date(신규 키).
    const dateVal = harvestDate.trim() || null;
    // FIX-24 — 기간(순차배송): 종료일. 시작일과 같거나 processed 면 단일(_end 미저장).
    //   ISO(yyyy-mm-dd) 문자열이라 사전순 비교 = 날짜 비교.
    const dateEndRaw = type !== "processed" ? harvestDateEnd.trim() : "";
    if (dateVal && dateEndRaw && dateEndRaw < dateVal) {
      return setFormError("종료일은 시작일보다 빠를 수 없어요.");
    }
    const dateEndVal = dateVal && dateEndRaw && dateEndRaw > dateVal ? dateEndRaw : null;
    // 표시 스냅샷(unit_label 방식) — 빌더에서 문자열 확정(거울 철학). 예: "7/15~7/22 순차 발송".
    const md = (iso: string) => {
      const [, m, d] = iso.split("-");
      return `${Number(m)}/${Number(d)}`;
    };
    const dateRangeLabel = dateVal && dateEndVal ? `${md(dateVal)}~${md(dateEndVal)} 순차 발송` : null;

    // block_data — 기존 키 정합 + 45 신규 키(같은 jsonb 에 추가 저장, 렌더는 미주입=미렌더).
    const blockData: Record<string, unknown> = {
      name: name.trim(),
      price_krw: priceNum,
      ...(headline.trim() ? { headline: headline.trim() } : {}),
      ...(points.length > 0 ? { selling_points: points } : {}),
      is_fresh: isFresh,
      ...(isFresh && dateVal ? { harvest_date: dateVal } : {}),
      ...(qty != null ? { stock_limit: qty } : {}),
      price_band_enabled: false, // §0 시세 노출 영구 금지
      ...(isFresh && kamisItemCode ? { kamis_item_code: kamisItemCode } : {}),
      origin: origin.trim(),
      ...(categoryVal ? { category: categoryVal } : {}),
      ...(rate != null ? { dropy_rate: rate } : {}),
      ...(fixed != null ? { dropy_fixed: fixed } : {}),
      // ── 45 신규 키 ──
      product_type: type,
      sale_unit: saleUnit,
      ...(isFresh && saleUnit === "box" && boxCount ? { box_count: Math.floor(Number(boxCount)) } : {}),
      ...(isFresh && saleUnit !== "unit" && !weightUnknown && totalWeight
        ? { total_weight_kg: Number(totalWeight) }
        : {}),
      // FIX-15 — 묶음형 구성(가공품·공산품): unit_qty / unit_weight_kg / unit_label(표시용 스냅샷).
      ...(unitQtyNum != null ? { unit_qty: unitQtyNum } : {}),
      ...(unitWeightNum != null ? { unit_weight_kg: unitWeightNum } : {}),
      // FIX-36 — fresh 박스·묶음도 unit_label 스냅샷 합류(우선순위: 기존 묶음형 → fresh).
      ...(unitLabel
        ? { unit_label: unitLabel }
        : freshUnitLabel
          ? { unit_label: freshUnitLabel }
          : {}),
      ...(isFresh && saleUnit === "box" ? { pack_type: freshPackLabel } : {}),
      // FIX-36c — fresh 도 보관타입 저장(① 요약 칩 신규 입력 — additive 1키 확장).
      ...(type !== "goods" ? { storage_method: storage } : {}),
      ...(type === "processed" && dateVal ? { expiry_date: dateVal } : {}),
      ...(type === "goods" && dateVal ? { ship_date: dateVal } : {}),
      // FIX-24 — 기간 종료일(미주입 = 단일일 — 하위호환: 시작일 키는 위 기존 키 그대로).
      ...(isFresh && dateEndVal ? { harvest_date_end: dateEndVal } : {}),
      ...(type === "goods" && dateEndVal ? { ship_date_end: dateEndVal } : {}),
      ...(dateRangeLabel ? { date_range_label: dateRangeLabel } : {}),
      ...(type === "goods" ? { made_in: origin.trim() } : {}),
      ...(type === "goods" && brand.trim() ? { brand: brand.trim() } : {}),
      ...(type === "goods" && spec.trim() ? { spec: spec.trim() } : {}),
      free_ship: freeShip,
      ...(!freeShip && shipFee ? { ship_fee_krw: Math.floor(Number(shipFee)) } : {}),
      // S4-5 — 배송방법·안내문구(additive 키 · 미선택/미입력 = 미저장 = 손님 카드 미렌더).
      ...(shipMethod ? { ship_method: shipMethod } : {}),
      ...(shipNote.trim() ? { ship_note: shipNote.trim() } : {}),
      // FIX-40 — 공동구매 v1(표시 키만 · 정산 무접촉): 유효 통과분만 저장. 미달 자동 취소·
      //   차액 환불 자동화 없음(v1 락 — 판매자 수동 운영).
      ...(gbValid
        ? {
            group_buy_target_n: gbTargetN,
            group_buy_price_krw: gbPriceNum,
            // FIX-36c — 모집 마감일(자정 마감 · 날짜만). 미입력 = 키 생략.
            ...(groupBuyDeadline ? { group_buy_deadline: groupBuyDeadline } : {}),
          }
        : {}),
      // FIX-37 — 상품 상세정보 고시 스냅샷(jsonb 키 추가만 · 신규 테이블/마이그레이션 0).
      //   값 = 실입력·미러만, 미입력 "" 그대로(정직 표기 — 자동 생성 금지 §0).
      //   /d 렌더는 거울 수술 필요 → ST2b 이관(저장까지만).
      notice_type: type,
      notice_rows: buildNoticeRows45({
        type,
        name,
        itemCategory,
        origin,
        expiryDate: type === "processed" ? harvestDate : "",
        storageLabel:
          type === "processed" ? (STORAGE_OPTIONS.find((s) => s.id === storage)?.label ?? "") : "",
        brand,
        producer: noticeProducer,
        madeDate: noticeMadeDate,
        handling: noticeHandling,
        ingredients: noticeIngredients,
        model: noticeModel,
        asManager: noticeAsManager,
        contactPhone,
      }),
    };

    const payload: ProductRegisterPayload45 = {
      self_upload: true,
      image_url: imageUrl,
      name: name.trim(),
      price_krw: priceNum,
      headline: headline.trim(),
      selling_points: points,
      is_fresh: isFresh,
      harvest_date: isFresh ? dateVal : null,
      stock_limit: qty,
      price_band_enabled: false,
      ...(isFresh && kamisItemCode ? { kamis_item_code: kamisItemCode } : {}),
      blocks: [{ block_kind: "product", position: 0, block_data: blockData }],
    };

    setSaving(true);
    onBusyChange?.("상품을 등록하는 중…"); // FIX-14 — 호스트 스트립 busy 결합.
    try {
      const res = await onSubmit(payload);
      setSavedUuid(res.shareUuid);
      toast.success("상품을 등록했어요.");
    } catch (err) {
      console.error("[ProductRegisterForm45] submit:", err);
      setFormError("상품 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
      onBusyChange?.(null);
    }
  }

  // FIX-36c — 영수증 [고치기] 점프(jumpToBlock 문법 재사용): 해당 입력칸 스크롤+포커스.
  function jumpField(id: string) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: "center" });
    (el as HTMLInputElement | null)?.focus?.();
  }

  const focusRing = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`);
  const blurRing = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = "inset 0 0 0 1px transparent");
  const inputCls =
    "w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white";

  // FIX-48+50 작업4 — 폼 필수 마커 번호(interview-steps45 단일 정본 · 하드코딩 금지). 판매방식 =
  //   빠른등록/일반/공동구매. quickMode·groupBuyOn 변경 시 번호 즉시 갱신(state 파생).
  const interviewMethod45: SalesMethod = quickMode ? "quick" : groupBuyOn ? "groupBuy" : "full";
  const interviewJourney45 = getInterviewJourney("commerce", interviewMethod45);
  const stepNoOf = (formField: string) =>
    interviewJourney45.find((s) => s.formField === formField)?.no;

  return (
    <div className="space-y-4">
      {/* FIX-38 — 등록 방법 토글: 원포토(빠른 등록)는 기존 자세히 등록의 대체가 아닌 공존 경로. */}
      <Field label="등록 방법">
        <Segmented
          options={[
            { id: "full", label: "자세히 등록" },
            { id: "quick", label: "빠른 등록 — 사진 1장" },
          ]}
          value={quickMode ? "quick" : "full"}
          onSelect={(id) => {
            const q = id === "quick";
            setQuickMode(q);
            // 원포토 = 신선 기본(유형 선택 미노출 — 잔존 오염 방지 리셋은 selectType 재사용).
            if (q && type !== "fresh") selectType("fresh");
          }}
        />
      </Field>

      {/* 상품 사진 — 실 업로더 */}
      <Field label="상품 사진" stepNo={stepNoOf("photo")} accent={accent}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5] disabled:opacity-60"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} /> : <ImageIcon className="h-5 w-5" strokeWidth={2} />}
              </span>
              <span className="text-[11px] font-semibold">{uploading ? "올리는 중…" : "사진 선택"}</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </Field>

      <Field label="상품명" stepNo={stepNoOf("name")} accent={accent}>
        {/* FIX-34 — blur 확정 고리: 확정 시 체크 표시 + 진행 신호(링고 마이크로 안내 결합). */}
        <div className="relative">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameConfirmed) {
                setNameConfirmed(false); // 수정 시작 — 확정 해제(다음 blur 에서 재확정).
                emitProgress({ nameSet: false, name: e.target.value.trim() });
              }
            }}
            placeholder={copy.namePh}
            className={`${inputCls} pr-9`}
            style={{ boxShadow: "inset 0 0 0 1px transparent" }}
            onFocus={focusRing}
            onBlur={(e) => {
              blurRing(e);
              const confirmed = !!name.trim();
              setNameConfirmed(confirmed);
              emitProgress({ nameSet: confirmed, name: name.trim() });
            }}
          />
          {nameConfirmed && !!name.trim() && (
            <Check
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
              strokeWidth={2.75}
              style={{ color: accent }}
            />
          )}
        </div>
        {/* FIX-38 — 원포토: 사진→이름·분류 AI 제안은 함수 부재로 준비 중(정직 표기 — 가짜 제안 0).
            이름 확인(blur 확정 체크)은 FIX-34 기존 고리 재사용 — 확정 전 등록 차단. */}
        {quickMode && (
          <p className="mt-2 rounded-xl bg-[#F7F7F8] px-3 py-2.5 text-[11px] font-medium leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
            사진만으로 이름·분류까지 알아보는 AI 제안은 준비 중이에요 — 이름은 직접 적고 칸 밖을
            눌러 체크로 확정해 주세요. 확정하면 아래 AI 카피 도우미가 사진을 보고 문구를 제안해요.
          </p>
        )}
      </Field>

      <Field label="상품 유형" hidden={quickMode}>
        <Segmented options={TYPE_OPTIONS} value={type} onSelect={selectType} />
      </Field>

      {/* FIX-36c — 날짜(수확·발송/소비기한)는 ④ 재고·판매기간 섹션으로 이동(아래). */}

      {type === "processed" && (
        <Field label="보관 방법">
          <Segmented options={STORAGE_OPTIONS} value={storage} onSelect={setStorage} />
        </Field>
      )}

      {type === "goods" && (
        <Field label="브랜드·제조사" hint="선택">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: 포레스트 공방" className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
        </Field>
      )}

      {/* FIX-15 b) — 공산품 카테고리: 프리셋 칩 1뎁스("기타" = 직접입력 노출). 저장 키 = category. */}
      {type === "goods" && (
        <Field label="카테고리" hint="선택">
          <div className="flex flex-wrap gap-1.5">
            {GOODS_CATEGORY_PRESETS.map((p) => {
              const on = goodsPreset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setGoodsPreset(on ? null : p)}
                  className="rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                  style={on ? { backgroundColor: accent, color: "#fff" } : { backgroundColor: "#F4F4F5", color: "#525252" }}
                >
                  {p}
                </button>
              );
            })}
          </div>
          {goodsPreset === "기타" && (
            <input
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              placeholder="카테고리를 직접 입력하세요"
              className={`mt-1.5 ${inputCls}`}
              style={{ boxShadow: "inset 0 0 0 1px transparent" }}
              onFocus={focusRing}
              onBlur={blurRing}
            />
          )}
        </Field>
      )}

      {/* 분류 — fresh 는 KAMIS 실검색(기존 CAT-2 소스) / processed 식품 유형. goods 는 위 칩으로 대체.
          FIX-38 — 원포토(빠른 등록)에선 미노출(최소 동선). */}
      {!quickMode && type !== "goods" && (
      <Field label={copy.categoryLabel} hint={copy.categoryHint}>
        <input
          value={itemCategory}
          onChange={(e) => {
            setItemCategory(e.target.value);
            setKamisItemCode(null);
            setKamisOpen(true);
          }}
          placeholder={copy.categoryPh}
          className={inputCls}
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
        {type === "fresh" && kamisItemCode && (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: accent }}>
            <Check className="h-3 w-3" strokeWidth={2.75} />
            품목 연동됨 (코드 {kamisItemCode})
          </p>
        )}
        {kamisMatches.length > 0 && !kamisItemCode && (
          <div className="mt-1.5 space-y-1">
            {kamisMatches.map((it) => (
              <button
                key={it.item_code}
                type="button"
                onClick={() => {
                  setItemCategory(it.item_name);
                  setKamisItemCode(it.item_code);
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
        {copy.categorySearch && kamisAll.length === 0 && type === "fresh" && (
          <p className="mt-1 text-[10.5px] text-[#A3A3A3]">품목 이름을 입력하면 후보를 찾아드려요.</p>
        )}
      </Field>
      )}

      <Field label={copy.originLabel} stepNo={stepNoOf("origin")} accent={accent} hint="상품정보제공고시">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={copy.originPh} className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
      </Field>

      {type === "goods" && (
        <Field label="구성·규격" hint="선택">
          <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="예: 캔들 2개 · 개당 120g · 박스 포장" className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
        </Field>
      )}

      {/* FIX-36c ① — fresh 요약 칩: 보관타입(신규 입력 1칸 — 냉장/냉동/상온, 빠른등록에도 허용)
          + 구성 unit_label 미러 + 원산지 고시표 미러(값 있을 때만 — 창작 0). */}
      {type === "fresh" && (
        <Field label="보관·요약">
          {/* FIX-45c — 원산지 칩을 보관타입 칩 행 위 별도 행으로 분리(문구·값·저장 무변경 — 줄배치만). */}
          {origin.trim() && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[#F4F4F5] px-2.5 py-1.5 text-[12px] font-medium text-[#8A8A8A]">
                원산지: {origin.trim()}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {STORAGE_OPTIONS.map((s) => {
              const on = storage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStorage(s.id)}
                  className="rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                  style={
                    on
                      ? { backgroundColor: accent, color: "#fff" }
                      : { backgroundColor: "#F4F4F5", color: "#525252" }
                  }
                >
                  {s.label}
                </button>
              );
            })}
            {compositionLabel && (
              <span className="rounded-full bg-[#F4F4F5] px-2.5 py-1.5 text-[12px] font-medium text-[#8A8A8A]">
                구성: {compositionLabel}
              </span>
            )}
          </div>
        </Field>
      )}

      {/* FIX-36c ② — 판매 방식 입구 분기(Duke 확정): 일반 판매/공동구매 택1(기본 일반).
          FIX-40 토글 대체 — 상태(groupBuyOn)·저장 키·고지 문구 재사용(위치만 이동).
          빠른등록 침투 금지(일반 고정). */}
      <Field label="어떻게 판매하시겠어요?" hidden={quickMode}>
        <Segmented
          options={[
            { id: "normal", label: "일반 판매" },
            { id: "groupbuy", label: "공동구매" },
          ]}
          value={groupBuyOn ? "groupbuy" : "normal"}
          onSelect={(id) => setGroupBuyOn(id === "groupbuy")}
        />
      </Field>

      {/* 판매 구성(단위·무게) — FIX-38: 원포토에선 미노출(기본 낱개 유지).
          FIX-36c — 라벨 개칭: "어떻게 판매하시겠어요?"는 ② 판매 방식 분기가 사용(Duke 확정). */}
      <Field label="판매 구성 (단위·무게)" hidden={quickMode}>
        <Segmented options={unitOptions} value={saleUnit} onSelect={setSaleUnit} />
        {/* FIX-15 — 묶음형(팩·박스·포대·세트, 가공품·공산품) 구성: 1{단위} = N개 또는 N kg. */}
        {isBundle && (
          <div className="mt-2 space-y-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput
              label={`1${UNIT_LABELS[saleUnit]} 구성 — 개수`}
              value={unitQty}
              onChange={(v) => setUnitQty(onlyDigits(v))}
              placeholder={`1${UNIT_LABELS[saleUnit]} = N개`}
              suffix="개"
              accent={accent}
            />
            <SubInput
              label={`1${UNIT_LABELS[saleUnit]} 구성 — 무게(kg)`}
              value={unitWeight}
              onChange={(v) => setUnitWeight(v.replace(/[^0-9.]/g, ""))}
              placeholder={`1${UNIT_LABELS[saleUnit]} = N kg`}
              suffix="kg"
              accent={accent}
            />
            <p className="text-[10.5px] font-medium text-[#A3A3A3]">
              둘 중 하나만 적어도 돼요 — 카드에 "구성: 1{UNIT_LABELS[saleUnit]} · N개입"으로 보여요.
            </p>
          </div>
        )}
        {type === "fresh" && saleUnit === "box" && (
          <div className="mt-2 space-y-2 rounded-xl bg-[#F7F7F8] p-2.5">
            {/* FIX-36 — 포장 단위 선택(망/박스/봉/포대) + 묶음구성. 라벨·unit_label 스냅샷에 반영. */}
            <div className="flex flex-wrap gap-1.5">
              {FRESH_PACK_TYPES.map((p) => {
                const on = freshPackType === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFreshPackType(p)}
                    className="rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                    style={
                      on
                        ? { backgroundColor: accent, color: "#fff" }
                        : { backgroundColor: "#FFFFFF", color: "#525252" }
                    }
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <SubInput
              label={`1${freshPackLabel} 구성 — 개수`}
              value={boxCount}
              onChange={(v) => setBoxCount(onlyDigits(v))}
              placeholder={`1${freshPackLabel} = N개`}
              suffix="개"
              accent={accent}
            />
            {!weightUnknown && (
              <SubInput
                label={`1${freshPackLabel} 구성 — 무게(kg)`}
                value={totalWeight}
                onChange={(v) => setTotalWeight(v.replace(/[^0-9.]/g, ""))}
                placeholder={`1${freshPackLabel} = N kg`}
                suffix="kg"
                accent={accent}
              />
            )}
            <p className="text-[10.5px] font-medium text-[#A3A3A3]">
              예: 1망 = 10kg — 카드에 &ldquo;구성: 1{freshPackLabel} · 10kg&rdquo;처럼 보여요.
            </p>
          </div>
        )}
        {/* FIX-45 — 낱개 모드 1개 무게(g): 구 폼 정본 유실분 복원(시세 개당 환산 기준). */}
        {type === "fresh" && saleUnit === "unit" && !weightUnknown && (
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
        {saleUnit === "weight" && !weightUnknown && (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput
              label="판매 단위(kg)"
              value={totalWeight}
              onChange={(v) => setTotalWeight(v.replace(/[^0-9.]/g, ""))}
              placeholder="예: 5"
              suffix="kg"
              accent={accent}
            />
          </div>
        )}
        {/* FIX-45 — 구 폼 공통부 복원: 무게 미상 토글(3모드 공통) + 선언문 + 정합성 확인 배너. */}
        {type === "fresh" && (
          <div className="mt-2 space-y-2">
            <Checkbox
              checked={weightUnknown}
              onToggle={() => setWeightUnknown((v) => !v)}
              label="무게는 잘 몰라요"
              accent={accent}
            />
            {weightUnknown && (
              <p className="text-[10.5px] font-medium leading-relaxed text-[#A3A3A3] [word-break:keep-all]">
                기준 무게 데이터가 아직 없어요 — 무게 비교는 생략하고 kg당 시세만 보여드려요. 무게를
                알게 되면 토글을 끄고 적어주세요.
              </p>
            )}
            {declarationLine && (
              <p className="text-[11px] font-medium tabular-nums leading-relaxed text-[#525252] [word-break:keep-all]">
                {declarationLine}
              </p>
            )}
            {compositionSuspect && composition && (
              <div
                className="rounded-lg bg-[#FFFBEB] px-3 py-2"
                style={{ boxShadow: "inset 0 0 0 1px #FDE68A" }}
              >
                <p className="text-[11px] font-medium leading-relaxed text-[#92400E]">
                  입력값을 확인해 주세요: {composition.unitCount}개에 {composition.totalKg}kg이
                  맞습니까?
                </p>
              </div>
            )}
          </div>
        )}
      </Field>

      {/* FIX-36c — 고시표(FIX-37)는 ⑥(비용 뒤)으로 이동 — 아래 참조. */}

      {/* FIX-45 — 시세 엔진(구 폼 정본 이식 · 무수정 재사용): 생산자 화면 전용(§0 — /d·CardModel
          미리보기 미노출). 노출 조건 = 구 폼 동일(fresh + 품목 확정). 숫자·기준일·건수 = API 실값만. */}
      {type === "fresh" && kamisItemCode && (
        <div className="rounded-2xl bg-[#F7F7F8] p-3.5">
          <h3 className="text-[12.5px] font-bold text-[#0A0A0A]">시세는 이렇습니다. 참고하세요</h3>
          <PriceBandAdvisor
            priceBand={priceBand}
            loading={priceBandLoading}
            composition={
              composition
                ? {
                    packType:
                      saleUnit === "box" ? freshPackLabel : saleUnit === "unit" ? "낱개" : "단위",
                    unitCount: composition.unitCount,
                    totalKg: composition.totalKg,
                  }
                : null
            }
            compositionLabel={compositionLabel}
            myPriceKrw={priceNum > 0 ? priceNum : null}
            onRefresh={() => setPriceBandRefresh((n) => n + 1)}
            onAdjustPrice={() => {
              // 보완 a — 판매가 입력 포커스(구 폼 동작 그대로). 가격 변경 시 이익 영수증은
              //   FIX-36b 기존 반응형 계산이 즉시 재계산(신규 계산 로직 0).
              const el = document.getElementById("pd45-price");
              el?.scrollIntoView({ block: "center" });
              (el as HTMLInputElement | null)?.focus();
            }}
          />
        </div>
      )}

      {/* FIX-36c ③ — 가격(시세 블록·내 가격 위치 = 판매가 위 유지). 공동구매 = "기본 판매가". */}
      <Field label={groupBuyOn ? "기본 판매가" : "가격"} stepNo={stepNoOf("price")} accent={accent}>
        {/* FIX-45 — 구 폼 P1.5: 시세 데이터(status ok) 있을 때만 참고 문구. */}
        {priceBand?.status === "ok" && (
          <p className="mb-1.5 text-[11px] font-medium text-[#A3A3A3]">
            위 시세를 참고해 판매 가격을 정하세요
          </p>
        )}
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3 focus-within:bg-white" style={{ boxShadow: "inset 0 0 0 1px transparent" }}>
          <span className="text-[14px] font-bold text-[#525252]">₩</span>
          <input
            id="pd45-price"
            value={price}
            onChange={(e) => {
              const v = onlyDigits(e.target.value);
              setPrice(v);
              emitProgress({ priceSet: Number(v) > 0 }); // FIX-34 — 가격 진행 신호.
            }}
            inputMode="numeric"
            placeholder="19900"
            className="w-full bg-transparent px-1.5 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        {/* FIX-45 보완 b — 내 가격 위치 1줄(시세 실값 × 단위 정규화 · 실패 = 미렌더 · 사실만). */}
        {pricePositionLines.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {pricePositionLines.map((l) => (
              <p key={l} className="text-[10.5px] font-medium tabular-nums text-[#8A8A8A]">
                {l}
              </p>
            ))}
          </div>
        )}
        {/* FIX-36c — 이익 계산(원가·잡비 입력)은 ⑤ 비용, 영수증은 ⑧ 최하단으로 이동. */}
      </Field>

      {/* FIX-36c ③ — 판매 방식별 조건: 일반 = 예정 할인 / 공동구매 = 목표·달성가·모집 마감일.
          공동구매 UI 는 FIX-40 원문 이동(고지 문구 그대로) + 마감일 1칸 신설. */}
      {!groupBuyOn && (
        <Field label="예정 할인" hint="시뮬레이션 · 저장하지 않아요" hidden={quickMode}>
          <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
            <span className="text-[12px] font-semibold text-[#8A8A8A]">할인</span>
            <input
              id="pd45-discount"
              value={plannedDiscount}
              onChange={(e) => setPlannedDiscount(onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="예: 2000"
              className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
            <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
          </div>
          <p className="mt-1 text-[10.5px] text-[#A3A3A3]">
            {plannedDiscount && price ? `할인가 ${(priceNum - Number(plannedDiscount)).toLocaleString()}원` : "판매가를 입력하면 계산해 드려요"}
          </p>
        </Field>
      )}
      {groupBuyOn && (
        <Field label="공동구매 조건" hidden={quickMode}>
          <div className="space-y-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput
              label="목표 인원 (2명 이상)"
              value={groupBuyN}
              onChange={(v) => setGroupBuyN(onlyDigits(v))}
              placeholder="예: 10"
              suffix="명"
              accent={accent}
            />
            <SubInput
              label="달성 시 할인가 (기본 판매가보다 낮게)"
              value={groupBuyPrice}
              onChange={(v) => setGroupBuyPrice(onlyDigits(v))}
              placeholder="예: 25000"
              suffix="원"
              accent={accent}
            />
            {gbPriceNum != null && priceNum > 0 && gbPriceNum >= priceNum && (
              <p className="text-[10.5px] font-semibold text-[#EF4444]">
                달성 할인가는 기본 판매가보다 낮아야 해요
              </p>
            )}
            {/* FIX-36c — 모집 마감일(자정 마감 · 기간화 필드 문법 재사용 — 날짜만 저장). */}
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-[#525252]">
                모집 마감일 <span className="font-medium text-[#A3A3A3]">(선택 · 자정 마감)</span>
              </span>
              <input
                type="date"
                value={groupBuyDeadline}
                max={harvestDateEnd || harvestDate || undefined}
                onChange={(e) => setGroupBuyDeadline(e.target.value)}
                className={inputCls}
                style={{ boxShadow: "inset 0 0 0 1px transparent" }}
                onFocus={focusRing}
                onBlur={blurRing}
              />
            </div>
            <p className="text-[10.5px] font-medium leading-relaxed text-[#A3A3A3] [word-break:keep-all]">
              목표 달성 시 할인가 적용은 대표님이 주문 확정 시 직접 반영해 주세요. 목표 미달이면
              기본가로 진행돼요(자동 취소 없음).
            </p>
          </div>
        </Field>
      )}

      {/* FIX-36c ④ — 재고·판매기간: 판매 수량(이동) + 수확·발송/소비기한(이동 — quick 노출 유지).
          FIX-45c — 라벨·단위 = 판매 구성 동기화(A안 · 표기만 — 위치·저장 무변경) + 환산 확인 1줄. */}
      <Field label={qtyMeta.label} hint="선택 · 한정 수량" hidden={quickMode}>
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input value={quantity} onChange={(e) => setQuantity(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 30" className="w-full bg-transparent px-1 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
          <span className="shrink-0 text-[13px] font-semibold text-[#8A8A8A]">{qtyMeta.unit}</span>
        </div>
        {qtyConversionLine && (
          <p className="mt-1 text-[10.5px] font-medium tabular-nums text-[#A3A3A3]">
            {qtyConversionLine}
          </p>
        )}
      </Field>

      <Field label={copy.dateLabel} hint={copy.dateHint}>
        {type === "processed" ? (
          // 소비기한 — 기한은 하나(단일 유지).
          <input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
        ) : (
          // FIX-24 — 예약판매 농산물·수제품은 "수확(준비) 후 순차배송"이 본질 — 기간이 기본.
          //   시작일 선택 시 종료일 자동 = 시작일(단일), 종료는 min 으로 뒤로만 확장.
          <>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setHarvestDate(v);
                  if (!v) setHarvestDateEnd("");
                  else if (!harvestDateEnd || harvestDateEnd < v) setHarvestDateEnd(v);
                }}
                className={inputCls}
                style={{ boxShadow: "inset 0 0 0 1px transparent" }}
                onFocus={focusRing}
                onBlur={blurRing}
              />
              <span className="shrink-0 text-[13px] font-bold text-[#A3A3A3]">~</span>
              <input
                type="date"
                value={harvestDateEnd}
                min={harvestDate || undefined}
                onChange={(e) => setHarvestDateEnd(e.target.value)}
                className={inputCls}
                style={{ boxShadow: "inset 0 0 0 1px transparent" }}
                onFocus={focusRing}
                onBlur={blurRing}
              />
            </div>
            {!!harvestDate && !!harvestDateEnd && harvestDateEnd > harvestDate && (
              <p className="mt-1.5 text-[11px] font-medium text-[#8A8A8A]">
                {type === "fresh"
                  ? "이 기간 동안 수확 순서대로 순차 발송돼요"
                  : "이 기간 동안 준비되는 순서대로 순차 발송돼요"}
              </p>
            )}
          </>
        )}
      </Field>

      {/* S4-5 — ⑥배송(번호 스텝 · 발송기준 뒤): 배송방법(COURIERS45)·배송비(구 접힘 그룹에서
          이동 — 저장 키·이익계산 로직 무변경)·안내문구. quick 미노출(여정 미편입 — 기본 무료배송). */}
      <Field label="배송" stepNo={stepNoOf("ship")} accent={accent} hidden={quickMode}>
        {/* 배송방법 — 재탭 해제(미선택 = 미저장 = 손님 카드 미렌더). */}
        <div className="flex flex-wrap gap-1.5">
          {COURIERS45.map((c) => {
            const on = shipMethod === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  const next = on ? "" : c;
                  setShipMethod(next);
                  emitProgress({ shipMethodSet: !!next });
                }}
                className="rounded-xl px-3 py-2 text-[12px] font-bold transition-colors"
                style={
                  on
                    ? { backgroundColor: `${accent}14`, color: accent, boxShadow: `inset 0 0 0 1.5px ${accent}` }
                    : { backgroundColor: "#F4F4F5", color: "#525252" }
                }
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="mt-2">
          <Segmented
            options={[
              { id: "free", label: "무료배송(내 부담)" },
              { id: "paid", label: "배송비 별도(구매자 부담)" },
            ]}
            value={freeShip ? "free" : "paid"}
            onSelect={(id) => setFreeShip(id === "free")}
          />
        </div>
        {/* FIX-36 — 배송비 입력을 양 모드 노출: 무료배송 = 내 부담 비용(이익 계산 편입 · 저장 안 함) /
            구매자 부담 = 손님 카드 "배송비 N원" 표기 근거(ship_fee_krw 저장 — 기존 payload 계약 그대로). */}
        <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <span className="shrink-0 text-[12px] font-semibold text-[#8A8A8A]">배송비</span>
          <input
            id="pd45-ship"
            value={shipFee}
            onChange={(e) => setShipFee(onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="예: 4000"
            className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        <p className="mt-1 text-[10.5px] font-medium text-[#A3A3A3]">
          {freeShip
            ? "내가 부담하는 배송비 — 이익 계산에만 쓰고 저장하지 않아요"
            : "구매자가 결제 시 함께 내는 금액 — 손님 카드에 배송비로 표기돼요"}
        </p>
        {/* 안내문구(선택) — 손님 카드 [배송정보] 펼침에 그대로 표기. */}
        <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input
            id="pd45-shipnote"
            value={shipNote}
            onChange={(e) => setShipNote(e.target.value)}
            placeholder="배송 안내 (선택) — 예: 수확 상황에 따라 발송일이 조정될 수 있어요"
            className="w-full bg-transparent px-1 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
        </div>
      </Field>

      {/* FIX-48+50 P1.5 커밋3 — 비필수 비용·보상 필드 "(+) 더 입력" 접힘 그룹(기본 접힘, 인라인 —
          Radix 금지). 필수(번호) 필드는 위에서 펼침 유지 · quick/full hidden 토글 로직 무변경.
          S4-5 — 배송 입력은 위 ⑥배송 번호 스텝으로 이동(이중 입력 금지). */}
      <div>
        <button
          type="button"
          onClick={() => setMoreFieldsOpen((v) => !v)}
          aria-expanded={moreFieldsOpen}
          className="flex w-full items-center justify-between rounded-xl bg-[#F4F4F5] px-3 py-2.5"
        >
          <span className="flex items-center gap-1 text-[12px] font-bold text-[#525252]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />더 입력 (원가·보상)
          </span>
          <ChevronDown className={`h-4 w-4 text-[#8A8A8A] transition-transform ${moreFieldsOpen ? "rotate-180" : ""}`} strokeWidth={2.5} />
        </button>
        {moreFieldsOpen && (
          <div className="mt-3 space-y-4">
      {/* FIX-36c ⑤ — 비용(원가→배송→드로피→기타잡비). 원가·잡비 = 빠른등록에도 기존대로 노출. */}
      <Field label="원가" hint="선택 · 저장하지 않아요">
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input
            id="pd45-cost"
            value={cost}
            onChange={(e) => setCost(onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="예: 12000"
            className="w-full bg-transparent px-1 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
      </Field>

      {/* S4-5 — 구 배송 Field 는 위 ⑥배송 번호 스텝으로 이동(이중 입력 금지 — 렌더만 이동,
          freeShip/shipFee 상태·저장 키·이익 계산 로직 무변경). */}

      {/* FIX-36c — 공동구매 설정은 ② 분기 + ③ 공동구매 조건으로 이동(FIX-40 UI 원문 재사용). */}

      {/* 공유 보상 (Droppy) — 검증: rate 0<r≤20% / fixed 0<f≤price. FIX-38: 원포토 미노출(0 유지). */}
      <Field label="공유 보상 (Droppy)" hidden={quickMode}>
        <div id="pd45-droppy" />
        <Segmented
          options={[
            { id: "rate", label: "비율 %" },
            { id: "fixed", label: "고정 Droppy" },
          ]}
          value={droppyMode}
          onSelect={(id) => setDroppyMode(id as "rate" | "fixed")}
        />
        {droppyMode === "rate" ? (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#525252]">공유 보상 비율</span>
              <span className="rounded-md px-1.5 py-0.5 text-[13px] font-extrabold tabular-nums" style={{ color: accent, backgroundColor: `${accent}14` }}>
                {droppyRate}%
              </span>
            </div>
            <div className="relative mt-3 h-5">
              <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#E8E8EA]" />
              <div className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full transition-[width] duration-100" style={{ width: `${(droppyRate / 20) * 100}%`, backgroundColor: accent }} />
              <div className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white transition-[left] duration-100" style={{ left: `${(droppyRate / 20) * 100}%`, borderColor: accent, boxShadow: `0 2px 6px -1px ${accent}66` }} />
              <input type="range" min={0} max={20} step={1} value={droppyRate} onChange={(e) => setDroppyRate(Number(e.target.value))} aria-label="공유 보상 비율" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-[#A3A3A3]">
              <span>0%</span>
              <span>20%</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
            <span className="text-[12px] font-semibold text-[#8A8A8A]">고정</span>
            <input value={droppyFixed} onChange={(e) => setDroppyFixed(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 500" className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
            <span className="text-[13px] font-semibold text-[#8A8A8A]">Droppy</span>
          </div>
        )}
        <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-[#8A8A8A] [word-break:keep-all]">
          <Info className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2.25} />
          판매 성사 시 기여도에 따라 분배됩니다 · 공유만으로는 적립되지 않습니다
        </p>
      </Field>

      {/* FIX-36c ⑤ — 기타잡비(비용 마지막 · FIX-36b 원문 이동). 빠른등록에도 기존대로 노출. */}
      <Field label="기타 비용" hint="선택 · 저장하지 않아요">
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input
            id="pd45-misc"
            value={miscCost}
            onChange={(e) => setMiscCost(onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="예: 1500"
            aria-label="기타 비용 (포장·부자재·수수료 등)"
            className="w-full bg-transparent px-1 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
          />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        <p className="mt-1 text-[10.5px] font-medium text-[#A3A3A3]">
          포장비, 부자재비 등 이 상품에 드는 잡비를 더해 주세요
        </p>
      </Field>
          </div>
        )}
      </div>

      {/* FIX-36c ⑥ — 고시표(FIX-37 원문 이동 · 매장정보 미러는 고시표 내 소비자상담 전화가 담당).
          위 폼 입력(상품명·원산지·분류·소비기한·보관방법·브랜드)은 자동 미러(중복 입력 0),
          나머지 항목만 여기서 입력. 미입력은 그대로 정직 표기 — 자동 생성 금지(§0).
          원포토에선 hidden(DOM 유지·표시만 숨김 — 스냅샷은 미러값으로 동일 저장). */}
      <div className="rounded-2xl bg-[#F7F7F8] p-3.5" hidden={quickMode}>
        <button
          type="button"
          onClick={() => setNoticeOpen((v) => !v)}
          className="flex w-full items-center gap-1.5"
        >
          <span className="flex-1 text-left text-[12.5px] font-bold text-[#0A0A0A]">
            상품 상세정보 고시
          </span>
          <span className="text-[10.5px] font-medium text-[#8A8A8A]">전자상거래 필수 항목</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform"
            style={{ transform: noticeOpen ? "rotate(180deg)" : "none" }}
            strokeWidth={2.25}
          />
        </button>
        {noticeOpen && (
          <div className="mt-3 space-y-1.5">
            {type === "fresh" && (
              <>
                <NoticeMirror
                  label="품목 또는 명칭"
                  value={itemCategory.trim() || name.trim()}
                  from="상품명·품목 분류"
                />
                <NoticeMirror label="원산지" value={origin.trim()} from="원산지" />
                <NoticeField
                  label="생산자(수입자)"
                  value={noticeProducer}
                  onChange={setNoticeProducer}
                  placeholder="예: 괴산 홍씨네 농장(충북 괴산군)"
                  accent={accent}
                />
                <NoticeField
                  label="제조연월일(포장일 또는 생산연도)"
                  value={noticeMadeDate}
                  onChange={setNoticeMadeDate}
                  placeholder="예: 2026년 7월 포장"
                  accent={accent}
                />
                <NoticeField
                  label="보관방법 또는 취급방법"
                  value={noticeHandling}
                  onChange={setNoticeHandling}
                  placeholder="예: 수령 후 냉장 보관"
                  accent={accent}
                />
              </>
            )}
            {type === "processed" && (
              <>
                <NoticeMirror label="제품명" value={name.trim()} from="상품명" />
                <NoticeMirror label="식품의 유형" value={itemCategory.trim()} from="식품 유형" />
                <NoticeField
                  label="생산자 및 소재지"
                  value={noticeProducer}
                  onChange={setNoticeProducer}
                  placeholder="예: 홍씨네 공방(충북 괴산군)"
                  accent={accent}
                />
                <NoticeField
                  label="원재료명 및 함량"
                  value={noticeIngredients}
                  onChange={setNoticeIngredients}
                  placeholder="예: 딸기 70%(국산), 원당 30%"
                  accent={accent}
                />
                <NoticeMirror
                  label="제조연월일, 소비기한 또는 품질유지기한"
                  value={harvestDate.trim()}
                  from="소비기한(유통기한)"
                />
                <NoticeMirror
                  label="보관방법"
                  value={STORAGE_OPTIONS.find((s) => s.id === storage)?.label ?? ""}
                  from="보관 방법"
                />
              </>
            )}
            {type === "goods" && (
              <>
                <NoticeMirror label="품명" value={name.trim()} from="상품명" />
                <NoticeField
                  label="모델명"
                  value={noticeModel}
                  onChange={setNoticeModel}
                  placeholder="예: FOREST-C2"
                  accent={accent}
                />
                <NoticeMirror label="제조자(수입자)" value={brand.trim()} from="브랜드·제조사" />
                <NoticeMirror label="제조국 또는 원산지" value={origin.trim()} from="제조국" />
                <NoticeField
                  label="A/S 책임자"
                  value={noticeAsManager}
                  onChange={setNoticeAsManager}
                  placeholder="예: 홍길동"
                  accent={accent}
                />
              </>
            )}
            {/* 소비자상담 전화 — partners.contact_phone 자동(읽기전용 · 수정은 매장정보에서). */}
            <div className="rounded-lg bg-white px-2.5 py-2">
              <p className="text-[10.5px] font-semibold text-[#8A8A8A]">소비자상담 관련 전화번호</p>
              {contactPhone && contactPhone.trim() ? (
                <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-[#0A0A0A]">
                  {contactPhone}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] font-medium text-[#A3A3A3]">미등록</p>
              )}
              <p className="mt-1 text-[10px] font-medium text-[#A3A3A3]">
                매장 연락처가 자동으로 들어가요 — 수정은 매장정보 블록에서 해주세요
              </p>
            </div>
            <p className="text-[10px] font-medium leading-relaxed text-[#A3A3A3] [word-break:keep-all]">
              미입력 항목은 그대로 미입력으로 남아요 — 자동으로 채우지 않아요.
            </p>
          </div>
        )}
      </div>

      {/* 홍보 문구 — FIX-38: 원포토 미노출(AI 는 사진·이름·가격만으로 제안). */}
      <Field label="홍보 문구" hint="선택" hidden={quickMode}>
        <textarea value={extraInfo} onChange={(e) => setExtraInfo(e.target.value)} rows={3} placeholder={copy.promoPh} className="w-full resize-none rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus:bg-white" style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
        <p className="mt-1 text-[10.5px] text-[#A3A3A3]">{copy.promoNote}</p>
      </Field>

      {/* AI 카피 도우미 — 실배선(generate-promo-copy) */}
      <div className="rounded-2xl p-3.5" style={{ backgroundColor: `${accent}0A`, boxShadow: `inset 0 0 0 1px ${accent}26` }}>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-[#0A0A0A]">AI 카피 도우미</p>
            <p className="text-[10.5px] font-medium text-[#8A8A8A]">홍보 문구를 바탕으로 자동 작성</p>
          </div>
        </div>
        <button type="button" onClick={() => void generateCopy()} disabled={aiLoading} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold text-white shadow-sm transition-transform active:translate-y-px disabled:opacity-60" style={{ backgroundColor: accent }}>
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} /> : <Sparkles className="h-4 w-4" strokeWidth={2.25} />}
          {aiLoading ? "생성 중…" : "AI 카피 생성"}
        </button>
        <div className="mt-3">
          <span className="mb-1 block text-[11px] font-semibold text-[#525252]">헤드라인</span>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="한 줄 홍보 문구" className="w-full rounded-xl bg-white px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }} onFocus={focusRing} onBlur={blurRing} />
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-[11px] font-semibold text-[#525252]">셀링포인트</span>
          <div className="space-y-1.5">
            {sellingPoints.map((pt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: accent }}>
                  {i + 1}
                </span>
                <input
                  value={pt}
                  onChange={(e) => {
                    const next = [...sellingPoints];
                    next[i] = e.target.value;
                    setSellingPoints(next);
                  }}
                  placeholder={copy.pointPh}
                  className="w-full rounded-lg bg-white px-2.5 py-2 text-[12.5px] font-medium text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3]"
                  style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
                  onFocus={focusRing}
                  onBlur={blurRing}
                />
                {sellingPoints.length > 1 && (
                  <button type="button" onClick={() => setSellingPoints(sellingPoints.filter((_, idx) => idx !== i))} className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-[#8A8A8A] shadow-sm active:bg-[#F4F4F5]" aria-label="셀링포인트 삭제">
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSellingPoints([...sellingPoints, ""])} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-white py-2 text-[12px] font-semibold text-[#525252] shadow-sm active:bg-[#F4F4F5]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            셀링포인트 추가
          </button>
        </div>
      </div>

      {/* FIX-36c ⑧ — 이익 영수증(최하단 · 발행 직전). 차감 순서 = 화면 입력 순서(판매가→할인→
          원가→배송비→드로피 전액→기타잡비). 각 행 [고치기] = 입력칸 점프. 일반 1열 / 공동구매
          2열(미달 시 기본가 · 달성 시). 표시용·미저장·/d 미노출 — 계산은 정본 단일 호출(무변경). */}
      {receipt !== null && costNum != null && (
        <div className="rounded-2xl bg-[#F7F7F8] p-3.5">
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#525252]">
            <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
            이익 영수증
            <span className="ml-1 font-medium text-[#A3A3A3]">표시용 · 저장하지 않아요</span>
          </span>
          <div className="mt-1.5 space-y-1 rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold tabular-nums text-[#525252]">
            {gbReceipt && (
              <div className="flex justify-end gap-3 text-[10px] font-bold text-[#A3A3A3]">
                <span>미달 시 기본가</span>
                <span>달성 시</span>
              </div>
            )}
            <ReceiptRow
              label={gbReceipt ? "판매가(기본/달성)" : "판매가"}
              onFix={() => jumpField("pd45-price")}
              base={`${priceNum.toLocaleString()}원`}
              gb={gbReceipt && gbPriceNum != null ? `${gbPriceNum.toLocaleString()}원` : null}
            />
            {!groupBuyOn && discountNum > 0 && (
              <ReceiptRow
                label="예정 할인"
                onFix={() => jumpField("pd45-discount")}
                base={`−${Math.min(discountNum, priceNum).toLocaleString()}원`}
                gb={null}
              />
            )}
            <ReceiptRow
              label="원가"
              onFix={() => jumpField("pd45-cost")}
              base={`−${costNum.toLocaleString()}원`}
              gb={gbReceipt ? `−${costNum.toLocaleString()}원` : null}
            />
            {freeShip ? (
              shipFeeNum != null ? (
                <ReceiptRow
                  label="배송비(내 부담)"
                  onFix={() => jumpField("pd45-ship")}
                  base={`−${shipFeeNum.toLocaleString()}원`}
                  gb={gbReceipt ? `−${shipFeeNum.toLocaleString()}원` : null}
                />
              ) : (
                <p className="text-[10.5px] font-medium text-[#A3A3A3]">
                  {quickMode
                    ? "무료배송(내 부담) 기준 · 배송비 미입력 — 0원으로 계산했어요. 배송비 입력은 자세히 등록에서 해요"
                    : "무료배송(내 부담) · 배송비 미입력 — 0원으로 계산했어요. 위 배송 칸에 적으면 함께 빼드려요"}
                </p>
              )
            ) : (
              <p className="text-[10.5px] font-medium text-[#A3A3A3]">
                배송비는 구매자 부담 — 이익 계산에서 제외돼요
              </p>
            )}
            {(receipt.dropyCostKrw > 0 || (gbReceipt?.dropyCostKrw ?? 0) > 0) && (
              <ReceiptRow
                label={`드로피 차감${droppyMode === "rate" ? ` (${droppyRate}%)` : " (고정)"}`}
                onFix={() => jumpField("pd45-droppy")}
                base={`−${receipt.dropyCostKrw.toLocaleString()}원`}
                gb={gbReceipt ? `−${gbReceipt.dropyCostKrw.toLocaleString()}원` : null}
              />
            )}
            {receipt.miscCostKrw > 0 && (
              <ReceiptRow
                label="기타잡비"
                onFix={() => jumpField("pd45-misc")}
                base={`−${receipt.miscCostKrw.toLocaleString()}원`}
                gb={gbReceipt ? `−${gbReceipt.miscCostKrw.toLocaleString()}원` : null}
              />
            )}
            <div className="flex items-center justify-between gap-2 border-t border-[#EFEFEF] pt-1 text-[12px] font-bold">
              <span style={{ color: receipt.perUnitProfitKrw >= 0 ? accent : "#EF4444" }}>
                예상 이익
              </span>
              <span className="flex items-center gap-3">
                <span style={{ color: receipt.perUnitProfitKrw >= 0 ? accent : "#EF4444" }}>
                  {receipt.perUnitProfitKrw.toLocaleString()}원
                </span>
                {gbReceipt && (
                  <span style={{ color: gbReceipt.perUnitProfitKrw >= 0 ? accent : "#EF4444" }}>
                    {gbReceipt.perUnitProfitKrw.toLocaleString()}원
                  </span>
                )}
              </span>
            </div>
            {receipt.perUnitProfitKrw < 0 && (
              <p className="pt-0.5 text-[10.5px] font-semibold text-[#EF4444]">
                이 가격이면 손해예요
              </p>
            )}
            {gbReceipt && gbReceipt.perUnitProfitKrw < 0 && (
              <p className="pt-0.5 text-[10.5px] font-semibold text-[#EF4444]">
                이 달성가면 손해예요
              </p>
            )}
          </div>
          {/* 세금 고지 — processed·goods 만(fresh 농산물 = 부가세 면세 — 미표기). */}
          {type !== "fresh" && (
            <p className="mt-1.5 text-[10px] font-medium text-[#A3A3A3]">
              부가세·결제수수료는 포함하지 않은 예상 이익이에요
            </p>
          )}
          {/* 길잡이 a — 손익분기(정본 역산 · 사장님 입력값만 · 외부 데이터 0). */}
          {breakEvenPrice != null && (
            <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-[#525252]">
              판매가 {breakEvenPrice.toLocaleString()}원 밑으로는 손해예요
            </p>
          )}
          {/* 길잡이 b — 목표 이익 역산(선택 입력 1칸). */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-lg bg-white px-2.5">
              <input
                value={targetProfit}
                onChange={(e) => setTargetProfit(onlyDigits(e.target.value))}
                inputMode="numeric"
                placeholder="예: 5000"
                aria-label="목표 이익(원)"
                className="w-full bg-transparent px-1 py-2 text-[12px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
              />
              <span className="shrink-0 text-[11px] font-semibold text-[#8A8A8A]">원 남기려면</span>
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#525252]">
              {targetPrice != null ? `→ 판매가 최소 ${targetPrice.toLocaleString()}원` : "→ ―"}
            </span>
          </div>
        </div>
      )}

      {/* 등록 — 실 제출(/api/drops self_upload, 호출부 submitStudioProduct) */}
      {formError && <p className="text-[12px] font-medium text-[#DC2626]">{formError}</p>}
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold text-white transition-transform active:translate-y-px disabled:opacity-60"
        style={{ backgroundColor: accent, boxShadow: `0 6px 18px -8px ${accent}80` }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : savedUuid ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
        {saving ? "등록 중…" : savedUuid ? "등록됨 · 다시 등록" : "상품 등록"}
      </button>
    </div>
  );
}

/* ---------- 작은 재사용 조각들 (정본 그대로) ---------- */

// FIX-38 — hidden: 원포토(빠른 등록)에서 섹션 단위 미노출용(언마운트 — state 는 보존).
function Field({
  label,
  required,
  stepNo,
  accent,
  hint,
  hidden,
  children,
}: {
  label: string;
  required?: boolean;
  /** FIX-48+50 — 번호 인터뷰 마커(interview-steps45 판매방식별 번호). 있으면 붉은 "필수" 대신 번호. */
  stepNo?: number;
  accent?: string;
  hint?: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {stepNo != null && (
          <span
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold tabular-nums text-white"
            style={{ backgroundColor: accent ?? "#2563EB" }}
          >
            {stepNo}
          </span>
        )}
        <span className="text-[12px] font-bold text-[#0A0A0A]">{label}</span>
        {stepNo == null && required && <span className="text-[11px] font-bold text-[#EF4444]">필수</span>}
        {hint && <span className="text-[10.5px] font-medium text-[#A3A3A3]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ options, value, onSelect }: { options: { id: T; label: string }[]; value: T; onSelect: (id: T) => void }) {
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
            style={on ? { backgroundColor: "#0A0A0A", borderColor: "#0A0A0A", color: "#fff" } : { backgroundColor: "#F4F4F5", borderColor: "transparent", color: "#525252" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SubInput({ label, value, onChange, placeholder, suffix, accent }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; suffix: string; accent: string }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold text-[#525252]">{label}</span>
      <div className="flex items-center rounded-lg bg-white px-2.5" style={{ boxShadow: "inset 0 0 0 1px transparent" }}>
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

// FIX-36c — 이익 영수증 행: 라벨 + [고치기](입력칸 점프) + 값 1~2열(일반/공동구매).
function ReceiptRow({
  label,
  onFix,
  base,
  gb,
}: {
  label: string;
  onFix: () => void;
  base: string;
  gb: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={onFix}
          className="shrink-0 text-[10px] font-bold text-[#8A8A8A] underline underline-offset-2"
        >
          고치기
        </button>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span>{base}</span>
        {gb != null && <span>{gb}</span>}
      </span>
    </div>
  );
}

// FIX-37 — 고시표 자동 미러 행(읽기전용). 빈 값 = "미입력 — 출처 안내"(창작 금지).
function NoticeMirror({ label, value, from }: { label: string; value: string; from: string }) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-2">
      <p className="text-[10.5px] font-semibold text-[#8A8A8A]">{label}</p>
      {value ? (
        <p className="mt-0.5 text-[12px] font-semibold text-[#0A0A0A]">{value}</p>
      ) : (
        <p className="mt-0.5 text-[11px] font-medium text-[#A3A3A3]">
          미입력 — 위 {from} 칸에 적으면 자동으로 채워져요
        </p>
      )}
    </div>
  );
}

// FIX-37 — 고시표 직접 입력 행.
function NoticeField({
  label,
  value,
  onChange,
  placeholder,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-lg bg-white px-2.5 py-2"
      style={{ boxShadow: "inset 0 0 0 1px transparent" }}
    >
      <p className="text-[10.5px] font-semibold text-[#8A8A8A]">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full bg-transparent text-[12px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#C4C4C4]"
        onFocus={(e) => (e.currentTarget.parentElement!.style.boxShadow = `inset 0 0 0 1.5px ${accent}`)}
        onBlur={(e) => (e.currentTarget.parentElement!.style.boxShadow = "inset 0 0 0 1px transparent")}
      />
    </div>
  );
}

function Checkbox({ checked, onToggle, label, accent }: { checked: boolean; onToggle: () => void; label: string; accent: string }) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#525252]">
      <span
        className="flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors"
        style={checked ? { backgroundColor: accent, borderColor: accent, color: "#fff" } : { backgroundColor: "#fff", borderColor: "#D4D4D4" }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={2.75} />}
      </span>
      {label}
    </button>
  );
}
