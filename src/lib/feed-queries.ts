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
  content_sources: ContentSourceRow | null;
  intent_types: IntentTypeRow | null;
  share_events: Array<{ share_uuid: string; expires_at?: string | null }> | null;
  // 1-C-2 — funnel 쿠폰 임베드(info_drops_funnel_coupon_id_fkey).
  coupons?: FeedCouponRow;
};

type ShareEventSentRow = {
  share_uuid: string;
  created_at: string | null;
  // 1-C-2 — 공유 자체 만료.
  expires_at?: string | null;
  info_drops: {
    purpose?: string | null;
    content_sources: ContentSourceRow | null;
    intent_types: IntentTypeRow | null;
    coupons?: FeedCouponRow;
  } | null;
};

function adaptDiscoverRow(row: InfoDropDiscoverRow): DropFeedItem | null {
  const cs = row.content_sources;
  if (!cs?.thumbnail_url) return null;
  const shareUuid = row.share_events?.[0]?.share_uuid ?? row.id;
  return {
    shareUuid,
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
    title: cs.title ?? "(제목 없음)",
    receivedByCount: row.share_count ?? undefined,
    creator:
      cs.author_name && cs.source_url
        ? { channelName: cs.author_name, channelUrl: cs.source_url }
        : undefined,
  };
}

function adaptSentRow(row: ShareEventSentRow): DropFeedItem | null {
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
  content_sources!info_drops_source_id_fkey ( provider, title, thumbnail_url, duration_sec, author_name, source_url ),
  intent_types!info_drops_intent_id_fkey ( key ),
  coupons!info_drops_funnel_coupon_id_fkey ( valid_from, valid_until, is_active ),
  share_events ( share_uuid, expires_at )
`;

const SENT_SELECT = `
  share_uuid,
  created_at,
  expires_at,
  info_drops!share_events_info_drop_id_fkey (
    purpose,
    content_sources!info_drops_source_id_fkey ( provider, title, thumbnail_url, duration_sec, author_name, source_url ),
    intent_types!info_drops_intent_id_fkey ( key ),
    coupons!info_drops_funnel_coupon_id_fkey ( valid_from, valid_until, is_active )
  )
`;

// 탐색 3탭 필터 — purposes(drop_purpose enum 값)·bizOnly(매장 연결 카드만). 둘 다 없으면 기존 동작(하위호환).
export async function getDiscoverDrops(
  client: SupabaseClient,
  opts?: { purposes?: string[]; bizOnly?: boolean },
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
  return (data as unknown as InfoDropDiscoverRow[])
    .map(adaptDiscoverRow)
    .filter((x): x is DropFeedItem => x !== null);
}

// Slice 4b — 구독(maker_follows active) 한 메이커들의 published 카드.
//   getDiscoverDrops 와 동일 join(content_sources/intent_types/share_events) +
//   adaptDiscoverRow 매핑. 차이는 info_drops.partner_id 를 팔로우한 partner 로만 필터.
export async function getFollowedMakerDrops(
  client: SupabaseClient,
  userId: string,
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
    .in("partner_id", partnerIds)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(10);
  if (error || !data) return [];
  return (data as unknown as InfoDropDiscoverRow[])
    .map(adaptDiscoverRow)
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
  return (data as unknown as ShareEventSentRow[])
    .map(adaptSentRow)
    .filter((x): x is DropFeedItem => x !== null);
}
