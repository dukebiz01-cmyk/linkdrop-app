// UI-5-T7-F4c — 손님 예약 클라 저장 단일 정본(키·만료·표기 규칙 이중화 방지).
//   데이터 방향 확정: RPC 신설 금지 — create_reservation_anon 기존 반환값(uuid) + 클라 저장만.
//   드롭당 1건 키(uq_reservations_active_catcher 의 "drop당 1활성" 계약 동형).
//   상태는 접수 시점 "pending" 고정 저장 — 사장 확정은 서버 소관이라 클라는 "확인 대기"만
//   정직 표기(§0: 단정 금지 — 확정 여부를 클라가 지어내지 않는다).

export type StoredMyReservation = {
  v: 1;
  reservationId: string;
  dropId: string;
  shareUuid: string;
  storeName: string | null;
  checkIn: string; // YYYY-MM-DD
  checkOut: string | null; // 단일 숙박이면 null
  guestCount: number;
  status: "pending";
  createdAt: string; // ISO
};

/** ②장 배지 → ①화면 재표시 신호(시트 [내 예약 확인하기] → 카드 배지 블록 리스너). */
export const MY_RESV_OPEN_EVENT = "ld:my-reservation-open";

const KEY_PREFIX = "ld_my_resv_";
const keyFor = (dropId: string) => `${KEY_PREFIX}${dropId}`;

/** UI-5-T7-F6-1 — 이 기기 예약 전수(prefix 스캔 · RPC 신설 금지 유지). 만료·형식 검증은
 *  readMyReservation 재사용(무효·만료분은 스캔 중 자동 소거). 키를 먼저 수집한 뒤 판독 —
 *  소거로 인한 localStorage 인덱스 밀림 방지. 반환 = 접수 최신순. */
export function readAllMyReservations(): StoredMyReservation[] {
  const out: StoredMyReservation[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      const r = readMyReservation(k.slice(KEY_PREFIX.length));
      if (r) out.push(r);
    }
  } catch {
    /* localStorage 차단(시크릿 등) — 빈 목록(예약 자체는 무영향). */
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** 예약번호 축약 표기 규칙 — uuid 하이픈 제거 앞 8자 대문자(전체 uuid 는 저장 보존). */
export function formatResvCode(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** "YYYY-MM-DD" → "M월 D일" (ReserveFunnelSheet formatKDate 동형 — 공용 승격). */
export function formatKDateIso(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${Number(m)}월 ${Number(d)}일`;
}

export function saveMyReservation(r: StoredMyReservation): void {
  try {
    localStorage.setItem(keyFor(r.dropId), JSON.stringify(r));
  } catch {
    /* 시크릿 모드 등 localStorage 차단 — 배지만 포기(예약 자체는 무영향). */
  }
}

/**
 * 읽기 + 만료 자동 소거. 만료 = 예약 마지막 날(체크아웃, 없으면 체크인)의 다음날 0시(로컬)
 * — 예약일이 지나면 배지가 자동으로 사라진다(과거 예약 잔존 방지).
 */
export function readMyReservation(dropId: string): StoredMyReservation | null {
  try {
    const raw = localStorage.getItem(keyFor(dropId));
    if (!raw) return null;
    const r = JSON.parse(raw) as StoredMyReservation;
    if (r?.v !== 1 || !r.reservationId || !r.checkIn) {
      localStorage.removeItem(keyFor(dropId));
      return null;
    }
    const last = r.checkOut ?? r.checkIn;
    const [y, m, d] = last.split("-").map(Number);
    const expireAt = new Date(y, (m ?? 1) - 1, (d ?? 1) + 1).getTime();
    if (Number.isFinite(expireAt) && Date.now() >= expireAt) {
      localStorage.removeItem(keyFor(dropId));
      return null;
    }
    return r;
  } catch {
    return null;
  }
}
