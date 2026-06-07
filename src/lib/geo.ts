// 매장-매장 직선거리(haversine). DB 변경 없이 partners.lat/lng 로 계산.
// 직선거리이므로 표시 카피는 "차로" 금지("내 매장에서 ~", "약 N km").

type MaybeNum = number | null | undefined;

function isNum(v: MaybeNum): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const EARTH_RADIUS_KM = 6371;

// 두 좌표 사이 직선거리(km). 인자 중 하나라도 null/undefined/NaN 이면 null.
export function haversineKm(
  lat1: MaybeNum,
  lng1: MaybeNum,
  lat2: MaybeNum,
  lng2: MaybeNum,
): number | null {
  if (!isNum(lat1) || !isNum(lng1) || !isNum(lat2) || !isNum(lng2)) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// km → 표시 문자열. null 이면 null. <1 → "1km 이내" / <10 → "약 N.Nkm" / ≥10 → "약 Nkm".
export function formatDistanceKm(km: number | null): string | null {
  if (km === null || !Number.isFinite(km)) return null;
  if (km < 1) return "1km 이내";
  if (km < 10) return `약 ${km.toFixed(1)}km`;
  return `약 ${Math.round(km)}km`;
}
