import { Ticket, Gift } from "lucide-react";

/**
 * CouponPreview — 쿠폰 패널 순수 표시 카드 (콜백 0·부모상태 0).
 *
 * 손님 화면(info-drop-page couponPanel)에서 추출. 손님 화면·빌더(studio-build) 미리보기
 * 둘 다 재사용. 시각/구조는 원본 카드(info-drop-page.tsx 1120-1148)와 동일.
 *
 * ⚠️ 카드만 — 예약 흐름 카피("예약을 신청하면 쿠폰이 지갑에 담겨요")·바깥 wrapper 는
 *    이 컴포넌트에 넣지 않는다(예약 전용 → 호출부 책임).
 */
export function CouponPreview({
  coupon,
}: {
  coupon: {
    title: string;
    coupon_type?: string | null;
    gift_item?: string | null;
    conditions?: { min_amount?: number; [k: string]: unknown } | null;
    valid_until?: string | null;
  };
}) {
  const isGift = coupon?.coupon_type === "gift";
  const giftItem = coupon?.gift_item?.trim() || "";

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] tracking-ko">
      <div className="mb-3 flex items-center gap-2">
        <Ticket className="size-5 text-[#0A0A0A]" strokeWidth={2} />
        <span className="text-sm font-medium tracking-ko text-[#64748B]">
          받을 수 있는 쿠폰
        </span>
      </div>
      <p className="text-lg font-bold tracking-ko text-[#0F172A]">
        {coupon.title}
      </p>
      {isGift && giftItem ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FAFAFA] px-3 py-1 text-sm font-bold tracking-ko text-[#0A0A0A]">
          <Gift className="size-4" strokeWidth={2.2} />
          {giftItem} 증정
        </p>
      ) : (
        typeof coupon.conditions?.min_amount === "number" && (
          <p className="mt-2 text-sm font-medium tracking-ko text-[#64748B]">
            {coupon.conditions.min_amount.toLocaleString("ko-KR")}원 이상 사용하실
            때
          </p>
        )
      )}
      <p className="mt-1 text-sm font-medium tracking-ko text-[#64748B]">
        {coupon.valid_until
          ? `${new Date(coupon.valid_until).toLocaleDateString("ko-KR")}까지`
          : "기간 제한 없음"}
      </p>
    </div>
  );
}
