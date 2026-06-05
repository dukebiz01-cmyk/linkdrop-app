import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InfoDropPage } from "@/components/info-drop-page";
import { ReserveFunnelSheet } from "@/components/receiver/ReserveFunnelSheet";
import type { ReservationSelection } from "@/components/reservation-calendar-page";
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
import { trackReceiverEvent } from "@/lib/event-tracking";
import { shareToKakao } from "@/lib/kakao";
import { startKakaoLogin } from "@/lib/oauth-kakao";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { ReservationDateItem } from "@/components/create-drop-wizard";

// 로컬 Date → "YYYY-MM-DD" (인앱 예약 신청 prefill·URL 운반용).
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const PROD_BASE = "https://app.drop.how";
const BRAND_TITLE = "LinkDrop — 친구가 보내준 카드";
const BRAND_DESCRIPTION = "영상 속 정보를 친구와 카톡으로 나누는 가장 빠른 방법";

// description fallback chain: ai_summary → curator_message → 정적 기본. 200자 cap.
function buildDescription(detail: {
  drop?: { ai_summary?: string | null } | null;
  curator_message?: string | null;
} | null): string {
  const candidates = [
    detail?.drop?.ai_summary,
    detail?.curator_message,
    BRAND_DESCRIPTION,
  ];
  const picked = candidates.find(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  const text = picked ?? BRAND_DESCRIPTION;
  return text.length > 200 ? text.slice(0, 197) + "..." : text;
}

// twitter:card 결정 — og:image 있으면 large_image, 없으면 summary.
function pickTwitterCard(
  imageUrl: string | null | undefined,
): "summary_large_image" | "summary" {
  return imageUrl && imageUrl.trim().length > 0 ? "summary_large_image" : "summary";
}

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
  // B3: OAuth 복귀 후 쿠폰 자동 발급 표식.
  coupon?: string;
  // A안 직접예약: OAuth 복귀 후 예약 신청 시트 자동 오픈 표식 + 캘린더 선택값 운반.
  reserve?: string;
  ci?: string; // check-in  (YYYY-MM-DD)
  co?: string; // check-out (YYYY-MM-DD)
  g?: string; // guest count
};

// P3 — get_available_slots 반환 행. SSR loader 가 미리 가져와 HTML 에 실어 보낸다.
// (카카오 WebView 에서 클라 useEffect fetch 가 실패해 '남은 N자리' 가 안 뜨던 문제 대응.)
type SlotRow = {
  slot_date: string;
  slot_time: string | null;
  max_capacity: number;
  current_bookings: number;
  available: number;
};

type MockLoaderData = {
  mode: "mock";
  shareUuid: string;
  variant: DropVariant;
  reservationDates: ReservationDateItem[];
  reservationUrl: string | null;
  slots: SlotRow[];
};
type DbLoaderData = {
  mode: "db";
  detail: DropDetailRpc | null;
  shareUuid: string;
  slots: SlotRow[];
};
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
    slots: [],
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
      coupon: typeof search.coupon === "string" ? search.coupon : undefined,
      reserve: typeof search.reserve === "string" ? search.reserve : undefined,
      ci: typeof search.ci === "string" ? search.ci : undefined,
      co: typeof search.co === "string" ? search.co : undefined,
      g: typeof search.g === "string" ? search.g : undefined,
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
      if (!supabase) return { mode: "db", detail: null, shareUuid, slots: [] };
      const { data, error } = await supabase.rpc("get_drop_detail", {
        p_share_uuid: shareUuid,
      });
      if (error || !data) return { mode: "db", detail: null, shareUuid, slots: [] };
      const detail = data as unknown as DropDetailRpc;

      // P3 — partner_id 있으면 슬롯도 SSR 에서 미리 가져온다(get_drop_detail 과 동일 인스턴스).
      // anon EXECUTE 확인 완료. 실패해도 페이지는 정상 — slots=[] 로 두는 graceful 패턴.
      // p_date = Asia/Seoul 오늘(서버 UTC 무관). en-CA → "YYYY-MM-DD".
      let slots: SlotRow[] = [];
      const partnerId = detail.drop?.partner_id ?? null;
      if (partnerId) {
        try {
          const kstToday = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
          }).format(new Date());
          const { data: slotData, error: slotError } = await supabase.rpc(
            "get_available_slots",
            { p_partner_id: partnerId, p_date: kstToday },
          );
          if (!slotError && Array.isArray(slotData)) {
            slots = slotData as unknown as SlotRow[];
          }
        } catch (slotErr) {
          console.error("[d/$shareUuid loader] get_available_slots", slotErr);
        }
      }
      return { mode: "db", detail, shareUuid, slots };
    } catch (err) {
      console.error("[d/$shareUuid loader]", err);
      return { mode: "db", detail: null, shareUuid, slots: [] };
    }
  },
  head: ({ loaderData, params }) => {
    // 세 분기(mock / db / catch fallback) 모두 동일한 메타 키 세트 반환. 분기별로
    // title / description / imageUrl 만 결정하고 메타 빌드는 공통. twitter:card 는
    // og:image 유무에 따라 summary_large_image vs summary 자동 선택.
    let title = BRAND_TITLE;
    let description = BRAND_DESCRIPTION;
    let imageUrl: string | null = null;
    let ogUrl = `${PROD_BASE}/d/${params.shareUuid ?? ""}`;

    try {
      if (loaderData?.mode === "mock") {
        const variant = loaderData.variant ?? "info";
        const mock = MOCK_DROP_VIEW_BY_VARIANT[variant] ?? MOCK_DROP_VIEW_BY_VARIANT.info;
        ogUrl = `${PROD_BASE}/d/${params.shareUuid}`;
        title = mock.title ?? BRAND_TITLE;
        description = buildDescription({
          drop: { ai_summary: mock.description },
          curator_message: mock.makerMessage,
        });
        imageUrl = MOCK_VIDEO_INFO.cafeTour.thumbnailUrl ?? null;
      } else if (loaderData?.mode === "db") {
        const detail = loaderData.detail;
        ogUrl = `${PROD_BASE}/d/${loaderData.shareUuid ?? ""}`;
        const srcTitle = detail?.source?.title ?? null;
        title = srcTitle ? `${srcTitle} | LinkDrop` : BRAND_TITLE;
        const baseDesc = buildDescription({
          drop: { ai_summary: detail?.drop?.ai_summary },
          curator_message: detail?.curator_message,
        });
        const makerName = detail?.maker?.display_name ?? null;
        const prefixed = makerName ? `${makerName}님이 보낸 카드 — ${baseDesc}` : baseDesc;
        description = prefixed.length > 200 ? prefixed.slice(0, 197) + "..." : prefixed;
        imageUrl = detail?.source?.thumbnail_url ?? null;
      }
      // else: catch fallback 기본값 그대로 유지
    } catch {
      // head() 평가 중 throw 시에도 동일 공통 빌드로 안전한 메타 반환.
      title = BRAND_TITLE;
      description = BRAND_DESCRIPTION;
      imageUrl = null;
    }

    const card = pickTwitterCard(imageUrl);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: ogUrl },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "LinkDrop" },
      { name: "twitter:card", content: card },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (imageUrl) {
      meta.push({ property: "og:image", content: imageUrl });
      meta.push({ name: "twitter:image", content: imageUrl });
    }
    return { meta };
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
  // A안 직접예약 — 인앱 신청 시트 + 캘린더 선택값 prefill.
  const [reserveSheetOpen, setReserveSheetOpen] = useState(false);
  const [reservePrefill, setReservePrefill] = useState<{
    checkIn: string;
    checkOut: string;
    guestCount: number;
  }>({ checkIn: "", checkOut: "", guestCount: 2 });
  // B3 — 로그인 유저 id + 쿠폰 발급 가드(중복 호출 차단). 마운트 시 getSession 으로 확인.
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [claimInFlight, setClaimInFlight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      // 카톡 웹뷰 복귀 — auth.callback 이 토큰을 hash 로 넘겨줌(#access_token&refresh_token).
      // 카드가 자기 컨텍스트에서 세션을 확보해 storage(쿠키) 미승계(시나리오 B) 를 우회한다.
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hasTokenHash = hash.includes("access_token");
      try {
        if (hasTokenHash) {
          // 1) detectSessionInUrl 이 이미 자동 처리했을 수 있음 → getSession 으로 먼저 확인
          //    (이미 세션 있으면 setSession 재세팅 생략 — 자동/수동 충돌 방지).
          let { data } = await supabase.auth.getSession();
          // 2) 자동 처리 안 됐으면 hash 토큰으로 직접 setSession.
          if (!data?.session) {
            const params = new URLSearchParams(hash.replace(/^#/, ""));
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");
            if (access_token && refresh_token) {
              const { data: setData, error } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              if (error) throw error;
              data = setData;
            }
          }
          const uid = data?.session?.user?.id ?? null;
          // 보안 — 인식/세팅 직후 hash 즉시 제거(?coupon=1 query 는 유지).
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }
          // 진단(✓/✗) 은 authChecked+coupon=1 alert 로 일원화 — 여기선 userId 세팅만.
          if (!cancelled) setUserId(uid);
        } else {
          const { data } = await supabase.auth.getSession();
          if (!cancelled) setUserId(data?.session?.user?.id ?? null);
        }
      } catch (e) {
        console.error("[d.$shareUuid] session restore failed:", e);
        if (!cancelled) {
          setUserId(null);
          if (hasTokenHash) {
            toast.error("로그인 정보를 불러오지 못했어요. 다시 시도해 주세요");
          }
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const { detail, shareUuid, slots } = loaderData;

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

  // 쿠폰 받기(sticky) — 예약(직접예약 시트)과 분리된 독립 흐름. claim_coupon RPC 만 호출.
  //   · userId 있음 → 즉시 claim_coupon → 토스트 안내 ("쿠폰 보기" 액션)
  //   · userId 없음 → 카카오 OAuth ?coupon=1 복귀 → useEffect 가 1 회 자동 발급
  // claim_coupon = (coupon_id, share_event_id, catcher_user_id) UNIQUE 멱등(#21).
  // visitor / 연락처 불필요. 달력 회귀 인상 0.
  const funnelCoupon = detail.coupon ?? null;
  const navigate = useNavigate();
  const claimedRef = useRef(false);
  const reserveResumeRef = useRef(false);
  const returnDiagRef = useRef(false);

  // 카드 복귀 — authChecked 완료 + ?coupon=1 인데 세션을 못 읽었으면(claim 불가) 안내. 1 회만.
  useEffect(() => {
    if (!authChecked) return;
    if (search.coupon !== "1") return;
    if (returnDiagRef.current) return;
    returnDiagRef.current = true;
    if (!userId) {
      toast.error("로그인 정보를 불러오지 못했어요. 다시 시도해 주세요");
    }
  }, [authChecked, search.coupon, userId]);

  async function claimCouponNow() {
    if (!funnelCoupon || claimInFlight) return;
    // 무음 금지 — 세션 풀림(userId null)이면 사용자에게 알리고 재시도 유도.
    if (!userId) {
      toast.error("로그인이 풀렸어요. 다시 눌러주세요");
      return;
    }
    setClaimInFlight(true);
    try {
      const supabase = getSupabase();
      const { data: se, error: seErr } = await supabase
        .from("share_events")
        .select("id")
        .eq("share_uuid", shareUuid)
        .maybeSingle();
      if (seErr || !se?.id) {
        toast.error("공유 정보를 찾을 수 없어요. 다시 시도해 주세요.");
        return;
      }
      const { data: claim, error: claimErr } = await supabase.rpc("claim_coupon", {
        p_coupon_id: funnelCoupon.id,
        p_share_event_id: se.id,
        p_catcher_user_id: userId,
      });
      if (claimErr) {
        console.error("[d.$shareUuid] claim_coupon failed:", claimErr);
        toast.error("쿠폰 발급에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const firstRow = Array.isArray(claim) ? claim[0] : null;
      const code =
        firstRow && typeof firstRow === "object" && firstRow !== null && "claim_code" in firstRow
          ? String((firstRow as { claim_code: unknown }).claim_code ?? "")
          : "";
      // 카톡 토스트는 순삭이라 결과를 못 봄 → 쿠폰 상세 페이지로 이동해 지속 확인.
      toast.success("쿠폰을 받았어요");
      if (code) {
        void navigate({ to: "/coupon/$claim_code", params: { claim_code: code } });
      } else {
        void navigate({ to: "/me" });
      }
    } catch (e) {
      console.error("[d.$shareUuid] claim_coupon unexpected:", e);
      toast.error("처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setClaimInFlight(false);
    }
  }

  // OAuth 복귀 ?coupon=1 + 로그인 + funnel coupon 있으면 1 회 자동 발급.
  useEffect(() => {
    if (!authChecked) return;
    if (search.coupon !== "1") return;
    if (!userId) return;
    if (!funnelCoupon) return;
    if (claimedRef.current) return;
    claimedRef.current = true;
    void claimCouponNow();
    // claimCouponNow 는 deps 제외 — 매 렌더 새 참조라 무한 루프 방지.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, search.coupon, userId, funnelCoupon]);

  function handleReserveAndClaim() {
    if (!funnelCoupon) return;
    if (userId) {
      void claimCouponNow();
      return;
    }
    // 미로그인 → 카카오 OAuth, next 로 현 /d/{shareUuid}?coupon=1 복귀.
    const next = `/d/${shareUuid}?coupon=1`;
    void startKakaoLogin(next);
  }

  // A안 직접예약 — '예약하기' 클릭. 로그인 강제(catcher_user_id abuse 방어) →
  //   userId 있음 → 시트 오픈(캘린더 선택값 prefill)
  //   userId 없음 → 카카오 OAuth, next 에 선택값 실어 복귀(?reserve=1&ci&co&g)
  function handleReservationRequest(selection?: ReservationSelection) {
    const ci = selection?.checkIn ? toIsoDate(selection.checkIn) : "";
    const co = selection?.checkOut ? toIsoDate(selection.checkOut) : "";
    const g = selection ? selection.adults + selection.children : 0;
    if (userId) {
      setReservePrefill({ checkIn: ci, checkOut: co, guestCount: g || 2 });
      setReserveSheetOpen(true);
      return;
    }
    const next = `/d/${shareUuid}?reserve=1&ci=${encodeURIComponent(ci)}&co=${encodeURIComponent(
      co,
    )}&g=${encodeURIComponent(String(g))}`;
    void startKakaoLogin(next);
  }

  // OAuth 복귀 ?reserve=1 + 로그인 → ci/co/g 읽어 prefill + 시트 자동 오픈. 1 회만.
  useEffect(() => {
    if (!authChecked) return;
    if (search.reserve !== "1") return;
    if (!userId) return;
    if (reserveResumeRef.current) return;
    reserveResumeRef.current = true;
    const g = Number(search.g);
    setReservePrefill({
      checkIn: search.ci ?? "",
      checkOut: search.co ?? "",
      guestCount: Number.isFinite(g) && g > 0 ? g : 2,
    });
    setReserveSheetOpen(true);
  }, [authChecked, search.reserve, search.ci, search.co, search.g, userId]);

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
        initialSlots={slots}
        funnelCoupon={
          funnelCoupon
            ? {
                id: funnelCoupon.id,
                title: funnelCoupon.title,
                conditions:
                  (funnelCoupon.conditions as {
                    min_amount?: number;
                    [k: string]: unknown;
                  } | null | undefined) ?? null,
                valid_until: funnelCoupon.valid_until ?? null,
                coupon_type: funnelCoupon.coupon_type ?? null,
                gift_item: funnelCoupon.gift_item ?? null,
              }
            : null
        }
        onReserveAndClaim={handleReserveAndClaim}
        onReservationRequest={(selection) => {
          trackReceiverEvent("reservation_click", detail.drop.id);
          handleReservationRequest(selection);
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
        onShare={() => trackReceiverEvent("share_click", detail.drop.id)}
        onKakaoShare={async () => {
          // BOOST1-RESHARE 와이어링 — 수신자 카톡 공유 = 진짜 재공유 (parent 연결).
          //   1. parent share_event_id 확보 (현재 share_uuid → id, ReserveFunnelSheet 패턴)
          //   2. ld_create_share_edge_v3 호출 (sender=userId 또는 NULL 무로그인, parent 연결)
          //   3. 반환 share_code → https://drop.how/{code} 새 단축링크
          //   4. 그 새 링크로 shareToKakao (title/desc/image 그대로)
          //   실패 시 폴백 — props.shareUrl (메이커 원본) 또는 긴 URL.
          //   공유 자체가 죽으면 안 됨 (RPC best-effort).
          trackReceiverEvent("share_click", detail.drop.id);

          let reshareLink: string | null = null;
          try {
            const supabase = getSupabase();
            const { data: parentEvent } = await supabase
              .from("share_events")
              .select("id")
              .eq("share_uuid", shareUuid)
              .maybeSingle();
            const parentId = parentEvent?.id ?? null;
            if (parentId) {
              const { data: edgeRows, error: edgeErr } = await supabase.rpc(
                "ld_create_share_edge_v3",
                {
                  p_info_drop_id: detail.drop.id,
                  p_sender_user_id: userId, // null = 무로그인 → 'anonymous'
                  p_channel: "kakao",
                  p_parent_share_event_id: parentId,
                },
              );
              if (!edgeErr) {
                const row = Array.isArray(edgeRows) ? edgeRows[0] : edgeRows;
                const newCode =
                  row && typeof row === "object" && "share_code" in row
                    ? String((row as { share_code: unknown }).share_code ?? "")
                    : "";
                if (newCode) {
                  // #27: drop.how 하드코딩 (window.location 금지)
                  reshareLink = `https://drop.how/${newCode}`;
                }
              } else {
                console.warn("[d/$shareUuid] reshare RPC failed:", edgeErr);
              }
            }
          } catch (e) {
            console.warn("[d/$shareUuid] reshare unexpected:", e);
          }

          const linkUrl =
            reshareLink ??
            props.shareUrl ??
            `https://app.drop.how/d/${detail.share_uuid}`;

          // BOOST2 — intent 별 CTA 버튼 1개. 라벨은 60대 친화 (#16).
          // 버튼 link = 본문 링크와 동일(=/d/ 새 단축링크 또는 폴백).
          const purposeRaw = String(detail.drop?.purpose ?? "").toLowerCase();
          let ctaTitle: string;
          if (
            purposeRaw === "reservation" ||
            purposeRaw === "예약" ||
            purposeRaw === "coupon" ||
            purposeRaw === "쿠폰"
          ) {
            ctaTitle = "예약하고 혜택 받기";
          } else if (purposeRaw === "purchase" || purposeRaw === "구매") {
            ctaTitle = "상품 보러 가기";
          } else {
            ctaTitle = "자세히 보기";
          }

          await shareToKakao({
            title: props.title || "LinkDrop",
            description: props.makerMessage ?? props.description ?? "",
            imageUrl: props.videoThumbnailUrl ?? "",
            linkUrl,
            buttons: [{ title: ctaTitle, link: linkUrl }],
          });
        }}
        onSave={() => console.log("[d/$shareUuid] save (Phase 2)")}
        onForward={() => console.log("[d/$shareUuid] forward")}
      />

      {/* A안 직접예약 — 인앱 신청 시트. 로그인 강제(userId 있을 때만 렌더). */}
      {userId ? (
        <ReserveFunnelSheet
          open={reserveSheetOpen}
          onOpenChange={setReserveSheetOpen}
          shareUuid={shareUuid}
          dropId={detail.drop.id}
          userId={userId}
          initialCheckIn={reservePrefill.checkIn}
          initialCheckOut={reservePrefill.checkOut}
          initialGuestCount={reservePrefill.guestCount}
        />
      ) : null}
    </>
  );
}
