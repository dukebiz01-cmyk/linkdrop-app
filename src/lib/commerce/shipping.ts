// [CREATE] 커머스 A-1 — 배송비 계산.
//
// ⚠️ 순수 함수. DB/Supabase/UI 0.
//   ⚠️ 아래 단가는 전부 예시값(placeholder) — 실서비스 전 "실 우체국 요율 + 농가 계약가"로 교체할 것.
//   합포장(여러 상품 한 박스) 정책 미정 → 현재는 totalWeight(무게 합) 단일 기준으로만 산정한다.

import type { RegionType } from "./types";

/**
 * 무게 구간별 기본 배송비(원). ⚠️ 예시값 — 실 우체국 요율 + 농가 계약가로 교체.
 *   ≤5kg→4000, ≤10kg→5000, ≤20kg→7000, ≤30kg→9000,
 *   30kg 초과→ 9000 + ceil((w-30)/20)*7000 (20kg 단위 가산).
 */
export function shipBase(weightKg: number): number {
  if (weightKg <= 5) return 4000;
  if (weightKg <= 10) return 5000;
  if (weightKg <= 20) return 7000;
  if (weightKg <= 30) return 9000;
  return 9000 + Math.ceil((weightKg - 30) / 20) * 7000;
}

/**
 * 권역 할증(원). ⚠️ 예시값 — 실 도서산간 요율로 교체.
 *   jeju→3000, remote→5000, normal→0.
 */
export function regionSurcharge(region: RegionType): number {
  switch (region) {
    case "jeju":
      return 3000;
    case "remote":
      return 5000;
    case "normal":
    default:
      return 0;
  }
}

/**
 * 총 배송비 = 기본 배송비(무게) + 권역 할증.
 *   weightKg = totalWeight(합포장 정책 미정이라 무게 합 단일 기준).
 */
export function calcShipping(weightKg: number, region: RegionType): number {
  return shipBase(weightKg) + regionSurcharge(region);
}
