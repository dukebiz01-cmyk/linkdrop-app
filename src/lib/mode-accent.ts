// 카드 목적색 단일 소스 — 스튜디오(buildMode)와 손님(resolvedVariant) 양측이 공유.
//   스튜디오는 3모드(general/reserve/commerce), 손님은 5변형(info/coupon/reservation/purchase/lead).
//   값이 갈라지지 않도록 한 곳에서만 정의(C13 S4a). 게이지 지표색(POINT)과는 별개.
export const MODE_ACCENT: Record<"general" | "reserve" | "commerce", string> = {
  general: "#475569",
  reserve: "#1D4ED8",
  commerce: "#0F766E",
};

// 손님 변형 → 목적색. 스튜디오 모드 매핑과 1:1 정합
//   (info=general 슬레이트, coupon·reservation=reserve 블루, purchase=commerce 틸, lead=슬레이트).
export const VARIANT_ACCENT: Record<string, string> = {
  info: "#475569",
  coupon: "#1D4ED8",
  reservation: "#1D4ED8",
  purchase: "#0F766E",
  lead: "#475569",
};
