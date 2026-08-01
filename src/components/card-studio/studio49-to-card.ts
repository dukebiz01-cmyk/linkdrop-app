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
  // 모드 라벨(카테고리 칩 — 데모 아님). UI-5-T7-F5-5-S1: 데모 폴백(source/titleFallback/
  //   subtitleFallback) 폐기 — storeName 은 실매장 display_name 배선(빈값 = 정본 미렌더).
  categoryLabel: string;
  categoryIcon: LucideIcon;
  storeName: string;
  // F5-5-S3 — 판매유형 유래 캡션(실값 유래 한정 · 미주입 = 정본 source 유지).
  sourceCaption?: string;
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

  // UI-5-T7-F5-5-S1 — 데모 폴백 승격 차단: 제목·한마디는 실값 있을 때만 override — 비움은 거울
  //   정본(fromStudioState)의 진실 폴백(commerce="상품 이름" 라벨 · 비커머스=매장명→영상 제목→빈값)
  //   이 흐른다. "회색 플레이스홀더" 스타일링은 CardModelBody(거울) 접촉이라 미적용(STOP 규칙 준수
  //   — 정본 폴백이 데모 문안 없이 비움을 커버).
  const previewTitle =
    s.title.trim() || (s.applied["product"] && s.productName ? s.productName : "");
  const previewSubtitle =
    s.subtitle.trim() ||
    (s.applied["product"] && s.productHeadline.trim() ? s.productHeadline.trim() : "");

  // 45:2660–2705 프리뷰 오버라이드(미영속 로컬 설정 → 거울에 흐름).
  const preview: Partial<CardModel> = {
    pageBg: s.pageBg,
    category: s.categoryLabel,
    categoryIcon: s.categoryIcon,
    // F5-5-S1 — 데모 source 무조건 주입 폐기 · S3 — 판매유형 유래 캡션만(미주입 = 정본 값).
    ...(s.sourceCaption ? { source: s.sourceCaption } : {}),
    ...(previewTitle ? { titleText: previewTitle } : {}),
    ...(previewSubtitle ? { subtitleText: previewSubtitle } : {}),
    ...(s.clip ? { clip: s.clip } : {}),
    ...(s.applied["brand"] && s.brand.trim() ? { brandText: s.brand.trim() } : {}),
    ...(s.applied["party"] ? { party: s.party } : {}),
    // F3-10b — 실슬롯 주입 재개(F3-10a 봉쇄의 실데이터 재개): s.dates/times/slotsByDate 는 이제 매장
    //   DB 실슬롯(get_available_slots → buildReservationSlotView — 45 :2673-2680 동형·거울 자동).
    //   정본 정리: 실슬롯은 DB 조회 사슬 소유(발행 payload 무편입 — 수신은 get_drop_detail 계열 조회),
    //   이 파일은 미리보기 CardModel 조립이라 여기 주입 = 수신 표시와 동형(가짜 아님).
    //   times 게이트 = date_range 모드(slot_time null → 빈 배열) 미주입 규칙(45 동형).
    ...(s.applied["calendar"] && s.dates.length ? { dates: s.dates, slotsByDate: s.slotsByDate } : {}),
    ...(s.applied["calendar"] && s.times.length ? { times: s.times } : {}),
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
