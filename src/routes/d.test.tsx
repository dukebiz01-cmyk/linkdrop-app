import { createFileRoute } from "@tanstack/react-router";
import {
  renderMockInfoDropPage,
  normalizeVariant,
  type DropVariant,
} from "@/lib/public-drop-page";
import { MOCK_DROP_VIEW_BY_VARIANT, MOCK_VIDEO_INFO } from "@/lib/mock-data";

const BRAND_TITLE = "LinkDrop — 친구가 보내준 드롭";

type DropSearch = {
  variant?: DropVariant;
};

function safeVariant(searchVariant: unknown): DropVariant {
  try {
    return normalizeVariant(searchVariant);
  } catch {
    return "info";
  }
}

export const Route = createFileRoute("/d/test")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): DropSearch => ({
    variant: normalizeVariant(search.variant),
  }),
  loader: ({ location }): { variant: DropVariant; mock: true } => {
    try {
      const search = location.search as DropSearch;
      return { variant: safeVariant(search?.variant), mock: true };
    } catch (err) {
      console.error("[d/test loader]", err);
      return { variant: "info", mock: true };
    }
  },
  head: ({ loaderData }) => {
    try {
      const variant = loaderData?.variant ?? "info";
      const mock = MOCK_DROP_VIEW_BY_VARIANT[variant] ?? MOCK_DROP_VIEW_BY_VARIANT.info;
      return {
        meta: [
          { title: mock.title ?? BRAND_TITLE },
          { property: "og:title", content: mock.title ?? BRAND_TITLE },
          { property: "og:image", content: MOCK_VIDEO_INFO.cafeTour.thumbnailUrl },
        ],
      };
    } catch {
      return { meta: [{ title: BRAND_TITLE }] };
    }
  },
  errorComponent: DropTestErrorFallback,
  component: DropTestPage,
});

function DropTestErrorFallback({ error }: { error: Error }) {
  console.error("[d/test route error]", error);
  let variant: DropVariant = "info";
  try {
    variant = normalizeVariant(Route.useSearch({ select: (s) => s.variant }));
  } catch {
    /* info fallback */
  }
  return renderMockInfoDropPage("test", variant);
}

function DropTestPage() {
  let variant: DropVariant = "info";
  try {
    const fromLoader = Route.useLoaderData()?.variant;
    const fromSearch = Route.useSearch({ select: (s) => s.variant });
    variant = safeVariant(fromLoader ?? fromSearch);
  } catch (err) {
    console.error("[d/test page]", err);
  }
  return renderMockInfoDropPage("test", variant);
}
