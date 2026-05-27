import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { InfoDropPage } from "@/components/info-drop-page";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getAuthClient } from "@/lib/auth-context";
import {
  decodeReservationDates,
  isPublicDropMockPath,
  renderMockInfoDropPage,
  normalizeVariant,
  resolvePublicDropVariant,
  type DropVariant,
} from "@/lib/public-drop-page";
import { MOCK_DROP_VIEW_BY_VARIANT, MOCK_VIDEO_INFO } from "@/lib/mock-data";
import { infoDropAdapter, type DropDetailRpc } from "@/lib/adapters";
import type { ReservationDateItem } from "@/components/create-drop-wizard";

const PROD_BASE = "https://app.drop.how";
const BRAND_TITLE = "LinkDrop — 친구가 보내준 드롭";
const BRAND_DESCRIPTION = "영상 속 정보를 친구와 카톡으로 나누는 가장 빠른 방법";

// r = 메이커가 공유 URL 에 실어 보낸 예약 가능 날짜(base64url). 수신자 화면 달력용.
// u = 메이커가 입력한 예약 버튼 연결값(URL/연락처). 미리보기 CTA 클릭 시 연결.
// parentShareId / shareDepth / ref = 재공유 마커. 하나라도 있으면 read-only 모드.
type DropSearch = {
  variant?: DropVariant;
  r?: string;
  u?: string;
  parentShareId?: string;
  shareDepth?: number;
  ref?: string;
};

type MockLoaderData = {
  mode: "mock";
  shareUuid: string;
  variant: DropVariant;
  reservationDates: ReservationDateItem[];
  reservationUrl: string | null;
};
type DbLoaderData = { mode: "db"; detail: DropDetailRpc | null; shareUuid: string };
type LoaderData = MockLoaderData | DbLoaderData;

function mockLoaderData(
  shareUuid: string,
  searchVariant: unknown,
  reservationDates: ReservationDateItem[],
  reservationUrl: string | null,
): MockLoaderData {
  const code = shareUuid || "test";
  return {
    mode: "mock",
    shareUuid: code,
    variant: resolvePublicDropVariant(code, normalizeVariant(searchVariant)),
    reservationDates,
    reservationUrl,
  };
}

export const Route = createFileRoute("/d/$shareUuid")({
  validateSearch: (search: Record<string, unknown>): DropSearch => {
    const depthRaw = search.shareDepth;
    const depth =
      typeof depthRaw === "number"
        ? depthRaw
        : typeof depthRaw === "string" && /^\d+$/.test(depthRaw)
          ? Number(depthRaw)
          : undefined;
    return {
      variant: normalizeVariant(search.variant),
      r: typeof search.r === "string" ? search.r : undefined,
      u: typeof search.u === "string" ? search.u : undefined,
      parentShareId: typeof search.parentShareId === "string" ? search.parentShareId : undefined,
      shareDepth: depth,
      ref: typeof search.ref === "string" ? search.ref : undefined,
    };
  },
  loader: async ({ params, location }): Promise<LoaderData> => {
    const shareUuid = params.shareUuid ?? "";
    const searchVariant = (location.search as DropSearch)?.variant;
    // 메이커가 보낸 예약 가능 날짜(?r=) 디코딩 — 없으면 빈 배열.
    const reservationDates = decodeReservationDates((location.search as DropSearch)?.r);
    // 메이커가 보낸 예약 버튼 연결값(?u=) — preview 흐름에서 CTA 클릭 시 사용.
    const reservationUrl = (location.search as DropSearch)?.u ?? null;

    // test / preview-* → mock only (DB 미호출)
    if (isPublicDropMockPath(shareUuid)) {
      return mockLoaderData(shareUuid, searchVariant, reservationDates, reservationUrl);
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
  const [naverPending, setNaverPending] = useState(false);
  const [pendingNaverUrl, setPendingNaverUrl] = useState<string | null>(null);
  const [returnPrompt, setReturnPrompt] = useState(false);

  useEffect(() => {
    if (!pendingNaverUrl) return;
    const handler = () => {
      if (document.visibilityState === "visible") {
        setNaverPending(false);
        setReturnPrompt(true);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [pendingNaverUrl]);
  // ?u= — wizard 가 메이커 입력 예약 URL 을 query 로 운반. store.reservation_url 이
  // DB 에 아직 저장되지 않은 동안의 임시 경로 (Phase 1 호환).
  const search = Route.useSearch();

  // 재공유 마커 — parentShareId / shareDepth>0 / ref 중 하나라도 있으면 read-only.
  // 첫 수신자(마커 없음)는 기존 편집 가능 UI 유지.
  const isReshare = Boolean(
    search.parentShareId || (search.shareDepth ?? 0) > 0 || search.ref,
  );

  if (loaderData.mode === "mock") {
    return renderMockInfoDropPage(
      loaderData.shareUuid,
      loaderData.variant,
      loaderData.reservationDates,
      loaderData.reservationUrl,
      isReshare,
    );
  }

  const { detail, shareUuid } = loaderData;

  // 실제 share_uuid 인데 조회 실패 → mock info 변형으로 fallback (무로그인 화면 깨짐 방지)
  if (!detail) {
    return renderMockInfoDropPage(shareUuid, "info");
  }

  const props = infoDropAdapter(detail);
  // store.reservation_url 우선, 없으면 wizard 의 ?u= 사용. http(s) 만 허용.
  // InfoDropPage 가 이 값으로 CTA 활성/비활성 + 안내 문구를 결정한다.
  const reservationUrlSource = detail.store?.reservation_url ?? search.u ?? null;
  const reservationUrl = (() => {
    if (!reservationUrlSource) return null;
    try {
      const u = new URL(reservationUrlSource);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  })();
  // 예약 가능 날짜 — wizard 의 ?r= 디코드. DB 미저장이라 query param 으로 임시 운반.
  // 빈 배열이면 InfoDropPage 가 캘린더 카드를 자동 숨김.
  const reservationDatesFromQuery = decodeReservationDates(search.r);
  return (
    <>
      <InfoDropPage
        {...props}
        reservationDates={reservationDatesFromQuery}
        reservationUrl={reservationUrl}
        isReshare={isReshare}
        videoSourceUrl={detail.source?.source_url ?? undefined}
        officialStatus="user_shared"
        dropId={detail.drop.id}
        onPrimaryAction={() => {
          if (!reservationUrl || typeof window === "undefined") return;
          const safeRes =
            reservationUrl.startsWith("https://booking.naver.com") ||
            reservationUrl.startsWith("https://naver.me") ||
            reservationUrl.startsWith("tel:");
          if (safeRes) {
            setPendingNaverUrl(reservationUrl);
            setNaverPending(true);
          }
        }}
        onWatchOriginal={() => {
          const url = detail.source?.source_url;
          if (!url || typeof window === "undefined") return;
          const safeVid =
            url.startsWith("https://www.youtube.com") ||
            url.startsWith("https://youtu.be") ||
            url.startsWith("https://www.instagram.com");
          if (safeVid) window.open(url, "_blank", "noopener,noreferrer");
        }}
        onBack={() => window.history.back()}
        onShare={() => console.log("[d/$shareUuid] share", shareUuid)}
        onSave={() => console.log("[d/$shareUuid] save (Phase 2)")}
        onForward={() => console.log("[d/$shareUuid] forward")}
      />

      <Sheet open={naverPending} onOpenChange={setNaverPending}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 px-6">
          <div className="flex flex-col gap-3 pt-6">
            <h2 className="text-lg font-bold tracking-ko text-text-strong">
              네이버 예약 페이지로 이동합니다
            </h2>
            <p className="text-sm tracking-ko text-text-muted">
              예약 완료 후 이 화면으로 돌아오세요
            </p>
            <button
              type="button"
              onClick={() => {
                if (pendingNaverUrl) {
                  window.open(pendingNaverUrl, "_blank", "noopener,noreferrer");
                }
              }}
              className="w-full min-h-[44px] rounded-2xl bg-[#2563EB] py-4 font-bold text-white"
            >
              예약 페이지 열기
            </button>
            <button
              type="button"
              onClick={() => {
                setNaverPending(false);
                setPendingNaverUrl(null);
              }}
              className="min-h-[44px] text-sm text-[#A3A3A3]"
            >
              취소
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={returnPrompt} onOpenChange={setReturnPrompt}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 px-6">
          <div className="flex flex-col gap-3 pt-6">
            <h2 className="text-lg font-bold tracking-ko text-text-strong">
              예약하셨나요?
            </h2>
            <button
              type="button"
              onClick={() => {
                setReturnPrompt(false);
                setPendingNaverUrl(null);
              }}
              className="w-full min-h-[44px] rounded-2xl bg-[#2563EB] py-4 font-bold text-white"
            >
              예약했어요
            </button>
            <button
              type="button"
              onClick={() => setReturnPrompt(false)}
              className="min-h-[44px] text-sm text-[#A3A3A3]"
            >
              나중에 할게요
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
