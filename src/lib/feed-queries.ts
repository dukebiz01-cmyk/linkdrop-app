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

type IntentTypeRow = { key: string | null };

type InfoDropDiscoverRow = {
  id: string;
  published_at: string | null;
  created_at: string | null;
  share_count: number | null;
  content_sources: ContentSourceRow | null;
  intent_types: IntentTypeRow | null;
  share_events: Array<{ share_uuid: string }> | null;
};

type ShareEventSentRow = {
  share_uuid: string;
  created_at: string | null;
  info_drops: {
    content_sources: ContentSourceRow | null;
    intent_types: IntentTypeRow | null;
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
    title: cs.title ?? "(제목 없음)",
    creator:
      cs.author_name && cs.source_url
        ? { channelName: cs.author_name, channelUrl: cs.source_url }
        : undefined,
  };
}

const DISCOVER_SELECT = `
  id,
  published_at,
  created_at,
  share_count,
  content_sources!info_drops_source_id_fkey ( provider, title, thumbnail_url, duration_sec, author_name, source_url ),
  intent_types!info_drops_intent_id_fkey ( key ),
  share_events ( share_uuid )
`;

const SENT_SELECT = `
  share_uuid,
  created_at,
  info_drops!share_events_info_drop_id_fkey (
    content_sources!info_drops_source_id_fkey ( provider, title, thumbnail_url, duration_sec, author_name, source_url ),
    intent_types!info_drops_intent_id_fkey ( key )
  )
`;

export async function getDiscoverDrops(client: SupabaseClient): Promise<DropFeedItem[]> {
  const { data, error } = await client
    .from("info_drops")
    .select(DISCOVER_SELECT)
    .eq("status", "published")
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
