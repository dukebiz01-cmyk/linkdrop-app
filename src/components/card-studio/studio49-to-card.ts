// UI-5-T2-E3 — 49 스튜디오 상태 → 정본 CardModel 변환(위지윅: 미리보기 = /d 수신 렌더러).
//   거울 어댑터 fromStudioState + buildShippingView 재사용(거울 무수정 · import 소비만).
//   45 CardStudioPage45.tsx:2632–2705 의 fromStudioState(input, preview) 매핑을 49 상태로 계승.
import type { LucideIcon } from "lucide-react";
import type { CardModel } from "@/components/card-model/card-model.types";
import { buildShippingView, fromStudioState, type StudioStateInput } from "@/components/card-model/card-model-adapters";

export type Studio49VideoSlot = {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  isShorts: boolean;
  durationLabel?: string;
  sourceLabel?: string;
};

export type Studio49Input = {
  mode: "general" | "reserve" | "commerce";
  applied: Record<string, boolean>;
  productImageUrl?: string; // UI-5-T2-E5a — 커머스 상품 사진(실 업로드 URL) → 카드 얼굴.
  // UI-5-T2-E5g2 — 수확 기간의 "시작일"(yyyy-mm-dd). 정본 수확·발송 칩(commerce.harvestDate)은 단일 날짜
  //   전제("M월 D일 예정") → 거울 무수정 범위 내 최선 매핑 = 시작일 대표(상세 기간은 스튜디오 캡션 담당).
  harvestDate?: string;
  title: string; // cfgTitle
  subtitle: string; // cfgSubtitle
  clip: string; // cfgClip
  brand: string; // cfgBrand
  party: number; // cfgParty
  couponLabel: string | null; // COUPON_OPTIONS label (applied.coupon 시)
  productName: string; // cfgProductName
  productPrice: string; // cfgProductPrice "32,000"
  productHeadline: string; // cfgProduct.headline
  productPoints: string[]; // cfgProduct.sellingPoints (trim·filter)
  // UI-5-T2-E5e — 비커머스 셀링포인트(45 pickedPoints 동형) → 정본 productPoints(:544-545) 렌더.
  keyPoints?: string[];
  productUnitLabel: string; // 등록 폼 unit_label 파생
  facilities: string[]; // cfgFacilities (trim·filter)
  saleStart: string; // DATE_OPTIONS[saleStartIdx]
  saleEnd: string; // DATE_OPTIONS[saleEndIdx]
  dates: string[]; // cfgDates
  times: string[]; // cfgTimes
  slotsByDate: Record<string, number>; // cfgSlotsByDate
  selectedVideo: Studio49VideoSlot | null;
  shipping: { shipMethod?: string | null; freeShip?: boolean; shipFeeKrw?: number | null; shipNote?: string | null } | null;
  // MODE_CONTENT 폴백
  categoryLabel: string;
  categoryIcon: LucideIcon;
  source: string;
  storeName: string;
  titleFallback: string;
  subtitleFallback: string;
  pageBg: string;
};

export function studio49ToCardModel(s: Studio49Input): CardModel {
  const isCommerce = s.mode === "commerce";
  const priceNum = s.productPrice ? Number(s.productPrice.replace(/[^0-9]/g, "")) || null : null;

  // 45:2639 — 커머스 매장정보 셀 억제(link false), 수신 억제와 동형.
  const input: StudioStateInput = {
    buildMode: s.mode,
    // UI-5-T2-E3d — 카드 배경색 선택 기능 제거(삭제 사양). 빈 값 전달 → 정본 어댑터 DEFAULT_CARD_COLOR 고정.
    cardColor: "",
    applied: isCommerce ? { ...s.applied, link: false } : s.applied,
    tagline: s.subtitle,
    selectedVideo: s.selectedVideo ?? null,
    selectedCoupon: s.applied["coupon"] && s.couponLabel ? { title: s.couponLabel } : null,
    storeName: s.storeName || undefined,
    productName: s.productName || undefined,
    productPrice: priceNum,
    productCopy: { headline: s.productHeadline || undefined, sellingPoints: s.productPoints },
    // E5e — 비커머스 셀링포인트: 정본 pickedPoints 입력(45 :2645 동형) → productPoints 병합.
    ...(s.keyPoints && s.keyPoints.length > 0 ? { pickedPoints: s.keyPoints } : {}),
    // UI-5-T4-D3f(①) — 사진 정본 배선 수복: fromStudioState 히어로(:509)는 "input.productImageUrl"을
    //   소비한다(commerce.imageUrl 은 fromDropDetail(:266) 전용 — 스튜디오 프리뷰엔 미도달이던 결함).
    //   productImageUrl(E5a 단일 소스) → heroImageUrl → CardBody 실이미지(미리보기·거울 즉시 반영).
    ...(isCommerce && s.productImageUrl ? { productImageUrl: s.productImageUrl } : {}),
    // E5a·E5g2 — commerce 블록(imageUrl·harvestDate): fromDropDetail 계열 소비 대비 유지(프리뷰 무해).
    ...(isCommerce && (s.productImageUrl || s.harvestDate)
      ? {
          commerce: {
            ...(s.productImageUrl ? { imageUrl: s.productImageUrl } : {}),
            ...(s.harvestDate ? { harvestDate: s.harvestDate } : {}),
          },
        }
      : {}),
  };

  const shippingView = isCommerce && s.shipping ? buildShippingView(s.shipping) : null;

  // 45:2660–2705 프리뷰 오버라이드(미영속 로컬 설정 → 거울에 흐름).
  const preview: Partial<CardModel> = {
    pageBg: s.pageBg,
    category: s.categoryLabel,
    categoryIcon: s.categoryIcon,
    source: s.source,
    titleText:
      s.title.trim() || (s.applied["product"] && s.productName ? s.productName : "") || s.titleFallback,
    subtitleText:
      s.subtitle.trim() ||
      (s.applied["product"] && s.productHeadline.trim() ? s.productHeadline.trim() : s.subtitleFallback),
    ...(s.clip ? { clip: s.clip } : {}),
    ...(s.applied["brand"] && s.brand.trim() ? { brandText: s.brand.trim() } : {}),
    ...(s.applied["party"] ? { party: s.party } : {}),
    // F3-10a(FIX-62 지혈 — E5x 감사 1순위) — 구 미영속 프리뷰(cfgDates/Times/SlotsByDate)의 발행
    //   유출 봉쇄: applied["calendar"] 여도 가짜 슬롯 데이터는 미편입(하드코딩 DATE/TIME_OPTIONS 유래
    //   — 실카드 오염 차단). 실슬롯 이식(F3-10 본대) 시 실데이터로 재개. 타입·입력 필드는 보존.
    ...(s.applied["seasonal"] && s.saleStart && s.saleEnd ? { saleStart: s.saleStart, saleEnd: s.saleEnd } : {}),
    // 45:2686 — link 게이트(예약 기본 ON), 커머스 시설 셀 미주입.
    ...((s.applied["link"] ?? s.mode === "reserve") && !isCommerce && s.facilities.length
      ? { facilities: s.facilities }
      : {}),
    ...(isCommerce && s.productUnitLabel ? { productUnitLabel: s.productUnitLabel } : {}),
    ...(isCommerce ? { ctaLabel: "주문예약" } : {}),
    ...(shippingView ? { shipping: shippingView } : {}),
  };

  return fromStudioState(input, preview);
}
