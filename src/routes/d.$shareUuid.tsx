import { createFileRoute } from "@tanstack/react-router";
import { InfoDropPage } from "@/components/info-drop-page";
import { getAuthClient } from "@/lib/auth-context";
import {
  isPublicDropMockPath,
  renderMockInfoDropPage,
  normalizeVariant,
  resolvePublicDropVariant,
  type DropVariant,
} from "@/lib/public-drop-page";
import { MOCK_DROP_VIEW_BY_VARIANT, MOCK_VIDEO_INFO } from "@/lib/mock-data";

const PROD_BASE = "https://app.drop.how";
const BRAND_TITLE = "LinkDrop — 친구가 보내준 드롭";
const BRAND_DESCRIPTION = "영상 속 정보를 친구와 카톡으로 나누는 가장 빠른 방법";

const INTENT_FALLBACK_LABEL: Record<string, string> = {
  info: "정보",
  discussion: "대화",
  coupon: "쿠폰",
  reservation: "예약",
  commerce: "구매",
  ticket: "티켓",
  lead: "관심등록",
  campaign: "캠페인",
  custom: "드롭",
};

type InfoDropIntent = "coupon" | "reservation" | "commerce" | "info" | "ticket" | "lead";
const COMPONENT_INTENTS: readonly InfoDropIntent[] = [
  "coupon",
  "reservation",
  "commerce",
  "info",
  "ticket",
  "lead",
] as const;

function narrowIntentForComponent(key: string | null | undefined): InfoDropIntent {
  if (key && (COMPONENT_INTENTS as readonly string[]).includes(key)) {
    return key as InfoDropIntent;
  }
  return "info";
}

function providerToLabel(p: string | null | undefined): "YouTube" | "Instagram" {
  return p === "instagram" ? "Instagram" : "YouTube";
}

function formatDroppedAgo(iso: string | null | undefined): string {
  if (!iso) return "방금 전";
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

type ContentSource = {
  title: string | null;
  thumbnail_url: string | null;
  source_url: string | null;
  author_name: string | null;
  provider: string | null;
  duration_sec: number | null;
};

type IntentType = { key: string | null; name: string | null };

type InfoDropRow = {
  intent_types: IntentType | null;
  content_sources: ContentSource | null;
};

type SenderProfile = {
  display_name: string | null;
  avatar_url: string | null;
};

type ShareRow = {
  share_uuid: string;
  curator_message: string | null;
  created_at: string | null;
  info_drops: InfoDropRow | null;
  sender: SenderProfile | null;
};

type DropSearch = {
  variant?: DropVariant;
};

type MockLoaderData = {
  mode: "mock";
  shareUuid: string;
  variant: DropVariant;
};

type DbLoaderData = {
  mode: "db";
  share: ShareRow | null;
  shareUuid: string;
};

type LoaderData = MockLoaderData | DbLoaderData;

const SHARE_SELECT = `
  share_uuid,
  curator_message,
  created_at,
  info_drops!share_events_info_drop_id_fkey (
    intent_types!info_drops_intent_id_fkey ( key, name ),
    content_sources!info_drops_source_id_fkey (
      title, thumbnail_url, source_url, author_name, provider, duration_sec
    )
  ),
  sender:public_profiles!share_events_sender_user_id_fkey ( display_name, avatar_url )
`;

function mockLoaderData(shareUuid: string, searchVariant: unknown): MockLoaderData {
  const code = shareUuid || "test";
  return {
    mode: "mock",
    shareUuid: code,
    variant: resolvePublicDropVariant(code, normalizeVariant(searchVariant)),
  };
}

export const Route = createFileRoute("/d/$shareUuid")({
  validateSearch: (search: Record<string, unknown>): DropSearch => ({
    variant: normalizeVariant(search.variant),
  }),
  loader: async ({ params, location }): Promise<LoaderData> => {
    const shareUuid = params.shareUuid ?? "";
    const searchVariant = (location.search as DropSearch)?.variant;

    if (isPublicDropMockPath(shareUuid)) {
      return mockLoaderData(shareUuid, searchVariant);
    }

    try {
      const supabase = await getAuthClient();
      if (!supabase) return { mode: "db", share: null, shareUuid };
      const { data, error } = await supabase
        .from("share_events")
        .select(SHARE_SELECT)
        .eq("share_uuid", shareUuid)
        .maybeSingle();
      if (error || !data) return { mode: "db", share: null, shareUuid };
      return { mode: "db", share: data as unknown as ShareRow, shareUuid };
    } catch (err) {
      console.error("[d/$shareUuid loader]", err);
      return { mode: "db", share: null, shareUuid };
    }
  },
  head: ({ loaderData, params }) => {
    try {
      if (loaderData?.mode === "mock") {
        const variant = loaderData.variant ?? "info";
        const mock = MOCK_DROP_VIEW_BY_VARIANT[variant] ?? MOCK_DROP_VIEW_BY_VARIANT.info;
        const ogUrl = `${PROD_BASE}/d/${params.shareUuid}`;
        return {
          meta: [
            { title: mock.title ?? BRAND_TITLE },
            { property: "og:title", content: mock.title ?? BRAND_TITLE },
            { property: "og:url", content: ogUrl },
            { property: "og:image", content: MOCK_VIDEO_INFO.cafeTour.thumbnailUrl },
          ],
        };
      }

      const share = loaderData?.mode === "db" ? loaderData.share : null;
      const cs = share?.info_drops?.content_sources;
      const it = share?.info_drops?.intent_types;
      const makerName = share?.sender?.display_name ?? null;
      const ogUrl = `${PROD_BASE}/d/${loaderData?.shareUuid ?? ""}`;

      const title = cs?.title ? `${cs.title} | LinkDrop` : BRAND_TITLE;
      const intentLabel = it?.name ?? (it?.key ? INTENT_FALLBACK_LABEL[it.key] : null);
      const baseDescription =
        share?.curator_message ?? (intentLabel ? `${intentLabel} 드롭` : BRAND_DESCRIPTION);
      const description = makerName ? `${makerName}님이 보낸 드롭 — ${baseDescription}` : baseDescription;

      const meta: Array<Record<string, string>> = [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: ogUrl },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "LinkDrop" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ];

      if (cs?.thumbnail_url) {
        meta.push({ property: "og:image", content: cs.thumbnail_url });
        meta.push({ name: "twitter:image", content: cs.thumbnail_url });
      }

      return { meta };
    } catch {
      return { meta: [{ title: BRAND_TITLE }] };
    }
  },
  errorComponent: ShareUuidRouteErrorFallback,
  component: DropPage,
});

function ShareUuidRouteErrorFallback({ error }: { error: Error }) {
  console.error("[d/$shareUuid route error]", error);
  let shareUuid = "test";
  let variant: DropVariant = "info";
  try {
    shareUuid = Route.useParams().shareUuid ?? "test";
    variant = normalizeVariant(Route.useSearch({ select: (s) => s.variant }));
  } catch {
    /* defaults */
  }
  return renderMockInfoDropPage(shareUuid, variant);
}

function DropPage() {
  const loaderData = Route.useLoaderData();

  if (loaderData.mode === "mock") {
    return renderMockInfoDropPage(loaderData.shareUuid, loaderData.variant);
  }

  const { share, shareUuid } = loaderData;
  const cs = share?.info_drops?.content_sources;
  const it = share?.info_drops?.intent_types;

  const intent = narrowIntentForComponent(it?.key);
  const intentLabel = it?.name ?? (it?.key ? INTENT_FALLBACK_LABEL[it.key] : null) ?? "드롭";

  return (
    <InfoDropPage
      videoThumbnailUrl={
        cs?.thumbnail_url ??
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=450&fit=crop"
      }
      videoDurationSec={cs?.duration_sec ?? 0}
      videoSourceLabel={providerToLabel(cs?.provider)}
      maker={{
        name: share?.sender?.display_name ?? "익명",
        droppedAgo: formatDroppedAgo(share?.created_at),
      }}
      makerMessage={share?.curator_message ?? undefined}
      title={cs?.title ?? BRAND_TITLE}
      description={share?.curator_message ?? `${intentLabel} 드롭`}
      intent={intent}
      local={{
        name: intentLabel,
        category: "공유된 정보",
        distance: "",
        address: "",
        statusLabel: "",
      }}
      creator={{
        channelName: cs?.author_name ?? "원본 영상",
        channelUrl: cs?.source_url ?? "#",
      }}
      onPrimaryAction={() => console.log("[d/$shareUuid] primary action", shareUuid)}
      onWatchOriginal={() => {
        if (cs?.source_url) {
          window.open(cs.source_url, "_blank", "noopener,noreferrer");
        }
      }}
      onShare={() => console.log("[d/$shareUuid] share", shareUuid)}
      onBack={() => window.history.back()}
      onSave={() => console.log("[d/$shareUuid] save (Phase 2 wiring)")}
      onForward={() => console.log("[d/$shareUuid] forward to friend")}
    />
  );
}
