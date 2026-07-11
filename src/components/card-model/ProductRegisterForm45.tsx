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
import { computeProfitReceipt } from "@/components/commerce/ProductRegisterForm";
// FIX-37 — 상품 상세정보 고시표(유형별) 행 빌더 — 순수 모듈 분리(라벨 = 실제 고시 항목 명칭).
import { buildNoticeRows45 } from "./product-notice45";

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
};

export function ProductRegisterForm45({
  accent,
  onSubmit,
  onImageChange,
  onBusyChange,
  onProgress,
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
  // FIX-15 — 묶음형 구성: "1{단위} = N개"(unitQty) 또는 "1{단위} = N kg"(unitWeight).
  const [unitQty, setUnitQty] = useState("");
  const [unitWeight, setUnitWeight] = useState("");
  // FIX-15 b) — 공산품 카테고리 프리셋 선택값("기타"면 직접입력 itemCategory 사용).
  const [goodsPreset, setGoodsPreset] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  const [freeShip, setFreeShip] = useState(true);
  const [shipFee, setShipFee] = useState("");
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
  const receipt =
    priceNum > 0 && costNum != null
      ? computeProfitReceipt({
          priceKrw: priceNum,
          discountKrw: discountNum,
          costKrw: costNum,
          shippingMode: freeShip ? "free" : "paid",
          shippingFeeKrw: shipFeeNum ?? 0,
          dropyMode: droppyMode,
          dropyPercent: droppyRate,
          dropyFixedKrw: droppyFixedNum,
        })
      : null;

  // FIX-34 — 진행 신호 방출(변경 필드는 override 로 전달 — setState 직후 stale 값 방지).
  const emitProgress = (over: Partial<ProductFormProgress45> = {}) =>
    onProgress?.({
      nameSet: nameConfirmed && !!name.trim(),
      priceSet: priceNum > 0,
      photoSet: !!imageUrl,
      name: name.trim(),
      ...over,
    });
  // 마운트 시 1회 동기화 — 폼 재마운트(패널 접힘/재장착) 후 호스트의 낡은 진행 상태 초기화.
  useEffect(() => {
    emitProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isBundle = type !== "fresh" && BUNDLE_UNITS.has(saleUnit);

  // FIX-15 c) — 유형 전환 시 해당 없는 단위·구성값 초기화(잔존 오염 방지).
  const selectType = (t: ProductType45) => {
    setType(t);
    setSaleUnit("unit");
    setFreshPackType("박스"); // FIX-36 — 포장 단위도 초기화(잔존 오염 방지 동일 규칙).
    setBoxCount("");
    setTotalWeight("");
    setWeightUnknown(false);
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
      ...(type === "processed" ? { storage_method: storage } : {}),
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

  const focusRing = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent}`);
  const blurRing = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = "inset 0 0 0 1px transparent");
  const inputCls =
    "w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white";

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
      <Field label="상품 사진" required>
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

      <Field label="상품명" required>
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

      <Field label={copy.originLabel} required hint="상품정보제공고시">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={copy.originPh} className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
      </Field>

      {type === "goods" && (
        <Field label="구성·규격" hint="선택">
          <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="예: 캔들 2개 · 개당 120g · 박스 포장" className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
        </Field>
      )}

      {/* 판매 단위 — FIX-38: 원포토에선 미노출(기본 낱개 유지). */}
      <Field label="어떻게 판매하시겠어요?" hidden={quickMode}>
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
            <Checkbox checked={weightUnknown} onToggle={() => setWeightUnknown((v) => !v)} label="무게는 잘 몰라요" accent={accent} />
            <p className="text-[10.5px] font-medium text-[#A3A3A3]">
              예: 1망 = 10kg — 카드에 &ldquo;구성: 1{freshPackLabel} · 10kg&rdquo;처럼 보여요.
            </p>
          </div>
        )}
        {saleUnit === "weight" && (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput label="총 무게(kg)" value={totalWeight} onChange={(v) => setTotalWeight(v.replace(/[^0-9.]/g, ""))} placeholder="총 무게 kg" suffix="kg" accent={accent} />
          </div>
        )}
      </Field>

      {/* FIX-37 — 상품 상세정보 고시(상품정보제공고시) — 인라인 펼침(Radix 금지).
          위 폼 입력(상품명·원산지·분류·소비기한·보관방법·브랜드)은 자동 미러(중복 입력 0),
          나머지 항목만 여기서 입력. 미입력은 그대로 정직 표기 — 자동 생성 금지(§0).
          FIX-38 — 원포토에선 hidden(DOM 유지·표시만 숨김 — 스냅샷은 미러값으로 동일 저장). */}
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

      {/* 가격 + 이익 계산(미저장 보조) */}
      <Field label="가격" required>
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3 focus-within:bg-white" style={{ boxShadow: "inset 0 0 0 1px transparent" }}>
          <span className="text-[14px] font-bold text-[#525252]">₩</span>
          <input
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
        <div className="mt-1.5 rounded-xl bg-[#F7F7F8] p-2.5">
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#525252]">
            <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
            이익 계산
            <span className="ml-1 font-medium text-[#A3A3A3]">선택 · 저장하지 않아요</span>
          </span>
          <div className="mt-1.5 flex items-center rounded-lg bg-white px-2.5">
            <span className="text-[11px] font-semibold text-[#8A8A8A]">원가</span>
            <input value={cost} onChange={(e) => setCost(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 12000" className="w-full bg-transparent px-2 py-2 text-[12.5px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
            <span className="text-[12px] font-semibold text-[#8A8A8A]">원</span>
          </div>
          {/* FIX-36 — 이익 내역(표시용·미저장): 판매가+원가 입력 시에만 렌더.
              배송비는 무료배송(내 부담)만 차감, 구매자 부담은 제외 안내만. 드로피 차감 병기. */}
          {receipt !== null && costNum != null && (
            <div className="mt-1.5 space-y-1 rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold tabular-nums text-[#525252]">
              <div className="flex justify-between">
                <span>판매가</span>
                <span>{priceNum.toLocaleString()}원</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between">
                  <span>예정 할인</span>
                  <span>−{Math.min(discountNum, priceNum).toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>원가</span>
                <span>−{costNum.toLocaleString()}원</span>
              </div>
              {freeShip ? (
                shipFeeNum != null ? (
                  <div className="flex justify-between">
                    <span>배송비(내 부담)</span>
                    <span>−{shipFeeNum.toLocaleString()}원</span>
                  </div>
                ) : (
                  <p className="text-[10.5px] font-medium text-[#A3A3A3]">
                    아래 배송 칸에 배송비를 적으면 이익에서 함께 빼서 계산해요
                  </p>
                )
              ) : (
                <p className="text-[10.5px] font-medium text-[#A3A3A3]">
                  배송비는 구매자 부담 — 이익 계산에서 제외돼요
                </p>
              )}
              {receipt.dropyCostKrw > 0 && (
                <div className="flex justify-between">
                  <span>드로피 차감{droppyMode === "rate" ? ` (${droppyRate}%)` : " (고정)"}</span>
                  <span>−{receipt.dropyCostKrw.toLocaleString()}원</span>
                </div>
              )}
              <div
                className="flex justify-between border-t border-[#EFEFEF] pt-1 text-[12px] font-bold"
                style={{ color: receipt.perUnitProfitKrw >= 0 ? accent : "#EF4444" }}
              >
                <span>예상 이익</span>
                <span>{receipt.perUnitProfitKrw.toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>
      </Field>

      {/* 배송 — FIX-38: 원포토에선 미노출(기본 무료배송 유지). */}
      <Field label="배송" hidden={quickMode}>
        <Segmented
          options={[
            { id: "free", label: "무료배송(내 부담)" },
            { id: "paid", label: "배송비 별도(구매자 부담)" },
          ]}
          value={freeShip ? "free" : "paid"}
          onSelect={(id) => setFreeShip(id === "free")}
        />
        {/* FIX-36 — 배송비 입력을 양 모드 노출: 무료배송 = 내 부담 비용(이익 계산 편입 · 저장 안 함) /
            구매자 부담 = 손님 카드 "배송비 N원" 표기 근거(ship_fee_krw 저장 — 기존 payload 계약 그대로). */}
        <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <span className="shrink-0 text-[12px] font-semibold text-[#8A8A8A]">배송비</span>
          <input value={shipFee} onChange={(e) => setShipFee(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 4000" className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        <p className="mt-1 text-[10.5px] font-medium text-[#A3A3A3]">
          {freeShip
            ? "내가 부담하는 배송비 — 이익 계산에만 쓰고 저장하지 않아요"
            : "구매자가 결제 시 함께 내는 금액 — 손님 카드에 배송비로 표기돼요"}
        </p>
      </Field>

      {/* 공유 보상 (Droppy) — 검증: rate 0<r≤20% / fixed 0<f≤price. FIX-38: 원포토 미노출(0 유지). */}
      <Field label="공유 보상 (Droppy)" hidden={quickMode}>
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

      {/* 예정 할인(시뮬레이션 · 미저장) — FIX-38: 원포토 미노출. */}
      <Field label="예정 할인" hint="시뮬레이션 · 저장하지 않아요" hidden={quickMode}>
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <span className="text-[12px] font-semibold text-[#8A8A8A]">할인</span>
          <input value={plannedDiscount} onChange={(e) => setPlannedDiscount(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 2000" className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        <p className="mt-1 text-[10.5px] text-[#A3A3A3]">
          {plannedDiscount && price ? `할인가 ${(priceNum - Number(plannedDiscount)).toLocaleString()}원` : "판매가를 입력하면 계산해 드려요"}
        </p>
      </Field>

      {/* 판매 수량(한정) — FIX-38: 원포토 미노출. */}
      <Field label="몇 개나 판매하시겠어요?" hint="선택 · 한정 수량" hidden={quickMode}>
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input value={quantity} onChange={(e) => setQuantity(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 30" className="w-full bg-transparent px-1 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">개</span>
        </div>
      </Field>

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
  hint,
  hidden,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
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
