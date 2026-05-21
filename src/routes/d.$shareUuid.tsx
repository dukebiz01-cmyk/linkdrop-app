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
import { infoDropAdapter, type DropDetailRpc } from "@/lib/adapters";

const PROD_BASE = "https://app.drop.how";
const BRAND_TITLE = "LinkDrop — 친구가 보내준 드롭";
const BRAND_DESCRIPTION = "영상 속 정보를 친구와 카톡으로 나누는 가장 빠른 방법";

type DropSearch = { variant?: DropVariant };

type MockLoaderData = { mode: "mock"; shareUuid: string; variant: DropVariant };
type DbLoaderData = { mode: "db"; detail: DropDetailRpc | null; shareUuid: string };
type LoaderData = MockLoaderData | DbLoaderData;

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

    // test / preview-* → mock only (DB 미호출)
    if (isPublicDropMockPath(shareUuid)) {
      return mockLoaderData(shareUuid, searchVariant);
    }

    // 실제 share_uuid → get_drop_detail RPC (v3.5: maker/store 포함, 조회수 +1)
    try {
      const supabase = await getAuthClient();
      if (!supabase) return { mode: "db", detail: null, shareUuid };
      const { data, error } = await supabase.rpc("get_drop_detail", {
        p_share_uuid: shareUuid,
      });
      if (error || !data) return { mode: "db", detail: null, shareUuid };
      return { mode: "db", detail: data as unknown as DropDetailRpc, shareUuid };
    } catch (err) {
      console.error("[d/$shareUuid loader]", err);
      return { mode: "db", detail: null, shareUuid };
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

      const detail = loaderData?.mode === "db" ? loaderData.detail : null;
      const ogUrl = `${PROD_BASE}/d/${loaderData?.shareUuid ?? ""}`;
      const srcTitle = detail?.source?.title ?? null;
      const makerName = detail?.maker?.display_name ?? null;
      const title = srcTitle ? `${srcTitle} | LinkDrop` : BRAND_TITLE;
      const base =
        detail?.curator_message ?? detail?.drop?.ai_summary ?? BRAND_DESCRIPTION;
      const description = makerName ? `${makerName}님이 보낸 드롭 — ${base}` : base;

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
      const thumb = detail?.source?.thumbnail_url;
      if (thumb) {
        meta.push({ property: "og:image", content: thumb });
        meta.push({ name: "twitter:image", content: thumb });
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

  const { detail, shareUuid } = loaderData;

  // 실제 share_uuid 인데 조회 실패 → mock info 변형으로 fallback (무로그인 화면 깨짐 방지)
  if (!detail) {
    return renderMockInfoDropPage(shareUuid, "info");
  }

  const props = infoDropAdapter(detail);
  return (
    <InfoDropPage
      {...props}
      onWatchOriginal={() => {
        const url = detail.source?.source_url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }}
      onBack={() => window.history.back()}
      onShare={() => console.log("[d/$shareUuid] share", shareUuid)}
      onSave={() => console.log("[d/$shareUuid] save (Phase 2)")}
      onForward={() => console.log("[d/$shareUuid] forward")}
    />
  );
}
