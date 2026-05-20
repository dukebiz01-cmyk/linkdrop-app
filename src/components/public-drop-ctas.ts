import type { DropViewVariant } from "@/lib/mock-data";

export interface PublicDropCta {
  id: string;
  label: string;
  primary?: boolean;
}

// WHY: 받은 사람 화면 CTA는 목적(variant)별 고정 세트 — Phase 1 mock, RPC 연동 전.
export const PUBLIC_DROP_CTAS: Record<DropViewVariant, PublicDropCta[]> = {
  /** 링크 복사·카카오톡 공유는 하단 고정 푸터에서 처리 */
  info: [],
  coupon: [
    { id: "coupon", label: "쿠폰 받기", primary: true },
    { id: "reserve-coupon", label: "예약하고 쿠폰 쓰기" },
    { id: "phone", label: "전화 문의" },
  ],
  /** 예약 CTA는 reservation-calendar-page 블록에서 처리 (중복 방지) */
  reservation: [],
  purchase: [
    { id: "price-compare", label: "가격 비교", primary: true },
    { id: "seller", label: "구매처 보기" },
    { id: "share", label: "공유하기" },
  ],
  lead: [
    { id: "phone", label: "전화하기" },
    { id: "sms", label: "문자 문의" },
    { id: "share", label: "공유하기" },
  ],
};
