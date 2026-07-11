"use client";

import { ImageIcon, Sparkles, Plus, X, Search, Calculator, Info } from "lucide-react";

export type ProductType = "fresh" | "processed" | "goods";
export type SaleUnit = "unit" | "box" | "weight";
export type DroppyMode = "rate" | "fixed";
export type StorageType = "room" | "cold" | "frozen";

export type ProductForm = {
  name: string;
  price: string;
  type: ProductType;
  /** fresh: 수확·발송 예정일 / processed: 소비기한 / goods: 발송 예정일 */
  harvestDate: string;
  /** fresh: 품목(시세 연동) / processed: 식품 유형 / goods: 카테고리 */
  itemCategory: string;
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
};

export const EMPTY_PRODUCT: ProductForm = {
  name: "",
  price: "",
  type: "fresh",
  harvestDate: "",
  itemCategory: "",
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

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");

/** 이익 = 판매가 - 원가 */
function profitOf(price: string, cost: string) {
  const p = Number(onlyDigits(price));
  const c = Number(onlyDigits(cost));
  if (!p || !c) return null;
  return p - c;
}

export function ProductRegisterForm({
  value,
  onChange,
  accent,
}: {
  value: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  accent: string;
}) {
  const set = <K extends keyof ProductForm>(key: K, v: ProductForm[K]) => onChange({ [key]: v } as Partial<ProductForm>);
  const profit = profitOf(value.price, value.cost);
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
      {/* 상품 사진 */}
      <Field label="상품 사진">
        <div className="flex aspect-[16/10] items-center justify-center rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#F4F4F5]">
          <span className="flex flex-col items-center gap-1.5 text-[#8A8A8A]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6E6E6] text-[#525252]">
              <ImageIcon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-semibold">사진 선택</span>
          </span>
        </div>
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

      {/* 날짜 — 유형별: 수확·발송 예정일 / 소비기한 / 발송 예정일 */}
      <Field label={copy.dateLabel} hint={copy.dateHint}>
        <input
          type="date"
          value={value.harvestDate}
          onChange={(e) => set("harvestDate", e.target.value)}
          className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none focus:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
      </Field>

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

      {/* 분류 — 유형별: 품목(시세 연동) / 식품 유형 / 카테고리 */}
      <Field label={copy.categoryLabel} hint={copy.categoryHint}>
        <input
          value={value.itemCategory}
          onChange={(e) => set("itemCategory", e.target.value)}
          placeholder={copy.categoryPh}
          className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3] focus:bg-white"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
        {copy.categorySearch && (
          <button
            type="button"
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] py-2 text-[12px] font-semibold text-[#525252] transition-colors active:bg-[#ECECEC]"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2.25} />
            {copy.categorySearch}
          </button>
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
      </Field>

      {/* 가격 */}
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

        {/* 이익 계산 — 저장하지 않는 보조 계산기 */}
        <div className="mt-1.5 rounded-xl bg-[#F7F7F8] p-2.5">
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#525252]">
            <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
            이익 계산
            <span className="ml-1 font-medium text-[#A3A3A3]">선택 · 저장하지 않아요</span>
          </span>
          <div className="mt-1.5 flex items-center rounded-lg bg-white px-2.5">
            <span className="text-[11px] font-semibold text-[#8A8A8A]">원가</span>
            <input
              value={value.cost}
              onChange={(e) => set("cost", onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="예: 12000"
              className="w-full bg-transparent px-2 py-2 text-[12.5px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
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
          value={value.freeShip ? "free" : "paid"}
          onSelect={(id) => set("freeShip", id === "free")}
          accent={accent}
        />
        {!value.freeShip && (
          <div className="mt-2 flex items-center rounded-xl bg-[#F4F4F5] px-3">
            <span className="text-[12px] font-semibold text-[#8A8A8A]">배송비</span>
            <input
              value={value.shipFee}
              onChange={(e) => set("shipFee", onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="예: 4000"
              className="w-full bg-transparent px-2 py-2.5 text-[13px] font-bold tabular-nums text-[#0A0A0A] outline-none placeholder:font-medium placeholder:text-[#A3A3A3]"
            />
            <span className="text-[13px] font-semibold text-[#8A8A8A]">원</span>
          </div>
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
                style={{ width: `${(value.droppyRate / 30) * 100}%`, backgroundColor: accent }}
              />
              {/* 썸 */}
              <div
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white transition-[left] duration-100"
                style={{ left: `${(value.droppyRate / 30) * 100}%`, borderColor: accent, boxShadow: `0 2px 6px -1px ${accent}66` }}
              />
              {/* 상호작용용 투명 range */}
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={value.droppyRate}
                onChange={(e) => set("droppyRate", Number(e.target.value))}
                aria-label="공유 보상 비율"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>

            <div className="mt-1.5 flex justify-between text-[10px] font-medium text-[#A3A3A3] tabular-nums">
              <span>0%</span>
              <span>30%</span>
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

      {/* 판매 수량 */}
      <Field label="몇 개나 판매하시겠어요?" hint="선택 · 한정 수량">
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

      {/* AI 카피 도우미 — 헤드라인·셀링포인트를 한 카드로 강조 */}
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
            <p className="text-[10.5px] font-medium text-[#8A8A8A]">홍보 문구를 바탕으로 자동 작성</p>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold text-white shadow-sm transition-transform active:translate-y-px"
          style={{ backgroundColor: accent }}
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          AI 카피 생성
        </button>

        {/* 헤드라인 */}
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

        {/* 셀링포인트 */}
        <div className="mt-3">
          <span className="mb-1 block text-[11px] font-semibold text-[#525252]">셀링포인트</span>
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
