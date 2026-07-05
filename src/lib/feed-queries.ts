import type { SupabaseClient } from "@supabase/supabase-js";
import type { DropFeedItem } from "@/components/home-page";

const MAKER_FALLBACK = { name: "익명", avatarUrl: undefined };

function providerToLabel(p: string | null | undefined): "YouTube" | "Instagram" {
  return p === "instagram" ? "Instagram" : "YouTube";
}

const INTENT_KEYS = [
  "coupon",
  "reservation",
  "commerce",
  "info",
  "ticket",
  "lead",
  "discussion",
  "meme",
  "campaign",
  "custom",
] as const;
type IntentKey = (typeof INTENT_KEYS)[number];

function safeIntent(key: string | null | undefined): IntentKey {
  return key && (INTENT_KEYS as readonly string[]).includes(key) ? (key as IntentKey) : "info";
}

function formatDroppedAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return `${Math.round(d / 7)}주 전`;
}

// 1-C-3 — 피드 재고 배치 병합(1-B-2 get_feed_remaining_stock). 피드당 정확 1회 호출.
//   L4: RPC 반환값 그대로(가공·연출 감산 0) · 캐싱 없음(스테일 재고 = 가짜 표시).
//   실패 내성: 오류 시 빈 맵 반환 → 피드는 정상, 재고만 미표시(가용성 우선) + console 1줄.
async function fetchRemainingStock(
  client: SupabaseClient,
  dropIds: string[],
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  const ids = Array.from(new Set(dropIds.filter(Boolean)));
  if (ids.length === 0) return map;
  try {
    // get_feed_remaining_stock 은 types.ts 미반영(TEMP — 타입 재생성 후 캐스트 제거).
    const { data, error } = (await client.rpc(
      "get_feed_remaining_stock" as never,
      { p_drop_ids: ids } as never,
    )) as { data: unknown; error: { message?: string } | null };
    if (error) {
      console.error("[feed-queries] get_feed_remaining_stock failed:", error.message);
      return map;
    }
    for (const row of (data as { drop_id: string; remaining_stock: number | null }[]) ?? []) {
      map.set(row.drop_id, row.remaining_stock);
    }
  } catch (e) {
    console.error("[feed-queries] get_feed_remaining_stock error:", e);
  }
  return map;
}

// SM-3 — 확산 규모 배치 병합(get_feed_spread_count). 1-C-3 fetchRemainingStock 미러:
//   피드당 1회(재고 호출과 Promise.all 병렬 — 추가 라운드트립 0), 실패 = 미표시 + console 1줄.
async function fetchSpreadCount(
  client: SupabaseClient,
  dropIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = Array.from(new Set(dropIds.filter(Boolean)));
  if (ids.length === 0) return map;
  try {
    // get_feed_spread_count 는 types.ts 미반영(TEMP — 타입 재생성 후 캐스트 제거).
    const { data, error } = (await client.rpc(
      "get_feed_spread_count" as never,
      { p_drop_ids: ids } as never,
    )) as { data: unknown; error: { message?: string } | null };
    if (error) {
      console.error("[feed-queries] get_feed_spread_count failed:", error.message);
      return map;
    }
    for (const row of (data as { drop_id: string; spread_count: number }[]) ?? []) {
      map.set(row.drop_id, row.spread_count);
    }
  } catch (e) {
    console.error("[feed-queries] get_feed_spread_count error:", e);
  }
  return map;
}

type ContentSourceRow = {
  provider: string | null;
  title: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  author_name: string | null;
  source_url: string | null;
};

// 1-C-2 — 피드용 마감 계산 재료(funnel 쿠폰 임베드). RLS(coupons_public_read: is_active=true)가
//   비활성 쿠폰을 이미 감춘다 — 기간 창 검증만 클라에서 미러.
type FeedCouponRow = {
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean | null;
} | null;

// 1-C-2 — 1-C(d.$shareUuid 컴포넌트)와 동일 알고리즘의 피드판(L1: 단일 기준값):
//   쿠폰 계열 purpose 게이트 + min(funnel coupon.valid_until[활성·기간 내], share_events.expires_at).
//   ⚠️ get_drop_detail 의 2차 폴백(파트너 최신 활성 쿠폰)은 피드 미적용 — 드랍당 추가 쿼리(N+1) 금지.
//   둘 다 없으면 undefined(타이머 미렌더).
function feedExpiresAt(
  purpose: string | null | undefined,
  coupon: FeedCouponRow,
  shareExpiresAt: string | null | undefined,
): string | undefined {
  const isCouponPurpose = purpose === "쿠폰" || purpose === "예약";
  const now = Date.now();
  const couponUntil =
    isCouponPurpose &&
    coupon &&
    coupon.is_active !== false &&
    (!coupon.valid_from || Date.parse(coupon.valid_from) <= now) &&
    coupon.valid_until &&
    Date.parse(coupon.valid_until) >= now
      ? coupon.valid_until
      : null;
  const cands = [couponUntil, shareExpiresAt ?? null]
    .filter((v): v is string => Boolean(v))
    .map((v) => ({ v, t: Date.parse(v) }))
    .filter((x) => Number.isFinite(x.t));
  if (cands.length === 0) return undefined;
  cands.sort((a, b) => a.t - b.t);
  return cands[0].v;
}

type IntentTypeRow = { key: string | null };

type InfoDropDiscoverRow = {
  id: string;
  published_at: string | null;
  created_at: string | null;
  share_count: number | null;
  // 탐색 3탭 필터용(서버 .in("purpose")/.not("partner_id")). adaptDiscoverRow 는 미사용(렌더 무관).
  purpose?: string | null;
  partner_id?: string | null;
  // P7c FEED-1 — 내/남 구분(isMine 산출 재료).
  owner_user_id?: string | null;
  content_sources: ContentSourceRow | null;
  intent_types: IntentTypeRow | null;
  share_events: Array<{ share_uuid: string; expires_at?: string | null }> | null;
  // 1-C-2 — funnel 쿠폰 임베드(info_drops_funnel_coupon_id_fkey).
  coupons?: FeedCouponRow;
};

type ShareEventSentRow = {
  share_uuid: string;
  created_at: string | null;
  // 1-C-3 — 재고 배치 조회용 드랍 id(루트 컬럼).
  info_drop_id?: string | null;
  // 1-C-2 — 공유 자체 만료.
  expires_at?: string | null;
  info_drops: {
    purpose?: string | null;
    content_sources: ContentSourceRow | null;
    intent_types: IntentTypeRow | null;
    coupons?: FeedCouponRow;
  } | null;
};

// 1-C-3 — remainingStock: 배치 RPC 병합값(null/미반환 = undefined → 타일 미렌더, 1-A 계약).
// SM-3 — shareCount: 확산 규모 배치값(0/미반환 = undefined → 미렌더).
// P7c FEED-1 — currentUserId 주입 시 owner_user_id 비교로 isMine 산출(미주입 = false → 칩 미렌더).
function adaptDiscoverRow(
  row: InfoDropDiscoverRow,
  remainingStock?: number | null,
  shareCount?: number,
  currentUserId?: string | null,
): DropFeedItem | null {
  const cs = row.content_sources;
  if (!cs?.thumbnail_url) return null;
  const shareUuid = row.share_events?.[0]?.share_uuid ?? row.id;
  return {
    shareUuid,
    isMine: currentUserId != null && row.owner_user_id === currentUserId,
    maker: {
      ...MAKER_FALLBACK,
      droppedAgo: formatDroppedAgo(row.published_at ?? row.created_at),
    },
    videoThumbnailUrl: cs.thumbnail_url,
    videoSourceLabel: providerToLabel(cs.provider),
    videoDurationSec: cs.duration_sec ?? 0,
    intent: safeIntent(row.intent_types?.key),
    // 1-C-2 — 타일 타이머용 마감(ISO). 없으면 undefined = 미렌더(하위호환).
    expiresAt: feedExpiresAt(row.purpose, row.coupons ?? null, row.share_events?.[0]?.expires_at),
    // 1-C-3 — 파생 재고(1-B-2 배치값 그대로, L4).
    ...(remainingStock != null ? { remainingStock } : {}),
    // SM-3 — 확산 규모(0 = 미표시라 생략).
    ...(shareCount ? { shareCount } : {}),
    title: cs.title ?? "(제목 없음)",
    receivedByCount: row.share_count ?? undefined,
    creator:
      cs.author_name && cs.source_url
        ? { channelName: cs.author_name, channelUrl: cs.source_url }
        : undefined,
  };
}

// 1-C-3 — remainingStock: 배치 RPC 병합값(adaptDiscoverRow 와 동일 계약). SM-3 — shareCount 동일.
function adaptSentRow(
  row: ShareEventSentRow,
  remainingStock?: number | null,
  shareCount?: number,
): DropFeedItem | null {
  const cs = row.info_drops?.content_sources;
  if (!cs?.thumbnail_url) return null;
  return {
    shareUuid: row.share_uuid,
    maker: { ...MAKER_FALLBACK, droppedAgo: formatDroppedAgo(row.created_at) },
    videoThumbnailUrl: cs.thumbnail_url,
    videoSourceLabel: providerToLabel(cs.provider),
    videoDurationSec: cs.duration_sec ?? 0,
    intent: safeIntent(row.info_drops?.intent_types?.key),
    // 1-C-2 — 내 공유 행도 동일 계산(공유 자체 expires_at 는 루트 행).
    expiresAt: feedExpiresAt(
      row.info_drops?.purpose,
      row.info_drops?.coupons ?? null,
      row.expires_at,
    ),
    // 1-C-3 — 파생 재고(배치값 그대로, L4). 비공개 드랍은 RPC 가 행 미반환 → undefined(미렌더).
    ...(remainingStock != null ? { remainingStock } : {}),
    // SM-3 — 확산 규모(0 = 미표시라 생략).
    ...(shareCount ? { shareCount } : {}),
    title: cs.title ?? "(제목 없음)",
    creator:
      cs.author_name && cs.source_url
        ? { channelName: cs.author_name, channelUrl: cs.source_url }
        : undefined,
  };
}

// 1-C-2 — expires_at·funnel 쿠폰 임베드 추가(같은 단일 쿼리의 embed 확장 — 쿼리 횟수 불변, N+1 0).
const DISCOVER_SELECT = `
  id,
  published_at,
  created_at,
  share_count,
  purpose,
  partner_id,
  owner_user_id,
  content_sources!info_drops_source_id_fkey ( provider, title, thumbnail_url, duration_sec, author_name, source_url ),
  intent_types!info_drops_intent_id_fkey ( key ),
  coupons!info_drops_funnel_coupon_id_fkey ( valid_from, valid_until, is_active ),
  share_events ( share_uuid, expires_at )
`;

const SENT_SELECT = `
  share_uuid,
  created_at,
  info_drop_id,
  expires_at,
  info_drops!share_events_info_drop_id_fkey (
    purpose,
    content_sources!info_drops_source_id_fkey ( provider, title, thumbnail_url, duration_sec, author_name, source_url ),
    intent_types!info_drops_intent_id_fkey ( key ),
    coupons!info_drops_funnel_coupon_id_fkey ( valid_from, valid_until, is_active )
  )
`;

// 탐색 3탭 필터 — purposes(drop_purpose enum 값)·bizOnly(매장 연결 카드만). 둘 다 없으면 기존 동작(하위호환).
// P7c FEED-1 — currentUserId 주입 시 각 카드 isMine 산출(내/남 구분 칩).
export async function getDiscoverDrops(
  client: SupabaseClient,
  opts?: { purposes?: string[]; bizOnly?: boolean; currentUserId?: string | null },
): Promise<DropFeedItem[]> {
  let query = client
    .from("info_drops")
    .select(DISCOVER_SELECT)
    .eq("status", "published")
    .eq("is_public", true);
  if (opts?.purposes && opts.purposes.length > 0) {
    query = query.in("purpose", opts.purposes);
  }
  if (opts?.bizOnly) {
    query = query.not("partner_id", "is", null);
  }
  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error || !data) return [];
  const rows = data as unknown as InfoDropDiscoverRow[];
  // 1-C-3 재고 + SM-3 확산 — 각 배치 1회, Promise.all 병렬(추가 라운드트립 0).
  const ids = rows.map((r) => r.id);
  const [stock, spread] = await Promise.all([
    fetchRemainingStock(client, ids),
    fetchSpreadCount(client, ids),
  ]);
  return rows
    .map((r) =>
      adaptDiscoverRow(r, stock.get(r.id) ?? undefined, spread.get(r.id), opts?.currentUserId),
    )
    .filter((x): x is DropFeedItem => x !== null);
}

// Slice 4b — 구독(maker_follows active) 한 메이커들의 published 카드.
//   getDiscoverDrops 와 동일 join(content_sources/intent_types/share_events) +
//   adaptDiscoverRow 매핑. 차이는 info_drops.partner_id 를 팔로우한 partner 로만 필터.
// P7c — currentUserId 주입 시 isMine 산출(getDiscoverDrops 동일).
export async function getFollowedMakerDrops(
  client: SupabaseClient,
  userId: string,
  opts?: { currentUserId?: string | null },
): Promise<DropFeedItem[]> {
  const { data: follows, error: fErr } = await client
    .from("maker_follows")
    .select("followed_partner_id")
    .eq("follower_user_id", userId)
    .eq("status", "active");
  if (fErr || !follows) return [];
  const partnerIds = (follows as { followed_partner_id: string }[])
    .map((f) => f.followed_partner_id)
    .filter(Boolean);
  if (partnerIds.length === 0) return [];

  const { data, error } = await client
    .from("info_drops")
    .select(DISCOVER_SELECT)
    .eq("status", "published")
    // P7c Part A — 비공개 카드 구독피드 누출 차단(getDiscoverDrops :280-281 동일 패턴).
    .eq("is_public", true)
    .in("partner_id", partnerIds)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(10);
  if (error || !data) return [];
  const rows = data as unknown as InfoDropDiscoverRow[];
  // 1-C-3 재고 + SM-3 확산 — 각 배치 1회 병렬.
  const ids = rows.map((r) => r.id);
  const [stock, spread] = await Promise.all([
    fetchRemainingStock(client, ids),
    fetchSpreadCount(client, ids),
  ]);
  return rows
    .map((r) =>
      adaptDiscoverRow(r, stock.get(r.id) ?? undefined, spread.get(r.id), opts?.currentUserId),
    )
    .filter((x): x is DropFeedItem => x !== null);
}

// 받은 쿠폰 메이커별 "대표 공개카드 1개" — /me 받은 쿠폰 메이커 섹션 임베드용.
//   ★ N+1 회피: 메이커별 개별 쿼리 금지. partner_id IN (배열) 한 번에 가져와
//   앱에서 partner_id별 최신 1개 pick(최신순 정렬 → 첫 등장이 대표).
//   §0 가드: is_public=true 공개카드만(비공개 노출 금지). 썸네일 없는 행은 adapt 가 skip →
//   같은 메이커의 더 오래된(썸네일 있는) 카드로 폴백.
export async function getMakerRepDrops(
  client: SupabaseClient,
  partnerIds: string[],
): Promise<Map<string, DropFeedItem>> {
  const result = new Map<string, DropFeedItem>();
  const ids = Array.from(new Set(partnerIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const { data, error } = await client
    .from("info_drops")
    .select(DISCOVER_SELECT)
    .eq("status", "published")
    .eq("is_public", true)
    .in("partner_id", ids)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error || !data) return result;

  for (const row of data as unknown as InfoDropDiscoverRow[]) {
    const pid = row.partner_id;
    if (!pid || result.has(pid)) continue; // 최신순 → 이미 대표가 잡힌 메이커는 skip
    const item = adaptDiscoverRow(row);
    if (item) result.set(pid, item);
  }
  return result;
}

export async function getSentDrops(
  client: SupabaseClient,
  userId: string,
): Promise<DropFeedItem[]> {
  const { data, error } = await client
    .from("share_events")
    .select(SENT_SELECT)
    .eq("sender_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  const rows = data as unknown as ShareEventSentRow[];
  // 1-C-3 재고 + SM-3 확산 — 각 배치 1회 병렬. 비공개 드랍은 RPC 가 행 미반환 → 미표시.
  const ids = rows.map((r) => r.info_drop_id ?? "").filter(Boolean);
  const [stock, spread] = await Promise.all([
    fetchRemainingStock(client, ids),
    fetchSpreadCount(client, ids),
  ]);
  return rows
    .map((r) =>
      adaptSentRow(
        r,
        r.info_drop_id ? (stock.get(r.info_drop_id) ?? undefined) : undefined,
        r.info_drop_id ? spread.get(r.info_drop_id) : undefined,
      ),
    )
    .filter((x): x is DropFeedItem => x !== null);
}
