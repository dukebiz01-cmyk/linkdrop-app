import { Check } from "lucide-react";

/**
 * SellingPoints — 셀링포인트 불릿 리스트(표시 전용).
 *
 * CouponPreview 와 동일한 presentational 패턴. studio-build 카드의 셀링포인트
 * ul(li + Check + 텍스트)을 추출. 스튜디오·손님 둘 다 재사용.
 *
 * points 비면 null(아무것도 안 그림). 게이트/배치(예약 제외 등)는 호출부 책임 —
 * 여기선 순수 표시만.
 */
export function SellingPoints({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {points.map((kp, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-white/65">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-white/65" strokeWidth={2} />
          {kp}
        </li>
      ))}
    </ul>
  );
}
