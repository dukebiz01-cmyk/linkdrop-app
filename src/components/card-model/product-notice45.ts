// FIX-37 — 상품 상세정보 고시표(「전자상거래 등에서의 상품정보제공고시」) 유형별 행 빌더(순수).
//   라벨 = 실제 고시 항목 명칭 그대로(임의 축약·창작 금지). 값 = 생산자 실입력·폼 미러만 —
//   미입력은 "" 그대로 스냅샷(정직 표기 · AI 자동 생성 절대 금지, §0).
//   소비자상담 전화 = partners.contact_phone(읽기전용) 자동 — 수정은 매장정보에서.
//   /d 렌더는 거울(adapters·info-drop-page) 수술이 필요해 ST2b 이관 — 여기는 스냅샷 정의까지.
import type { ProductType45 } from "./ProductRegisterForm45";

export type NoticeRow45 = { label: string; value: string };

export type NoticeInput45 = {
  type: ProductType45;
  /** 상품명(폼 미러). */
  name: string;
  /** 품목 분류(fresh) / 식품의 유형(processed) — 폼 itemCategory 미러. */
  itemCategory: string;
  /** 원산지(fresh·processed) / 제조국(goods) — 폼 origin 미러. */
  origin: string;
  /** processed 소비기한(폼 날짜 미러, yyyy-mm-dd). */
  expiryDate: string;
  /** processed 보관 방법 라벨(실온/냉장/냉동 — 폼 세그먼트 미러). */
  storageLabel: string;
  /** goods 브랜드·제조사(폼 미러). */
  brand: string;
  /** 생산자(수입자)·소재지 — 고시표 직접 입력. */
  producer: string;
  /** fresh 제조연월일(포장일 또는 생산연도) — 고시표 직접 입력. */
  madeDate: string;
  /** fresh 보관방법 또는 취급방법 — 고시표 직접 입력. */
  handling: string;
  /** processed 원재료명 및 함량 — 고시표 직접 입력. */
  ingredients: string;
  /** goods 모델명 — 고시표 직접 입력. */
  model: string;
  /** goods A/S 책임자 — 고시표 직접 입력. */
  asManager: string;
  /** partners.contact_phone(읽기전용 자동 채움). */
  contactPhone: string | null;
};

export function buildNoticeRows45(i: NoticeInput45): NoticeRow45[] {
  const t = (s: string | null | undefined) => (s ?? "").trim();
  const phone = t(i.contactPhone);
  if (i.type === "fresh") {
    // 농수산물 고시 항목.
    return [
      { label: "품목 또는 명칭", value: t(i.itemCategory) || t(i.name) },
      { label: "원산지", value: t(i.origin) },
      { label: "생산자(수입자)", value: t(i.producer) },
      { label: "제조연월일(포장일 또는 생산연도)", value: t(i.madeDate) },
      { label: "보관방법 또는 취급방법", value: t(i.handling) },
      { label: "소비자상담 관련 전화번호", value: phone },
    ];
  }
  if (i.type === "processed") {
    // 가공식품 고시 항목.
    return [
      { label: "제품명", value: t(i.name) },
      { label: "식품의 유형", value: t(i.itemCategory) },
      { label: "생산자 및 소재지", value: t(i.producer) },
      { label: "원재료명 및 함량", value: t(i.ingredients) },
      { label: "제조연월일, 소비기한 또는 품질유지기한", value: t(i.expiryDate) },
      { label: "보관방법", value: t(i.storageLabel) },
      { label: "소비자상담 관련 전화번호", value: phone },
    ];
  }
  // 공산품·잡화 — 기타 재화 고시 항목.
  return [
    { label: "품명 및 모델명", value: [t(i.name), t(i.model)].filter(Boolean).join(" · ") },
    { label: "제조자(수입자)", value: t(i.brand) },
    { label: "제조국 또는 원산지", value: t(i.origin) },
    {
      label: "A/S 책임자와 전화번호 또는 소비자상담 관련 전화번호",
      value: [t(i.asManager), phone].filter(Boolean).join(" · "),
    },
  ];
}
