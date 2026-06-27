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

// 만료까지 D-day 카운트다운 라벨 — '곧 만료'(expiring) 배지에 표시용. (EXPIRING_SOON_MS 3일 임계 재사용)
// §0: 실제 valid_until(=expires_at) 기준 사실만. 가짜 긴급/초단위 없음(날짜 라벨만). 압박 회피.
//   없음/파싱실패/이미만료/3일 초과 → null. 0일→"오늘 마감" / 1일→"내일 마감" / 그외→"D-N".
export function getExpiryCountdown(
  expiresAt: string | null,
  now: number = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return null;
  if (exp < now) return null; // 이미 만료 → 표시 안 함(expired 상태가 처리)
  if (exp - now > EXPIRING_SOON_MS) return null; // 3일 초과 → 타이머 없음(본문 날짜만)

  // 날짜 기준 일수 차이(시각 무시 — "오늘/내일/D-N" 정확히)
  const e = new Date(exp);
  const n = new Date(now);
  const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  const nDay = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dayDiff = Math.round((eDay - nDay) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return "오늘 마감";
  if (dayDiff === 1) return "내일 마감";
  return `D-${dayDiff}`;
}
