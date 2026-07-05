// ProductRegisterForm — 상품 등록 폼 본체 (공용, P1 추출: partner.products.new 에서 이동).
//   순수 리팩터 — 동작·UI 변경 0. 라우터 데이터 결합 없음(loader/useSearch/useParams 미사용).
//   절단면: (a) createFileRoute/head 는 라우트 잔류 (b) 헤더 back-nav(Link)는 페이지 래퍼(라우트)에 잔류 →
//     컴포넌트는 router 훅 0. onNavigate 는 향후 임베드 호스트용 예약 옵션 prop.
//   (c) 저장은 onSubmit(payload) props 주입 — /api/drops insert 로직은 라우트가 그대로 소유.
//   (d) getSupabase 는 lib(비-라우터)라 컴포넌트 내부 유지(KAMIS 조회·get-price-band·업로드·세션).
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ImagePlus,
  Package,
  Loader2,
  CheckCircle2,
  Sprout,
  Factory,
  Box,
  CalendarDays,
  Hash,
  Tags,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { resizeToJpegBlob } from "@/lib/image-upload";
import {
  ProductCopyEditor,
  EMPTY_PRODUCT_COPY,
  type ProductCopyValue,
} from "@/components/create/ProductCopyEditor";
import { PriceBandAdvisor, type PriceBandResult } from "@/components/commerce/PriceBandAdvisor";

const BUCKET = "product-images";

// CAT-1 카테고리 3분기 — 상품정보제공고시(전자상거래법 13조④) 유형 분기의 최소선.
//   fresh=신선식품(KAMIS 시세·구성), processed=가공식품(내용량·소비기한), goods=공산품·잡화(고지만).
export type ProductCategory = "fresh" | "processed" | "goods";

const CATEGORY_OPTIONS: Array<{ key: ProductCategory; label: string; Icon: typeof Sprout }> = [
  { key: "fresh", label: "신선식품", Icon: Sprout },
  { key: "processed", label: "가공식품", Icon: Factory },
  { key: "goods", label: "공산품·잡화", Icon: Box },
];

// KAMIS 품목 분류 — 라이브 DB kamis_categories(6행)/kamis_items(130행). types.ts 미반영이라 캐스트.
type KamisCategory = { category_code: string; category_name: string };
type KamisItem = { item_code: string; item_name: string };
// CAT-2 — 전 부류 병합 목록 행(검색용). 기존 2단 로딩 타입(KamisItem)은 폴백이 그대로 사용.
type KamisItemFull = KamisItem & { category_code: string };

// CAT-2 검색 정규화 — 공백·괄호문자 제거 + 소문자. §0: 추천(fuzzy)용일 뿐,
//   확정은 후보 탭/Enter = 정확 item_code 선택만. 시세 조회는 확정 코드로만 나간다.
function normalizeItemText(s: string): string {
  return s.toLowerCase().replace(/[\s()（）]/g, "");
}

// CAT-2 동의어 사전 — 부분일치로 못 잡는 이명·사투리·품종·표기변형만 등록(확장 가능 구조).
//   값 = kamis_items.item_name 정확값. 부분일치로 잡히는 파생어(찰옥수수·애호박 등)는 등록 불필요.
const ITEM_SYNONYMS: Record<string, string> = {
  강냉이: "옥수수",
  스위트콘: "옥수수",
  고구마순: "고구마",
  무우: "무",
  동태: "명태",
  코다리: "명태",
  키위: "참다래",
  밀감: "감귤",
  부사: "사과",
  샤인머스캣: "샤인머스켓",
};

/** onSubmit 에 넘기는 저장 payload — 기존 /api/drops body 필드 그대로(신규 필드 추가 금지). */
export interface ProductRegisterPayload {
  self_upload: boolean;
  image_url: string;
  name: string | null;
  price_krw: number;
  headline: string;
  selling_points: string[];
  is_fresh: boolean;
  harvest_date: string | null;
  stock_limit: number | null;
  price_band_enabled: boolean;
  kamis_item_code?: string;
  blocks: Array<{ block_kind: string; block_data: Record<string, unknown>; position: number }>;
}

/** onSubmit 반환 — 생성된 드롭의 공유 정보. */
export interface ProductRegisterResult {
  shareUuid: string;
  shareUrl: string;
}

export interface ProductRegisterFormProps {
  /** 저장 핸들러(라우트가 /api/drops insert 로직 소유). payload → {shareUuid, shareUrl} 반환 또는 throw. */
  onSubmit: (payload: ProductRegisterPayload) => Promise<ProductRegisterResult>;
  /** 예약 옵션 — 임베드 호스트가 폼 내 네비를 필요로 할 때 주입(현 폼 본체는 미사용). */
  onNavigate?: (to: string) => void;
  /** P2 임베드 모드(스튜디오 등) — 폼 자체 카드 크롬·"새 상품" 헤더 숨김 + 완료 섹션(단축주소·
   *  카드 보기·공유하기)을 한 줄 상태로 대체(P2.1 S20: 단축주소는 호스트 발행 단일 경로).
   *  기본 false = 기존 동작. */
  embedded?: boolean;
  /** Phase 2 보완 — 재편집 프리필: 드롭 A product jsonb 의 dropy_rate(0~0.20)를 넘기면
   *  슬라이더가 해당 %(0~20)로 복원. 미주입 = 0(신규 등록 기존 동작). DR2-ⓑ max 20 확장. */
  initialDropyRate?: number;
  /** DR2-ⓑ 프리필 대칭 — product jsonb 의 dropy_fixed(정수 Droppy)를 넘기면 고정 모드로 복원.
   *  미주입 = %모드(기존 동작). */
  initialDropyFixed?: number;
}

// DR2-fix1 F5 — 금액·수량 입력 정수 보존 필터. 원인: type="number" 입력은 포커스 중 휠·
//   방향키가 step 감소를 일으켜 3000→2999 류 1원 깎임 발생 → type="text"+inputMode="numeric"
//   +숫자만 통과로 전환(평상시 무간섭 · 클램프는 계산 경계에서만).
function onlyDigits(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

// DR2-ⓑ ① 판매 방식 3모드 — CAT-1 세그먼트 문법(grid-cols-3) 복제. 환산은 P5a 단일 공식 재사용.
type SaleMode = "single" | "box" | "weight";
const SALE_MODE_OPTIONS: Array<{ key: SaleMode; label: string }> = [
  { key: "single", label: "낱개로" },
  { key: "box", label: "박스·묶음으로" },
  { key: "weight", label: "무게 단위로" },
];

// ============================================================================
// DR2-ⓑ ③ 이익 계산 정본(순수 함수) — CP-1b(주문시트)가 이식할 단일 기준.
//   ⚠️ Droppy % 기준 = 상품 실결제액(판매가 − 쿠폰/할인, 배송비 제외) — 표시·계산 동일.
//   shipping: free = 판매자 비용, paid = 구매자 부담(비용 아님 · 손님 결제에 병기만).
// ============================================================================
export interface ProfitReceiptInput {
  priceKrw: number; // 판매가(구성 단위)
  discountKrw: number; // 예정 할인(쿠폰 시뮬 — CP-1a 전 수동 입력, 저장 안 함)
  costKrw: number | null; // 원가(선택 · 로컬만)
  shippingMode: "free" | "paid";
  shippingFeeKrw: number; // 배송비(0 이상)
  dropyMode: "rate" | "fixed";
  dropyPercent: number; // 0~20(정수)
  dropyFixedKrw: number | null; // 고정 Droppy(유효 가드 통과분만)
}
export interface ProfitReceipt {
  netCustomerKrw: number; // 상품 실결제액 = 판매가 − 할인
  customerTotalKrw: number; // 손님 결제(배송비 별도 모드면 +배송비)
  sellerShippingKrw: number; // 무료배송(내 부담)일 때만 비용
  dropyCostKrw: number;
  perUnitProfitKrw: number; // 건당 남는 돈
  marginPct: number | null; // 판매가 대비 %
}
function computeProfitReceipt(i: ProfitReceiptInput): ProfitReceipt {
  const discount = Math.min(Math.max(i.discountKrw, 0), i.priceKrw);
  const net = i.priceKrw - discount;
  const customerTotal = i.shippingMode === "paid" ? net + i.shippingFeeKrw : net;
  const sellerShipping = i.shippingMode === "free" ? i.shippingFeeKrw : 0;
  const dropyCost =
    i.dropyMode === "fixed" ? (i.dropyFixedKrw ?? 0) : Math.round((net * i.dropyPercent) / 100);
  const profit = net - (i.costKrw ?? 0) - sellerShipping - dropyCost;
  return {
    netCustomerKrw: net,
    customerTotalKrw: customerTotal,
    sellerShippingKrw: sellerShipping,
    dropyCostKrw: dropyCost,
    perUnitProfitKrw: profit,
    marginPct: i.priceKrw > 0 ? (profit / i.priceKrw) * 100 : null,
  };
}

// STUDIO-fix2 G5 — resizeToJpegBlob 은 @/lib/image-upload 로 추출(동작 무변경 이동 · 스튜디오
//   대표 이미지 업로더와 관례 단일 출처 공유). MAX_WIDTH 상수도 lib 이 소유.

export function ProductRegisterForm({
  onSubmit,
  embedded = false,
  initialDropyRate,
  initialDropyFixed,
}: ProductRegisterFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  // P6-5ⓑ — 임베드(스튜디오) 전용 상품명 필수 인라인 안내. 파트너 라우트는 선택 유지.
  const [nameError, setNameError] = useState(false);
  const [price, setPrice] = useState("");
  // CAT-1 카테고리 3분기 — 기본 신선. 하위호환: 기존 is_fresh 저장값은 true→fresh / false→processed
  //   에 대응(goods 는 신규 — 구 데이터엔 없음). payload 의 is_fresh 는 category==="fresh" 파생 유지.
  const [category, setCategory] = useState<ProductCategory>("fresh");
  const isFresh = category === "fresh";
  const [harvestDate, setHarvestDate] = useState("");
  const [stockLimit, setStockLimit] = useState("");
  // CAT-1 가공 — 내용량(숫자+단위 g/ml/개입)·소비기한. 내용량은 폼 상태만(저장은 후속 슬라이스),
  //   소비기한만 product 블록 jsonb(expiry_date)로 저장.
  const [contentAmount, setContentAmount] = useState("");
  const [contentUnit, setContentUnit] = useState("g");
  const [expiryDate, setExpiryDate] = useState("");
  // CAT-1 고지 — 원산지(전 카테고리 필수, 상품정보제공고시). 빈칸 제출 시 인라인 안내 + 차단.
  const [origin, setOrigin] = useState("");
  const [originError, setOriginError] = useState(false);
  // Phase 2 — Droppy 공유 보상 비율(정수 % 0~20, 기본 0=미설정). 저장은 dropy_rate(0~0.20).
  //   보완 — 재편집 프리필: jsonb dropy_rate(0~0.20) → % 복원(범위 밖·미주입 = 0). DR2-ⓑ max 20.
  const [dropyPercent, setDropyPercent] = useState(() => {
    const p = Math.round((initialDropyRate ?? 0) * 100);
    return Number.isFinite(p) && p >= 0 && p <= 20 ? p : 0;
  });
  // DR2-ⓑ ③ — Droppy 이중모드(비율 %|고정 Droppy). 프리필 initialDropyFixed 있으면 고정 복원.
  const [dropyMode, setDropyMode] = useState<"rate" | "fixed">(() =>
    Number.isInteger(initialDropyFixed) && (initialDropyFixed as number) > 0 ? "fixed" : "rate",
  );
  const [dropyFixedInput, setDropyFixedInput] = useState(() =>
    Number.isInteger(initialDropyFixed) && (initialDropyFixed as number) > 0
      ? String(initialDropyFixed)
      : "",
  );
  // DR2-ⓑ ③ — 원가(로컬만·저장 금지)·배송비·부담 토글(기본 무료배송=내 부담)·예정 할인 시뮬.
  const [costInput, setCostInput] = useState("");
  const [shippingFeeInput, setShippingFeeInput] = useState("");
  const [shippingMode, setShippingMode] = useState<"free" | "paid">("free");
  const [plannedDiscountInput, setPlannedDiscountInput] = useState("");
  // DR2-ⓑ ④ — 목표 순이익 역산 입력(로컬만).
  const [targetProfitInput, setTargetProfitInput] = useState("");
  // KAMIS 품목 2단(부류→품목) — 시세(STEP4)·제철(STEP5) 연동 기반. 선택 사항(미선택 허용).
  const [kamisCategoryCode, setKamisCategoryCode] = useState("");
  const [kamisItemCode, setKamisItemCode] = useState("");
  const [kamisCategories, setKamisCategories] = useState<KamisCategory[]>([]);
  const [kamisItems, setKamisItems] = useState<KamisItem[]>([]);
  // CAT-2 품목 자동 매칭 — 전 부류 병합 목록(1회 로드) + 검색어/드롭다운/키보드 상태.
  const [allKamisItems, setAllKamisItems] = useState<KamisItemFull[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemActiveIdx, setItemActiveIdx] = useState(0);
  // STEP4-A — KAMIS 소매 시세 어드바이저(농가 가격 참고용). 품목 선택 시 get-price-band 조회.
  const [priceBand, setPriceBand] = useState<PriceBandResult | null>(null);
  const [priceBandLoading, setPriceBandLoading] = useState(false);
  // P5b 판매 구성(단위 헌법) — DR2-ⓑ ①: 판매 방식 3모드(낱개|박스·묶음|무게) 세그먼트 통역.
  //   환산은 기존 P5a 단일 공식(총중량÷입수) 재사용 — 모드는 입력 UI 통역일 뿐(재발명 0).
  //   저장 payload 미포함 — blocks/스키마 신규 컬럼 금지(저장 확장은 별도 슬라이스).
  const [saleMode, setSaleMode] = useState<SaleMode>("box");
  const [packType, setPackType] = useState("박스");
  const [packCount, setPackCount] = useState("");
  const [packWeightKg, setPackWeightKg] = useState("");
  const [singleWeightG, setSingleWeightG] = useState(""); // 낱개 — 1개 무게(g)
  const [weightUnitKg, setWeightUnitKg] = useState(""); // 무게 단위 — 판매 단위(kg)
  // DR2-fix1 F2 — [무게는 잘 몰라요] 토글. 기준 무게 자동 제시 소스 실측 결과:
  //   ⓐ 4-C 응답에 유사상품 구성(개당 무게) 분포 없음(통계·건수만) / ⓑ kamis_items 에 표준
  //   단위·개당 기준 컬럼 없음(item_code·category_code·item_name·sort_order 전부) → ⓒ 확정:
  //   "기준 데이터 없음" 명시 + kg 비교 생략(구성 미전달 → 어드바이저는 kg당 시세만).
  //   시세 환산 전용 — payload 저장 안 함.
  const [weightUnknown, setWeightUnknown] = useState(false);
  const packCountNum = Math.floor(Number(packCount));
  const packWeightNum = Number(packWeightKg);
  // 모드 → 유효 구성(입수·총중량 kg) 통역. box=기존 2칸 / single=1개×g / weight=1단위×kg.
  //   F2 — 무게 미상이면 구성 없음(kg 비교 생략) 처리.
  const composition = (() => {
    if (weightUnknown) return null;
    if (saleMode === "box") {
      return Number.isFinite(packCountNum) &&
        packCountNum >= 1 &&
        Number.isFinite(packWeightNum) &&
        packWeightNum > 0
        ? { unitCount: packCountNum, totalKg: packWeightNum }
        : null;
    }
    if (saleMode === "single") {
      const g = Number(singleWeightG);
      return Number.isFinite(g) && g > 0 ? { unitCount: 1, totalKg: g / 1000 } : null;
    }
    const kg = Number(weightUnitKg);
    return Number.isFinite(kg) && kg > 0 ? { unitCount: 1, totalKg: kg } : null;
  })();
  // 개당 중량(g) — 총중량÷입수(P5a 공식 그대로). get-price-band per_unit_weight_g 로 전달.
  const perUnitWeightG = composition
    ? Math.round((composition.totalKg * 1000) / composition.unitCount)
    : null;
  // 정합성 가드 — 개당 10g 미만 / 5kg 초과면 확인 배너(차단 아닌 확인).
  const compositionSuspect =
    perUnitWeightG != null && (perUnitWeightG < 10 || perUnitWeightG > 5000);
  // 시세 조회에 실을 입수 — 구성이 완성됐을 때만(미완성 타이핑 중 재조회 방지용 dep).
  const unitCountForQuery = composition != null ? composition.unitCount : null;
  // DR2-ⓑ ②C — [↻ 다시 조회] 수동 재조회 카운터(시세 effect dep).
  const [priceBandRefresh, setPriceBandRefresh] = useState(0);
  // DR2-ⓑ ① 선언문 — 계산 결과 자동 갱신. 괄호 축약("(1개 · 0.9kg)" 류) 노출 금지.
  const compositionLabel = composition
    ? saleMode === "box"
      ? `${composition.unitCount}개들이 한 ${packType}(${composition.totalKg}kg)`
      : saleMode === "single"
        ? `낱개 1개`
        : `${composition.totalKg}kg 단위`
    : null;
  const declarationLine =
    composition && perUnitWeightG != null
      ? saleMode === "box"
        ? `${composition.unitCount}개들이 한 ${packType}(${composition.totalKg}kg) · 개당 약 ${perUnitWeightG.toLocaleString("ko-KR")}g — 이 기준으로 시세를 비교해요`
        : saleMode === "single"
          ? `낱개 1개 · 약 ${perUnitWeightG.toLocaleString("ko-KR")}g — 이 기준으로 시세를 비교해요`
          : `${composition.totalKg}kg 단위 판매 — 이 기준으로 시세를 비교해요`
      : null;
  // DR2-ⓑ ③ 파생 — 유효 가드 통과 값만(무효 = NULL 흡수 · 차단 아님).
  const priceNumLive = Number(price);
  const priceValid =
    Number.isFinite(priceNumLive) && priceNumLive > 0 ? Math.floor(priceNumLive) : null;
  // 고정 Droppy 가드 — 정수 AND >0 AND ≤판매가(정본 우선규칙과 동일. DB·adapters 3면 미러).
  const dropyFixedValid = (() => {
    const t = dropyFixedInput.trim();
    if (!/^\d{1,9}$/.test(t)) return null;
    const n = Number(t);
    return n > 0 && (priceValid == null || n <= priceValid) ? n : null;
  })();
  const shippingFeeValid = (() => {
    const t = shippingFeeInput.trim();
    if (!/^\d{1,9}$/.test(t)) return null;
    return Number(t);
  })();
  const costValid = (() => {
    const t = costInput.trim();
    if (!/^\d{1,9}$/.test(t)) return null;
    return Number(t);
  })();
  const plannedDiscountValid = (() => {
    const t = plannedDiscountInput.trim();
    if (!/^\d{1,9}$/.test(t)) return null;
    return Number(t);
  })();
  // 영수증 — 정본 순수 함수(computeProfitReceipt) 단일 호출. 판매가 없으면 미계산.
  const receipt =
    priceValid != null
      ? computeProfitReceipt({
          priceKrw: priceValid,
          discountKrw: plannedDiscountValid ?? 0,
          costKrw: costValid,
          shippingMode,
          shippingFeeKrw: shippingFeeValid ?? 0,
          dropyMode,
          dropyPercent,
          dropyFixedKrw: dropyFixedValid,
        })
      : null;
  // 나-1 — 상품 카피(headline/selling_points). 비우면 저장 시 키 생략(회귀 0).
  const [copy, setCopy] = useState<ProductCopyValue>(EMPTY_PRODUCT_COPY);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 저장 성공 결과 — 생성된 드롭의 공유 URL(drop.how/{code}) + share_uuid(/d 미리보기용).
  const [result, setResult] = useState<{ shareUrl: string; shareUuid: string } | null>(null);

  // 부류 6개 1회 로드 (register.tsx business_categories 패턴). types.ts 미반영 → as never 캐스트.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabase()
        .from("kamis_categories" as never)
        .select("category_code, category_name")
        .order("sort_order");
      if (!cancelled) setKamisCategories((data as unknown as KamisCategory[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CAT-2 — 전 부류 품목 1회 병합 로드(약 130행, 클라 자체 필터로 충분 — 라이브러리 금지).
  //   실패해도 아래 기존 2단 로딩(직접 찾기 폴백)이 살아 있어 무해.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabase()
        .from("kamis_items" as never)
        .select("item_code, item_name, category_code")
        .order("sort_order");
      if (!cancelled) setAllKamisItems((data as unknown as KamisItemFull[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 부류 선택 시 해당 품목 로드 (register.tsx 149-166 패턴). 부류 비면 품목 비움.
  useEffect(() => {
    if (!kamisCategoryCode) {
      setKamisItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabase()
        .from("kamis_items" as never)
        .select("item_code, item_name")
        .eq("category_code", kamisCategoryCode)
        .order("sort_order");
      if (!cancelled) setKamisItems((data as unknown as KamisItem[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [kamisCategoryCode]);

  // CAT-2 부류명 표시 — 후보 드롭 "품목명 · 부류명" 용.
  const categoryNameOf = (code: string) =>
    kamisCategories.find((c) => c.category_code === code)?.category_name ?? "";

  // CAT-2 후보 매칭 — 정확 일치 > 동의어 > 품목명이 검색어 포함 > 검색어가 품목명 포함(2자+).
  //   단문자 품목(무·파·갓 등)의 역포함 노이즈는 2자+ 가드로 차단. 최대 7건.
  const itemCandidates = useMemo(() => {
    const q = normalizeItemText(itemQuery);
    if (!q || allKamisItems.length === 0) return [];
    const synTargets = new Set<string>();
    for (const [key, target] of Object.entries(ITEM_SYNONYMS)) {
      if (q.includes(normalizeItemText(key))) synTargets.add(normalizeItemText(target));
    }
    const scored: Array<{ it: KamisItemFull; score: number }> = [];
    for (const it of allKamisItems) {
      const n = normalizeItemText(it.item_name);
      let score = -1;
      if (n === q) score = 0;
      else if (synTargets.has(n)) score = 1;
      else if (n.includes(q)) score = 2 + n.length;
      else if (n.length >= 2 && q.includes(n)) score = 100 + (q.length - n.length);
      if (score >= 0) scored.push({ it, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 7).map((s) => s.it);
  }, [itemQuery, allKamisItems]);

  // CAT-2 상품명 선제 제안 — 상품명에서 품목이 읽히면 칩 1개 제안. 자동 확정 금지(§0:
  //   확정은 사용자의 [적용] 탭). 가장 긴 품목명 일치 우선(방울토마토 > 토마토), 폴백 동의어.
  const nameSuggestion = useMemo(() => {
    const q = normalizeItemText(name);
    if (!q || allKamisItems.length === 0) return null;
    let best: KamisItemFull | null = null;
    let bestLen = 0;
    for (const it of allKamisItems) {
      const n = normalizeItemText(it.item_name);
      if (n.length >= 2 && q.includes(n) && n.length > bestLen) {
        best = it;
        bestLen = n.length;
      }
    }
    if (!best) {
      for (const [key, target] of Object.entries(ITEM_SYNONYMS)) {
        if (q.includes(normalizeItemText(key))) {
          best =
            allKamisItems.find(
              (it) => normalizeItemText(it.item_name) === normalizeItemText(target),
            ) ?? null;
          if (best) break;
        }
      }
    }
    return best && best.item_code !== kamisItemCode ? best : null;
  }, [name, allKamisItems, kamisItemCode]);

  // CAT-2 후보 확정 — 검색 드롭·제안 칩 공용. 정확 item_code+category_code 동시 확정(§0)
  //   → 기존 시세 파이프라인(아래 effect)이 확정 코드로만 발화.
  function pickKamisItem(it: KamisItemFull) {
    setKamisCategoryCode(it.category_code);
    setKamisItemCode(it.item_code);
    setItemQuery(it.item_name);
    setItemSearchOpen(false);
    setItemActiveIdx(0);
  }

  // 품목 선택 시 KAMIS 소매 시세 조회 (미선택이면 호출 안 함 — 불필요 호출 방지).
  //   detach 주의: supabase.functions.invoke 를 메서드로 직접 호출(this 유지).
  //   P5b — 판매 구성(per_unit_weight_g/unit_count) 동반 전달 + 구성 타이핑 연타 방지 debounce(350ms).
  useEffect(() => {
    // CAT-1 — 신선 외 카테고리는 시세 조회·표시 자체를 중단(어설픈 표시 금지, §0).
    if (!isFresh || !kamisItemCode || !kamisCategoryCode) {
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
              // 단위 헌법 — 구성 입력 시 개수-only 리스팅도 개당중량으로 kg 환산(P5a 파라미터).
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
    // DR2-ⓑ ②A/C — 구성·품목 변경 자동 재조회(기존 dep) + priceBandRefresh 수동 재조회 dep.
  }, [
    isFresh,
    kamisItemCode,
    kamisCategoryCode,
    perUnitWeightG,
    unitCountForQuery,
    priceBandRefresh,
  ]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadedUrl(null);
    setResult(null);
    setUploading(true);
    try {
      const supabase = getSupabase();
      // 세션 명시 hydrate — anon 으로 나가면 RLS(auth.uid() NULL) 차단되므로 먼저 확인.
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        setUploadError("로그인이 필요해요.");
        return;
      }

      const blob = await resizeToJpegBlob(file);
      // 경로 첫 segment = userId → RLS INSERT(S1) 통과 조건.
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) {
        console.error("[ProductRegisterForm] upload failed:", upErr);
        setUploadError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      setPreviewUrl(publicUrl);
      setUploadedUrl(publicUrl);
      toast.success("사진을 업로드했어요.");
    } catch (err) {
      console.error("[ProductRegisterForm] unexpected:", err);
      setUploadError(err instanceof Error ? err.message : "사진 처리 중 문제가 생겼어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!uploadedUrl) {
      toast.error("상품 사진을 먼저 업로드해 주세요.");
      return;
    }
    // P6-5ⓑ — 임베드(스튜디오)만 상품명 필수: 발행 게이트(이름 필수)와 폼 단계 정합.
    //   게이트 자체는 0터치(이중 방어 유지). 파트너 라우트는 현행 선택 그대로.
    if (embedded && !name.trim()) {
      setNameError(true);
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("가격을 올바르게 입력해 주세요.");
      return;
    }
    // CAT-1 — 원산지 필수(상품정보제공고시). 빈칸이면 인라인 안내 + 제출 차단.
    const originTrimmed = origin.trim();
    if (!originTrimmed) {
      setOriginError(true);
      return;
    }
    const productName = name.trim() || null;
    setSubmitting(true);
    try {
      // S2b — 자체업로드 분기로 저장(payload → onSubmit, self_upload:true). insert 로직은 라우트 소유.
      //   가격/이름은 렌더용 product 블록으로도 운반(create-wizard 구매 흐름과 동일 형식).
      const payload: ProductRegisterPayload = {
        self_upload: true,
        image_url: uploadedUrl,
        name: productName,
        price_krw: priceNum,
        // 나-1 — 카피 동봉(서버가 메인 product 블록 block_data 에 머지). 빈 값은 서버에서 생략.
        headline: copy.headline.trim(),
        selling_points: copy.sellingPoints.map((s) => s.trim()).filter(Boolean),
        // 신선 원물 — CAT-1: is_fresh = (category==="fresh") 파생 유지(하위호환).
        //   processed/goods 는 false + 신선 키 생략(null) — 기존 가공 저장값과 동일 형태.
        is_fresh: isFresh,
        harvest_date: isFresh && harvestDate ? harvestDate : null,
        stock_limit: isFresh && Number(stockLimit) >= 1 ? Math.floor(Number(stockLimit)) : null,
        // §0 — 손님 카드 시세 노출 영구 금지(표시광고법) → 항상 false.
        price_band_enabled: false,
        // KAMIS 품목코드 — 신선 + 선택했을 때만. 미선택이면 키 생략(ADDITIVE, 기존 등록 무영향).
        ...(isFresh && kamisItemCode ? { kamis_item_code: kamisItemCode } : {}),
        blocks: [
          {
            block_kind: "product",
            block_data: {
              name: productName,
              price_krw: priceNum,
              // CAT-1 — 카테고리·고지(상품정보제공고시 최소선). jsonb 키 추가만(스키마 무변경).
              //   서버(/api/drops)는 block_data 를 스프레드 보존 머지하므로 그대로 저장된다.
              category,
              origin: originTrimmed,
              // Phase 2(㉮)/DR2-ⓑ — Droppy 이중모드 배타 저장(numeric 0~0.20 · max 20 확장):
              //   %모드 = dropy_rate 만 / 고정모드 = dropy_fixed(정수·유효 가드 통과분)만.
              //   소비는 fixed-우선 — 피드 RPC(get_feed_dropy_reward)·상세(adapters)·주문 스냅샷
              //   (create_preorder, DR2-ⓐ) 3면 동일 규칙. 정산은 스냅샷 기준(사후 변경 무영향).
              ...(dropyMode === "rate"
                ? { dropy_rate: dropyPercent / 100 }
                : dropyFixedValid != null
                  ? { dropy_fixed: dropyFixedValid }
                  : {}),
              // DR2-ⓑ — 배송 정책(ADDITIVE 키 추가만 · CP-1b 주문시트 소비 예정 · 삼면 미러).
              shipping_mode: shippingMode,
              ...(shippingFeeValid != null ? { shipping_fee_krw: shippingFeeValid } : {}),
              ...(category === "processed" && expiryDate ? { expiry_date: expiryDate } : {}),
            },
            position: 0,
          },
        ],
      };
      const r = await onSubmit(payload);
      setResult({ shareUuid: r.shareUuid, shareUrl: r.shareUrl });
      // P6-5ⓐ — 임베드는 P2.1 한 줄 상태("상품이 카드에 붙었어요")와 문구 통일(컨펌 반 겹 제거).
      toast.success(embedded ? "상품이 카드에 붙었어요" : "상품 카드를 만들었어요.");
    } catch (err) {
      console.error("[ProductRegisterForm] submit failed:", err);
      toast.error("상품 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      toast.success("공유 링크를 복사했어요.");
    } catch {
      toast.error("복사에 실패했어요.");
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={
          embedded
            ? "space-y-4"
            : "rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4"
        }
      >
        {embedded ? null : (
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <Package className="size-4 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <h2 className="text-sm font-bold text-[#0F172A]">새 상품</h2>
          </div>
        )}

        {/* 사진 (필수) */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-[#0F172A]">상품 사진</span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFAFA] px-4 py-8 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                올리는 중…
              </>
            ) : (
              <>
                <ImagePlus className="size-5" strokeWidth={2} />
                {previewUrl ? "다른 사진으로 바꾸기" : "사진 선택"}
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
              <img
                src={previewUrl}
                alt="업로드한 상품 사진 미리보기"
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : null}

          {uploadedUrl ? (
            <p className="break-all text-[11px] text-[#15803D]">업로드됨: {uploadedUrl}</p>
          ) : null}

          {uploadError ? <p className="text-[11px] text-[#EF4444]">{uploadError}</p> : null}
        </div>

        {/* 상품명 — P6-5ⓑ: 임베드(스튜디오)=필수(발행 게이트 정합) / 파트너 라우트=선택(현행). */}
        <div className="space-y-2">
          <label htmlFor="pd-name" className="block text-xs font-semibold text-[#0F172A]">
            상품명{" "}
            <span className="font-medium text-[#94A3B8]">{embedded ? "(필수)" : "(선택)"}</span>
          </label>
          <input
            id="pd-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(false);
            }}
            placeholder="예: 해남 꿀고구마 5kg"
            maxLength={80}
            className={`w-full min-h-[44px] rounded-xl border bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none ${
              nameError ? "border-[#EF4444]" : "border-[#E5E7EB]"
            }`}
          />
          {nameError ? (
            <p className="text-[11px] font-medium tracking-ko text-[#EF4444]">
              카드 발행에 상품명이 필요해요.
            </p>
          ) : null}
        </div>

        {/* CAT-1 카테고리 3분기 — 신선식품/가공식품/공산품·잡화(상품정보제공고시 유형 분기).
            fresh=KAMIS·구성·시세(P5d 그대로) / processed=내용량·소비기한 / goods=고지만. */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
          <span className="block text-xs font-semibold tracking-ko text-text-strong">
            상품 유형
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={category === key}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold tracking-ko transition-colors ${
                  category === key
                    ? "border-action bg-bg text-text-strong"
                    : "border-border bg-bg text-text-muted hover:border-text-muted"
                }`}
              >
                <Icon className="size-4" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          {isFresh ? (
            <div className="space-y-3 pt-1">
              {/* 수확/발송 예정일 */}
              <label htmlFor="pd-harvest" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <CalendarDays className="size-3.5" strokeWidth={2} />
                  수확·발송 예정일 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <input
                  id="pd-harvest"
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                />
              </label>

              {/* 한정 수량 입력은 DR2-ⓑ ④ "몇 개나 판매하시겠어요?" 섹션으로 이동(상태·머지 키 불변). */}

              {/* §0 — 손님 카드 시세 비교 노출은 영구 금지(표시광고법). 생산자 참고용
                  PriceBandAdvisor(아래 품목 선택 시)만 유지. '손님 노출 토글'은 제거. */}

              {/* 품목 분류 — CAT-2: 검색 자동 매칭이 기본, 부류→품목 2단은 "직접 찾기" 폴백.
                  선택 사항(미선택 허용). 시세·제철 연동 기반. */}
              <div className="space-y-2 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <Tags className="size-3.5" strokeWidth={2} />
                  품목 분류{" "}
                  <span className="font-medium text-text-subtle">(선택 · 시세·제철 연동용)</span>
                </span>

                {/* CAT-2 품목 검색 — fuzzy 추천, 확정은 후보 선택(정확 item_code)만(§0). */}
                <div className="relative">
                  <input
                    type="text"
                    role="combobox"
                    aria-label="품목 검색"
                    aria-expanded={itemSearchOpen && itemCandidates.length > 0}
                    aria-controls="pd-item-listbox"
                    value={itemQuery}
                    onChange={(e) => {
                      setItemQuery(e.target.value);
                      setItemSearchOpen(true);
                      setItemActiveIdx(0);
                    }}
                    onFocus={() => {
                      if (itemQuery.trim()) setItemSearchOpen(true);
                    }}
                    onBlur={() => setItemSearchOpen(false)}
                    onKeyDown={(e) => {
                      if (!itemSearchOpen || itemCandidates.length === 0) {
                        if (e.key === "Enter") e.preventDefault(); // 검색 중 실수 제출 방지
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setItemActiveIdx((i) => Math.min(i + 1, itemCandidates.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setItemActiveIdx((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        pickKamisItem(itemCandidates[itemActiveIdx]);
                      } else if (e.key === "Escape") {
                        setItemSearchOpen(false);
                      }
                    }}
                    placeholder="품목 이름을 입력하세요 (예: 옥수수)"
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                  {itemSearchOpen && itemCandidates.length > 0 ? (
                    <ul
                      id="pd-item-listbox"
                      role="listbox"
                      aria-label="품목 후보"
                      className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-bg shadow-soft"
                    >
                      {itemCandidates.map((c, i) => (
                        <li key={c.item_code} role="option" aria-selected={i === itemActiveIdx}>
                          <button
                            type="button"
                            // onMouseDown + preventDefault — input blur 보다 먼저 확정(클릭 유실 방지).
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickKamisItem(c);
                            }}
                            onMouseEnter={() => setItemActiveIdx(i)}
                            className={`flex w-full min-h-[44px] items-center px-3 text-sm tracking-ko ${
                              i === itemActiveIdx ? "bg-surface" : "bg-bg"
                            }`}
                          >
                            <span className="font-semibold text-text-strong">{c.item_name}</span>
                            <span className="ml-1 text-[11px] font-medium text-text-subtle">
                              · {categoryNameOf(c.category_code)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {/* CAT-2 상품명 선제 제안 — 자동 확정 금지(§0): [적용] 탭이 유일한 확정 행위. */}
                {nameSuggestion ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="text-[12px] font-medium tracking-ko text-text-muted">
                      혹시 &lsquo;{nameSuggestion.item_name}&rsquo;인가요?
                    </span>
                    <button
                      type="button"
                      onClick={() => pickKamisItem(nameSuggestion)}
                      className="shrink-0 min-h-[44px] min-w-[44px] rounded-lg px-3 text-xs font-bold tracking-ko text-accent hover:bg-bg"
                    >
                      적용
                    </button>
                  </div>
                ) : null}

                {/* CAT-2 직접 찾기 폴백 — 기존 부류→품목 2단 select 보존(자동 매칭 실패 탈출구).
                    같은 state(kamisCategoryCode/kamisItemCode)를 쓰므로 검색 선택과 상호 동기. */}
                <details>
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-[12px] font-semibold tracking-ko text-text-muted hover:text-text-strong">
                    직접 찾기 (부류 → 품목 선택)
                  </summary>
                  <div className="space-y-2 pt-1">
                    <select
                      aria-label="부류 선택"
                      value={kamisCategoryCode}
                      onChange={(e) => {
                        setKamisCategoryCode(e.target.value);
                        setKamisItemCode(""); // 부류 바뀌면 품목 선택 초기화(stale 방지)
                        setItemQuery(""); // CAT-2 상호 동기 — 선택 해제 시 검색창 표시도 비움
                      }}
                      className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                    >
                      <option value="">부류 선택</option>
                      {kamisCategories.map((c) => (
                        <option key={c.category_code} value={c.category_code}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                    {kamisCategoryCode && kamisItems.length > 0 ? (
                      <select
                        aria-label="품목 선택"
                        value={kamisItemCode}
                        onChange={(e) => {
                          setKamisItemCode(e.target.value);
                          // CAT-2 상호 동기 — 폴백에서 고르면 검색창 표시도 품목명으로 일치.
                          const picked = kamisItems.find((i) => i.item_code === e.target.value);
                          setItemQuery(picked?.item_name ?? "");
                        }}
                        className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                      >
                        <option value="">품목 선택</option>
                        {kamisItems.map((it) => (
                          <option key={it.item_code} value={it.item_code}>
                            {it.item_name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </details>

                {/* 판매 구성 입력은 DR2-ⓑ ① / 시세 어드바이저는 ② 섹션으로 이동(상태·배선 불변). */}
              </div>
            </div>
          ) : null}

          {/* CAT-1 processed — 내용량(숫자+단위 g/ml/개입) + 소비기한. KAMIS·구성 4칸 숨김,
              시세 어드바이저 미렌더(가공 시세 소스는 후속 슬라이스 — 어설픈 표시 금지). */}
          {category === "processed" ? (
            <div className="space-y-3 pt-1">
              <label htmlFor="pd-content" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <Hash className="size-3.5" strokeWidth={2} />
                  내용량 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
                  <input
                    id="pd-content"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={contentAmount}
                    onChange={(e) => setContentAmount(e.target.value)}
                    placeholder="예: 500"
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                  <select
                    aria-label="내용량 단위"
                    value={contentUnit}
                    onChange={(e) => setContentUnit(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                  >
                    {["g", "ml", "개입"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label htmlFor="pd-expiry" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <CalendarDays className="size-3.5" strokeWidth={2} />
                  소비기한·유통기한 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <input
                  id="pd-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                />
              </label>
            </div>
          ) : null}

          {/* CAT-1 goods — KAMIS·구성·시세 전부 숨김(§0: 브랜드 상품 비교는 정직하게 미제공). */}
          {category === "goods" ? (
            <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
              공산품·잡화는 시세 비교를 제공하지 않아요. 사진·가격·홍보 문구와 아래 고지만
              등록합니다.
            </p>
          ) : null}

          {/* CAT-1 고지 — 원산지(전 카테고리 노출·필수, 상품정보제공고시 최소선).
              goods 는 "상세페이지 참조" 프리셋 버튼 제공. 빈칸 제출 시 인라인 안내 + 차단. */}
          <label htmlFor="pd-origin" className="block pt-1">
            <span className="text-xs font-semibold tracking-ko text-text-strong">
              원산지 <span className="font-medium text-text-subtle">(필수 · 상품정보제공고시)</span>
            </span>
            <div className="mt-2 flex gap-2">
              <input
                id="pd-origin"
                type="text"
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  if (originError) setOriginError(false);
                }}
                placeholder="예: 국산(충북 괴산)"
                maxLength={80}
                className={`flex-1 min-w-0 min-h-[44px] rounded-xl border bg-bg px-3 text-sm text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none ${
                  originError ? "border-[#EF4444]" : "border-border"
                }`}
              />
              {category === "goods" ? (
                <button
                  type="button"
                  onClick={() => {
                    setOrigin("상세페이지 참조");
                    setOriginError(false);
                  }}
                  className="shrink-0 min-h-[44px] rounded-xl border border-border bg-bg px-3 text-xs font-semibold tracking-ko text-text-muted hover:border-text-muted"
                >
                  상세페이지 참조
                </button>
              ) : null}
            </div>
            {originError ? (
              <p className="mt-2 text-[11px] font-medium tracking-ko text-[#EF4444]">
                원산지를 입력해 주세요 — 상품정보제공고시 필수 항목이에요.
              </p>
            ) : null}
          </label>
        </div>

        {/* DR2-ⓑ ① 구성 통역 — 판매 방식 3모드 세그먼트(CAT-1 문법 복제) + 선언문.
            환산은 P5a 단일 공식 재사용(재발명 0) · 저장 payload 미포함(기존 그대로). */}
        {isFresh ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
            {/* DR2-fix1 F3 — 제목 교정(이 한 곳만). */}
            <h3 className="text-sm font-bold tracking-ko text-text-strong">
              어떻게 판매하시겠어요?
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {SALE_MODE_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSaleMode(key)}
                  aria-pressed={saleMode === key}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl border px-2 text-xs font-semibold tracking-ko transition-colors ${
                    saleMode === key
                      ? "border-action bg-bg text-text-strong"
                      : "border-border bg-bg text-text-muted hover:border-text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {saleMode === "box" ? (
              <div className="grid grid-cols-3 gap-2">
                <select
                  aria-label="포장형태"
                  value={packType}
                  onChange={(e) => setPackType(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                >
                  {["박스", "봉", "망", "기타"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="block">
                  <span className="sr-only">한 박스 개수</span>
                  <input
                    aria-label="한 박스 개수"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={packCount}
                    onChange={(e) => setPackCount(e.target.value)}
                    placeholder="한 박스 N개"
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">총 무게(kg)</span>
                  <input
                    aria-label="총 무게(kg)"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    disabled={weightUnknown}
                    value={packWeightKg}
                    onChange={(e) => setPackWeightKg(e.target.value)}
                    placeholder="총 무게 kg"
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none disabled:opacity-50"
                  />
                </label>
              </div>
            ) : null}

            {saleMode === "single" ? (
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  1개 무게 약 <span className="font-medium text-text-subtle">(g)</span>
                </span>
                <input
                  aria-label="1개 무게(g)"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  disabled={weightUnknown}
                  value={singleWeightG}
                  onChange={(e) => setSingleWeightG(e.target.value)}
                  placeholder="예: 300"
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none disabled:opacity-50"
                />
              </label>
            ) : null}

            {saleMode === "weight" ? (
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  판매 단위 <span className="font-medium text-text-subtle">(kg)</span>
                </span>
                <input
                  aria-label="판매 단위(kg)"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  disabled={weightUnknown}
                  value={weightUnitKg}
                  onChange={(e) => setWeightUnitKg(e.target.value)}
                  placeholder="예: 5"
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none disabled:opacity-50"
                />
              </label>
            ) : null}

            {/* DR2-fix1 F2 — 무게 미상 토글. 기준 무게 자동 제시 소스 실측: ⓐ 4-C 응답에 구성
                분포 없음 · ⓑ KAMIS 표준단위 매핑 없음 → ⓒ "기준 데이터 없음" 명시 + kg 비교 생략.
                (소스가 생기면 이 자리에서 기준값 제시 + 편집 입력 + 출처 1줄로 승격.) */}
            <button
              type="button"
              onClick={() => setWeightUnknown((v) => !v)}
              aria-pressed={weightUnknown}
              className={`flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-xs font-semibold tracking-ko transition-colors ${
                weightUnknown
                  ? "border-action bg-bg text-text-strong"
                  : "border-border bg-bg text-text-muted hover:border-text-muted"
              }`}
            >
              무게는 잘 몰라요
            </button>
            {weightUnknown ? (
              <p className="text-[12px] font-medium leading-relaxed tracking-ko text-text-muted">
                기준 무게 데이터가 아직 없어요 — 무게 비교는 생략하고 kg당 시세만 보여드려요. 무게를
                알게 되면 토글을 끄고 적어주세요.
              </p>
            ) : null}

            {/* 선언문 — 계산 결과 1줄 자동 갱신(괄호 축약 노출 금지). */}
            {declarationLine ? (
              <p className="text-[12px] font-medium tabular-nums leading-relaxed tracking-ko text-text-muted">
                {declarationLine}
              </p>
            ) : null}
            {/* 정합성 가드 — 차단 아닌 확인(개당 10g 미만/5kg 초과). 정적 앰버. */}
            {compositionSuspect && composition ? (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
                <p className="text-[11px] font-medium leading-relaxed tracking-ko text-[#92400E]">
                  입력값을 확인해 주세요: {composition.unitCount}개에 {composition.totalKg}kg이
                  맞습니까?
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* DR2-ⓑ ② 시세 4점 앵커 — 도매(4-B)·소매(4-A)·인터넷(네이버 4-C) + 내 가격.
            판매자 전용 참고(§0 — 소비자 카드 노출 경로 없음). 품목 선택 시만. */}
        {isFresh && kamisItemCode ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
            <h3 className="text-sm font-bold tracking-ko text-text-strong">
              시세는 이렇습니다. 참고하세요
            </h3>
            <PriceBandAdvisor
              priceBand={priceBand}
              loading={priceBandLoading}
              composition={
                composition
                  ? {
                      packType:
                        saleMode === "box" ? packType : saleMode === "single" ? "낱개" : "단위",
                      unitCount: composition.unitCount,
                      totalKg: composition.totalKg,
                    }
                  : null
              }
              compositionLabel={compositionLabel}
              myPriceKrw={priceValid}
              onRefresh={() => setPriceBandRefresh((n) => n + 1)}
              onAdjustPrice={() => {
                const el = document.getElementById("pd-price");
                el?.scrollIntoView({ block: "center" });
                (el as HTMLInputElement | null)?.focus();
              }}
            />
          </section>
        ) : null}

        {/* 가격 (필수) — P1.5: 품목→시세 확인 후 입력(순서 유도, 강제 아님). */}
        <div className="space-y-2">
          <label htmlFor="pd-price" className="block text-xs font-semibold text-[#0F172A]">
            가격
          </label>
          {/* P1.5 — 시세 데이터(status ok) 있을 때만 참고 문구. 미조회·데이터 없음이면 숨김. */}
          {priceBand?.status === "ok" ? (
            <p className="text-[11px] font-medium tracking-ko text-text-subtle">
              위 시세를 참고해 판매 가격을 정하세요
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              id="pd-price"
              type="number"
              inputMode="numeric"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="19900"
              className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm tabular-nums text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
              required
            />
            <span className="shrink-0 text-sm font-semibold text-[#64748B]">원</span>
          </div>
        </div>

        {/* DR2-ⓑ ③ 이익 계산 — 한큐 영수증. Droppy 이중모드(0~20%, 1% 단위 | 고정 정수).
            표시 = 풀 총액만 — 몫 분해(60/30/10) 표시 금지[보정1]. 문안 락: 모집·수익 뉘앙스 금지,
            UI=Droppy(영문)·코드=dropy. 저장 = product 블록 jsonb dropy_rate|dropy_fixed(배타).
            ⚠️ Droppy % 기준 = 상품 실결제액(판매가−쿠폰, 배송비 제외) — 표시·계산 모두. */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
          <h3 className="text-sm font-bold tracking-ko text-text-strong">이익 계산</h3>

          {/* 원가(선택 · 로컬만 · 저장 금지) */}
          <label htmlFor="pd-cost" className="block">
            <span className="text-xs font-semibold tracking-ko text-text-strong">
              원가 <span className="font-medium text-text-subtle">(선택 · 저장하지 않아요)</span>
            </span>
            <input
              id="pd-cost"
              type="text"
              inputMode="numeric"
              value={costInput}
              onChange={(e) => setCostInput(onlyDigits(e.target.value))}
              placeholder="예: 12000"
              className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
            />
          </label>

          {/* 배송비 + 부담 토글(기본 = 무료배송(내 부담)) — 세그먼트 문법. */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold tracking-ko text-text-strong">배송</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "free", label: "무료배송(내 부담)" },
                  { key: "paid", label: "배송비 별도(구매자 부담)" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setShippingMode(key)}
                  aria-pressed={shippingMode === key}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl border px-2 text-xs font-semibold tracking-ko transition-colors ${
                    shippingMode === key
                      ? "border-action bg-bg text-text-strong"
                      : "border-border bg-bg text-text-muted hover:border-text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                aria-label="배송비(원)"
                type="text"
                inputMode="numeric"
                value={shippingFeeInput}
                onChange={(e) => setShippingFeeInput(onlyDigits(e.target.value))}
                placeholder="배송비 예: 4000"
                className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
              />
              <span className="shrink-0 text-sm font-semibold text-text-muted">원</span>
            </div>
          </div>

          {/* Droppy 이중모드 — 세그먼트 [비율 %|고정 Droppy]. */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold tracking-ko text-text-strong">
              공유 보상 <span className="font-medium text-text-subtle">(Droppy)</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "rate", label: "비율 %" },
                  { key: "fixed", label: "고정 Droppy" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDropyMode(key)}
                  aria-pressed={dropyMode === key}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl border px-2 text-xs font-semibold tracking-ko transition-colors ${
                    dropyMode === key
                      ? "border-action bg-bg text-text-strong"
                      : "border-border bg-bg text-text-muted hover:border-text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dropyMode === "rate" ? (
              <>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="pd-dropy"
                    className="text-xs font-semibold tracking-ko text-text-strong"
                  >
                    공유 보상 비율
                  </label>
                  <span className="text-sm font-bold tabular-nums tracking-ko text-text-strong">
                    {dropyPercent}%
                  </span>
                </div>
                <input
                  id="pd-dropy"
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={dropyPercent}
                  onChange={(e) => setDropyPercent(Number(e.target.value))}
                  className="w-full accent-[#2563EB]"
                />
                {/* 풀 총액만 — % 기준은 상품 실결제액(판매가−예정 할인, 배송비 제외). */}
                {dropyPercent > 0 && receipt ? (
                  <p className="text-[12px] font-medium tabular-nums tracking-ko text-text-muted">
                    상품 실결제액 {receipt.netCustomerKrw.toLocaleString("ko-KR")}원 ×{" "}
                    {dropyPercent}% = {receipt.dropyCostKrw.toLocaleString("ko-KR")}원
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="고정 Droppy(원)"
                    type="text"
                    inputMode="numeric"
                    value={dropyFixedInput}
                    onChange={(e) => setDropyFixedInput(onlyDigits(e.target.value))}
                    placeholder="예: 2000"
                    className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                  <span className="shrink-0 text-sm font-semibold text-text-muted">Droppy</span>
                </div>
                {/* 유효 가드 — 정수 · >0 · ≤판매가. 무효면 저장 미포함(차단 아님 · 정적 안내). */}
                {dropyFixedInput.trim() && dropyFixedValid == null ? (
                  <p className="text-[11px] font-medium tracking-ko text-[#92400E]">
                    판매가 이하의 정수만 저장돼요. 지금 값은 저장되지 않아요.
                  </p>
                ) : null}
              </>
            )}
            <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
              판매 성사 시 기여도에 따라 분배됩니다 · 공유만으로는 적립되지 않습니다
            </p>
          </div>

          {/* 예정 할인 시뮬 — CP-1a(쿠폰) 전 수동 입력. 저장 안 함. */}
          <label htmlFor="pd-discount" className="block">
            <span className="text-xs font-semibold tracking-ko text-text-strong">
              예정 할인{" "}
              <span className="font-medium text-text-subtle">(시뮬레이션 · 저장하지 않아요)</span>
            </span>
            <input
              id="pd-discount"
              type="text"
              inputMode="numeric"
              value={plannedDiscountInput}
              onChange={(e) => setPlannedDiscountInput(onlyDigits(e.target.value))}
              placeholder="예: 2000"
              className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
            />
          </label>

          {/* 영수증 — 세로 뺄셈(정적). computeProfitReceipt 정본 단일 소스.
              DR2-fix1 F6 — 판매가만 있으면 항상 렌더 · 없으면 침묵 대신 안내 1줄.
              (기존 '실종' 원인: 판매가 미입력·비유효 시 receipt=null 로 통째 미렌더 + 안내 0.) */}
          {receipt == null ? (
            <p className="text-[12px] font-medium tracking-ko text-text-subtle">
              판매가를 입력하면 계산해 드려요
            </p>
          ) : null}
          {receipt ? (
            <div className="space-y-1 rounded-lg bg-surface px-3 py-2.5 text-[12px] font-medium tabular-nums tracking-ko text-text-strong">
              <div className="flex justify-between">
                <span>판매가</span>
                <span>{priceValid?.toLocaleString("ko-KR")}원</span>
              </div>
              {(plannedDiscountValid ?? 0) > 0 ? (
                <div className="flex justify-between text-text-muted">
                  <span>− 예정 할인</span>
                  <span>−{(plannedDiscountValid ?? 0).toLocaleString("ko-KR")}원</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-1">
                <span>= 손님 결제</span>
                <span>
                  {receipt.netCustomerKrw.toLocaleString("ko-KR")}원
                  {shippingMode === "paid" && (shippingFeeValid ?? 0) > 0
                    ? ` (+배송비 ${(shippingFeeValid ?? 0).toLocaleString("ko-KR")}원)`
                    : ""}
                </span>
              </div>
              {costValid != null ? (
                <div className="flex justify-between text-text-muted">
                  <span>− 원가</span>
                  <span>−{costValid.toLocaleString("ko-KR")}원</span>
                </div>
              ) : null}
              {receipt.sellerShippingKrw > 0 ? (
                <div className="flex justify-between text-text-muted">
                  <span>− 배송비(내 부담)</span>
                  <span>−{receipt.sellerShippingKrw.toLocaleString("ko-KR")}원</span>
                </div>
              ) : null}
              {receipt.dropyCostKrw > 0 ? (
                <div className="flex justify-between text-text-muted">
                  <span>
                    − Droppy{dropyMode === "rate" ? `(실결제액 × ${dropyPercent}%)` : "(고정)"}
                  </span>
                  <span>−{receipt.dropyCostKrw.toLocaleString("ko-KR")}원</span>
                </div>
              ) : null}
              {/* F6 — 원가 미입력이면 원가 행 생략(위) + 결과 라벨 "마진 전 남는 돈". */}
              <div className="flex justify-between border-t border-border pt-1 font-bold">
                <span>{costValid != null ? "= 건당 남는 돈" : "= 마진 전 남는 돈"}</span>
                <span>
                  {receipt.perUnitProfitKrw.toLocaleString("ko-KR")}원
                  {receipt.marginPct != null ? ` (마진 ${Math.round(receipt.marginPct)}%)` : ""}
                </span>
              </div>
            </div>
          ) : null}

          {/* 역마진 — 정적 앰버 배너(차단 아님). */}
          {receipt && receipt.perUnitProfitKrw < 0 ? (
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
              <p className="text-[11px] font-medium leading-relaxed tracking-ko text-[#92400E]">
                보상·할인이 이익보다 큽니다 — 숫자를 확인해 주세요
              </p>
            </div>
          ) : null}
        </section>

        {/* DR2-ⓑ ④ 판매계획 — 수량 = 기존 stock_limit 상태 단일 필드(머지 키 불변).
            전부 조건문 어미("다 팔면"·"~라면") · 정적. 예측 언어 금지. */}
        {isFresh ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
            <h3 className="text-sm font-bold tracking-ko text-text-strong">
              몇 개나 판매하시겠어요?
            </h3>
            <label htmlFor="pd-stock" className="block">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                <Hash className="size-3.5" strokeWidth={2} />
                판매 수량 <span className="font-medium text-text-subtle">(선택 · 한정 수량)</span>
              </span>
              <input
                id="pd-stock"
                type="text"
                inputMode="numeric"
                value={stockLimit}
                onChange={(e) => setStockLimit(onlyDigits(e.target.value))}
                placeholder="예: 30"
                className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
              />
            </label>

            {/* "다 팔면" — ③ 정본 순수 함수 × 수량(조건문 어미만). */}
            {receipt && Number(stockLimit) >= 1 ? (
              <div className="space-y-1 rounded-lg bg-surface px-3 py-2.5 text-[12px] font-medium tabular-nums tracking-ko text-text-strong">
                <p className="text-xs font-bold">
                  {Math.floor(Number(stockLimit)).toLocaleString("ko-KR")}개를 다 팔면
                </p>
                <div className="flex justify-between">
                  <span>매출</span>
                  <span>
                    {((priceValid ?? 0) * Math.floor(Number(stockLimit))).toLocaleString("ko-KR")}원
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Droppy 예산 총액</span>
                  <span>
                    {(receipt.dropyCostKrw * Math.floor(Number(stockLimit))).toLocaleString(
                      "ko-KR",
                    )}
                    원
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>총 순이익</span>
                  <span>
                    {(receipt.perUnitProfitKrw * Math.floor(Number(stockLimit))).toLocaleString(
                      "ko-KR",
                    )}
                    원
                  </span>
                </div>
              </div>
            ) : null}

            {/* "목표로 역산" — 건당 순익 > 0 일 때만(≤0 이면 숨김). */}
            {receipt && receipt.perUnitProfitKrw > 0 ? (
              <div className="space-y-2">
                <label htmlFor="pd-target" className="block">
                  <span className="text-xs font-semibold tracking-ko text-text-strong">
                    목표 순이익{" "}
                    <span className="font-medium text-text-subtle">(선택 · 저장하지 않아요)</span>
                  </span>
                  <input
                    id="pd-target"
                    type="text"
                    inputMode="numeric"
                    value={targetProfitInput}
                    onChange={(e) => setTargetProfitInput(onlyDigits(e.target.value))}
                    placeholder="예: 300000"
                    className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                </label>
                {/^\d{1,9}$/.test(targetProfitInput.trim()) && Number(targetProfitInput) > 0 ? (
                  <p className="text-[12px] font-medium tabular-nums tracking-ko text-text-muted">
                    {Number(targetProfitInput).toLocaleString("ko-KR")}원을 벌려면{" "}
                    {Math.ceil(Number(targetProfitInput) / receipt.perUnitProfitKrw).toLocaleString(
                      "ko-KR",
                    )}
                    개를 판매해야 해요
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 나-1 — 홍보 문구(선택). 상품명·가격·메모 기반 AI 카피 + 수동 수정. */}
        <ProductCopyEditor
          productName={name}
          priceKrw={Number.isFinite(Number(price)) && Number(price) > 0 ? Number(price) : null}
          imageUrl={uploadedUrl}
          // COPY-1 — CAT-1 카테고리로 카피 톤 3분기(공산품에 산지·수확 언어 차단).
          category={category}
          value={copy}
          onChange={setCopy}
        />

        <button
          type="submit"
          disabled={uploading || submitting || !uploadedUrl}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <CheckCircle2 className="size-4" strokeWidth={2} />
          )}
          {submitting ? "등록 중…" : "상품 등록"}
        </button>
      </form>

      {/* 등록 완료 — P2.1(S20) 컨펌 단일화: embedded 는 완료 섹션(단축주소·공유하기) 전면 미렌더.
          단축주소는 스튜디오 발행 단일 경로만 — 여기선 한 줄 상태 표시(입력값 보존, 수정 재제출 가능).
          비임베드(파트너 라우트)는 기존 완료 섹션 그대로. */}
      {result ? (
        embedded ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
            <CheckCircle2 className="size-4" strokeWidth={2} />
            상품이 카드에 붙었어요
          </p>
        ) : (
          <section className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#059669]" strokeWidth={2} />
              <h2 className="text-sm font-bold text-[#065F46]">상품 카드를 만들었어요</h2>
            </div>
            <p className="mt-2 break-all text-xs text-[#047857]">{result.shareUrl}</p>
            <div className="mt-3 flex gap-2">
              <a
                href={`/d/${result.shareUuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white"
              >
                카드 보기
              </a>
              <button
                type="button"
                onClick={handleShare}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#0E4D42] bg-white px-4 text-sm font-bold text-[#0E4D42] hover:bg-[#E1F5EE]"
              >
                공유하기
              </button>
            </div>
          </section>
        )
      ) : null}
    </>
  );
}
