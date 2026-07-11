import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Check,
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
export type SaleUnit45 = "unit" | "box" | "weight";
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
const UNIT_OPTIONS: { id: SaleUnit45; label: string }[] = [
  { id: "unit", label: "낱개로" },
  { id: "box", label: "박스·묶음으로" },
  { id: "weight", label: "무게 단위로" },
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
function profitOf(price: string, cost: string) {
  const p = Number(onlyDigits(price));
  const c = Number(onlyDigits(cost));
  if (!p || !c) return null;
  return p - c;
}
// KAMIS 검색 정규화 — 기존 CAT-2 규칙 동일(공백·괄호 제거 + 소문자).
function normalizeItemText(s: string): string {
  return s.toLowerCase().replace(/[\s()（）]/g, "");
}

type KamisItemFull = { item_code: string; item_name: string; category_code: string };

export function ProductRegisterForm45({
  accent,
  onSubmit,
  onImageChange,
}: {
  accent: string;
  onSubmit: (payload: ProductRegisterPayload45) => Promise<ProductRegisterResult45>;
  /** 사진 업로드 즉시 미러(제출 전 미리보기·발행 가드 충족 — 기존 임베드 계약 동일). */
  onImageChange?: (url: string) => void;
}) {
  // ── 폼 상태 (정본 ProductForm 동형) ──
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<ProductType45>("fresh");
  const [harvestDate, setHarvestDate] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [storage, setStorage] = useState<StorageType45>("room");
  const [brand, setBrand] = useState("");
  const [spec, setSpec] = useState("");
  const [saleUnit, setSaleUnit] = useState<SaleUnit45>("unit");
  const [boxCount, setBoxCount] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [weightUnknown, setWeightUnknown] = useState(false);
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
  const unitOptions = copy.allowWeight ? UNIT_OPTIONS : UNIT_OPTIONS.filter((o) => o.id !== "weight");
  const profit = profitOf(price, cost);
  const priceNum = Number(onlyDigits(price)) || 0;

  const selectType = (t: ProductType45) => {
    setType(t);
    if (!TYPE_COPY[t].allowWeight && saleUnit === "weight") setSaleUnit("unit");
    if (t !== "fresh") setKamisItemCode(null);
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
      toast.success("사진을 업로드했어요.");
    } catch (err) {
      console.error("[ProductRegisterForm45] upload:", err);
      toast.error("사진 처리 중 문제가 생겼어요.");
      setImagePreview(null);
    } finally {
      setUploading(false);
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
    }
  }

  async function handleSubmit() {
    if (saving) return;
    setFormError(null);
    // 필수 가드 — 사진·이름·가격·원산지(정본 required + 상품정보제공고시).
    if (!imageUrl) return setFormError("상품 사진을 올려주세요.");
    if (!name.trim()) return setFormError("상품명을 입력해주세요.");
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
    // 날짜 키 매핑 — fresh=harvest_date(기존 키) / processed=expiry_date / goods=ship_date(신규 키).
    const dateVal = harvestDate.trim() || null;

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
      ...(itemCategory.trim() ? { category: itemCategory.trim() } : {}),
      ...(rate != null ? { dropy_rate: rate } : {}),
      ...(fixed != null ? { dropy_fixed: fixed } : {}),
      // ── 45 신규 키 ──
      product_type: type,
      sale_unit: saleUnit,
      ...(saleUnit === "box" && boxCount ? { box_count: Math.floor(Number(boxCount)) } : {}),
      ...(saleUnit !== "unit" && !weightUnknown && totalWeight ? { total_weight_kg: Number(totalWeight) } : {}),
      ...(type === "processed" ? { storage_method: storage } : {}),
      ...(type === "processed" && dateVal ? { expiry_date: dateVal } : {}),
      ...(type === "goods" && dateVal ? { ship_date: dateVal } : {}),
      ...(type === "goods" ? { made_in: origin.trim() } : {}),
      ...(type === "goods" && brand.trim() ? { brand: brand.trim() } : {}),
      ...(type === "goods" && spec.trim() ? { spec: spec.trim() } : {}),
      free_ship: freeShip,
      ...(!freeShip && shipFee ? { ship_fee_krw: Math.floor(Number(shipFee)) } : {}),
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
    try {
      const res = await onSubmit(payload);
      setSavedUuid(res.shareUuid);
      toast.success("상품을 등록했어요.");
    } catch (err) {
      console.error("[ProductRegisterForm45] submit:", err);
      setFormError("상품 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.namePh} className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
      </Field>

      <Field label="상품 유형">
        <Segmented options={TYPE_OPTIONS} value={type} onSelect={selectType} />
      </Field>

      <Field label={copy.dateLabel} hint={copy.dateHint}>
        <input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
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

      {/* 분류 — fresh 는 KAMIS 실검색(기존 CAT-2 소스) */}
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

      <Field label={copy.originLabel} required hint="상품정보제공고시">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={copy.originPh} className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
      </Field>

      {type === "goods" && (
        <Field label="구성·규격" hint="선택">
          <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="예: 캔들 2개 · 개당 120g · 박스 포장" className={inputCls} style={{ boxShadow: "inset 0 0 0 1px transparent" }} onFocus={focusRing} onBlur={blurRing} />
        </Field>
      )}

      {/* 판매 단위 */}
      <Field label="어떻게 판매하시겠어요?">
        <Segmented options={unitOptions} value={saleUnit} onSelect={setSaleUnit} />
        {saleUnit === "box" && (
          <div className="mt-2 space-y-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput label="한 박스 개수" value={boxCount} onChange={(v) => setBoxCount(onlyDigits(v))} placeholder="한 박스 N개" suffix="개" accent={accent} />
            {!weightUnknown && (
              <SubInput label="총 무게(kg)" value={totalWeight} onChange={(v) => setTotalWeight(v.replace(/[^0-9.]/g, ""))} placeholder="총 무게 kg" suffix="kg" accent={accent} />
            )}
            <Checkbox checked={weightUnknown} onToggle={() => setWeightUnknown((v) => !v)} label="무게는 잘 몰라요" accent={accent} />
          </div>
        )}
        {saleUnit === "weight" && (
          <div className="mt-2 rounded-xl bg-[#F7F7F8] p-2.5">
            <SubInput label="총 무게(kg)" value={totalWeight} onChange={(v) => setTotalWeight(v.replace(/[^0-9.]/g, ""))} placeholder="총 무게 kg" suffix="kg" accent={accent} />
          </div>
        )}
      </Field>

      {/* 가격 + 이익 계산(미저장 보조) */}
      <Field label="가격" required>
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3 focus-within:bg-white" style={{ boxShadow: "inset 0 0 0 1px transparent" }}>
          <span className="text-[14px] font-bold text-[#525252]">₩</span>
          <input value={price} onChange={(e) => setPrice(onlyDigits(e.target.value))} inputMode="numeric" placeholder="19900" className="w-full bg-transparent px-1.5 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
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
          {profit !== null && (
            <p className="mt-1.5 text-[11.5px] font-semibold" style={{ color: profit >= 0 ? accent : "#EF4444" }}>
              개당 이익 {profit.toLocaleString()}원
            </p>
          )}
        </div>
      </Field>

      {/* 배송 */}
      <Field label="배송">
        <Segmented
          options={[
            { id: "free", label: "무료배송(내 부담)" },
            { id: "paid", label: "배송비 별도(구매자 부담)" },
          ]}
          value={freeShip ? "free" : "paid"}
          onSelect={(id) => setFreeShip(id === "free")}
        />
        {!freeShip && (
          <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
            <span className="text-[12px] font-semibold text-[#8A8A8A]">배송비</span>
            <input value={shipFee} onChange={(e) => setShipFee(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 4000" className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
            <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
          </div>
        )}
      </Field>

      {/* 공유 보상 (Droppy) — 검증: rate 0<r≤20% / fixed 0<f≤price */}
      <Field label="공유 보상 (Droppy)">
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

      {/* 예정 할인(시뮬레이션 · 미저장) */}
      <Field label="예정 할인" hint="시뮬레이션 · 저장하지 않아요">
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <span className="text-[12px] font-semibold text-[#8A8A8A]">할인</span>
          <input value={plannedDiscount} onChange={(e) => setPlannedDiscount(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 2000" className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
        </div>
        <p className="mt-1 text-[10.5px] text-[#A3A3A3]">
          {plannedDiscount && price ? `할인가 ${(priceNum - Number(plannedDiscount)).toLocaleString()}원` : "판매가를 입력하면 계산해 드려요"}
        </p>
      </Field>

      {/* 판매 수량(한정) */}
      <Field label="몇 개나 판매하시겠어요?" hint="선택 · 한정 수량">
        <div className="flex items-center rounded-xl bg-[#F4F4F5] px-3">
          <input value={quantity} onChange={(e) => setQuantity(onlyDigits(e.target.value))} inputMode="numeric" placeholder="예: 30" className="w-full bg-transparent px-1 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]" />
          <span className="text-[13px] font-semibold text-[#8A8A8A]">개</span>
        </div>
      </Field>

      {/* 홍보 문구 */}
      <Field label="홍보 문구" hint="선택">
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

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
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
