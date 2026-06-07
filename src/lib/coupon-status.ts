// 지갑 쿠폰 표시 상태 — coupon_claims 의 status/used_at/expires_at 를 종합해 계산.
// 프론트 표시 전용(읽기만). redeem RPC·백엔드·발급 로직과 무관.
//
// 규칙(우선순위):
//   1) used_at 있음(또는 status=used)            -> "used"      (사용 완료)
//   2) status expired/cancelled, 또는 expires_at < now -> "expired"   (만료)
//   3) expires_at 임박(3일 이내)                 -> "expiring"  (곧 만료)
//   4) 그 외                                      -> "available" (사용 가능)

export type CouponDisplayStatus = "used" | "expired" | "expiring" | "available";

export type CouponStatusInput = {
  status: string | null;
  used_at: string | null;
  expires_at: string | null;
};

const EXPIRING_SOON_MS = 3 * 24 * 60 * 60 * 1000; // 3일

export function getCouponDisplayStatus(
  claim: CouponStatusInput,
  now: number = Date.now(),
): CouponDisplayStatus {
  if (claim.used_at || claim.status === "used") return "used";
  if (claim.status === "expired" || claim.status === "cancelled") return "expired";
  if (claim.expires_at) {
    const exp = Date.parse(claim.expires_at);
    if (!Number.isNaN(exp)) {
      if (exp < now) return "expired";
      if (exp - now <= EXPIRING_SOON_MS) return "expiring";
    }
  }
  return "available";
}

// 아직 사용 가능한가 — '곧 만료'도 만료 전이라 usable.
export function isCouponUsable(claim: CouponStatusInput, now?: number): boolean {
  const s = getCouponDisplayStatus(claim, now);
  return s === "available" || s === "expiring";
}

export function couponStatusLabel(s: CouponDisplayStatus): string {
  switch (s) {
    case "used":
      return "사용 완료";
    case "expired":
      return "만료";
    case "expiring":
      return "곧 만료";
    default:
      return "사용 가능";
  }
}
