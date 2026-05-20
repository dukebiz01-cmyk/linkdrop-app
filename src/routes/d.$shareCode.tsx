import { createFileRoute } from "@tanstack/react-router";
import {
  renderMockInfoDropPage,
  normalizeVariant,
  parsePreviewVariant,
  isPublicDropMockPath,
  type DropVariant,
} from "@/lib/public-drop-page";
import { MOCK_DROP_VIEW_BY_VARIANT, MOCK_VIDEO_INFO } from "@/lib/mock-data";

const PROD_BASE = "https://app.drop.how";
const BRAND_TITLE = "LinkDrop — 친구가 보내준 드롭";

type DropSearch = {
  variant?: DropVariant;
};

export type DropShareLoaderData = {
  shareCode: string;
  variant: DropVariant;
  mock: true;
};

function resolveLoaderVariant(shareCode: string, searchVariant: unknown): DropVariant {
  try {
    if (shareCode === "test") {
      return normalizeVariant(searchVariant);
    }
    const fromPreview = parsePreviewVariant(shareCode);
    if (fromPreview) return fromPreview;
    return normalizeVariant(searchVariant);
  } catch {
    return "info";
  }
}

function safeLoaderData(shareCode: string, searchVariant: unknown): DropShareLoaderData {
  const code = shareCode || "test";
  return {
    shareCode: code,
    variant: resolveLoaderVariant(code, searchVariant),
    mock: true,
  };
}

/**
 * 무로그인 공개 Drop — root 직속.
 * test / preview-* → mock only (DB·Supabase 미호출). ssr:false → SSR 500·error-page HTML 방지.
 */
export const Route = createFileRoute("/d/$shareCode")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): DropSearch => ({
    variant: normalizeVariant(search.variant),
  }),
  loader: ({ params, location }): DropShareLoaderData => {
    try {
      const search = location.search as { variant?: unknown };
      return safeLoaderData(params.shareCode, search?.variant);
    } catch (err) {
      console.error("[d/$shareCode loader]", err);
      return { shareCode: params.shareCode ?? "test", variant: "info", mock: true };
    }
  },
  head: ({ loaderData, params }) => {
    try {
      const variant = loaderData?.variant ?? "info";
      const mock = MOCK_DROP_VIEW_BY_VARIANT[variant] ?? MOCK_DROP_VIEW_BY_VARIANT.info;
      const title = mock.title ?? BRAND_TITLE;
      const ogUrl = `${PROD_BASE}/d/${params.shareCode}`;

      return {
        meta: [
          { title },
          { property: "og:title", content: title },
          { property: "og:url", content: ogUrl },
          { property: "og:type", content: "website" },
          { property: "og:image", content: MOCK_VIDEO_INFO.cafeTour.thumbnailUrl },
        ],
      };
    } catch {
      return { meta: [{ title: BRAND_TITLE }] };
    }
  },
  errorComponent: PublicDropRouteErrorFallback,
  component: DropShareRoutePage,
});

/** root ErrorComponent 대신 mock Drop — PublicDropShareView 재호출 금지 */
function PublicDropRouteErrorFallback({ error }: { error: Error }) {
  console.error("[d/$shareCode route error]", error);
  let shareCode = "test";
  let variant: DropVariant = "info";
  try {
    shareCode = Route.useParams().shareCode ?? "test";
    variant = normalizeVariant(Route.useSearch({ select: (s) => s.variant }));
  } catch {
    /* defaults */
  }
  return renderMockInfoDropPage(shareCode, variant);
}

function DropShareRoutePage() {
  const { shareCode, variant } = Route.useLoaderData();
  if (!isPublicDropMockPath(shareCode)) {
    // TODO: Step 5 완료 후 getDropDetail RPC — 지금은 mock fallback
    return renderMockInfoDropPage(shareCode, variant);
  }
  return renderMockInfoDropPage(shareCode, variant);
}
