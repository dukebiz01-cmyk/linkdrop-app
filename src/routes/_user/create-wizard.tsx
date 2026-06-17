import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateDropWizard } from "@/components/create-drop-wizard";
import { getAuthClient } from "@/lib/auth-context";
import type { DropPurpose } from "@/lib/types";
import type { VideoMetadata } from "@/lib/video-metadata";

// phase1 B: 비지니스 게이팅 — me.tsx:117 동일 패턴.
// chunk1 1c: source_id prefill — 탐색에서 진입 시 content_sources 단건 lookup.
type CreateWizardLoaderData = {
  isBusiness: boolean;
  prefillUrl: string | null;
  prefillMetadata: VideoMetadata | null;
};

/**
 * v3 5단계 카드 만들기 wizard.
 * WHY: 기존 /create(BlockEditor·Supabase 분리 INSERT)는 유지하고, 신규 UX는 별도 라우트로 검증한다.
 * WHY: Home 에서 url+purpose 를 search param 으로 넘기면 Step 1·2 를 "확인" 모드로 — 같은 질문 반복 X.
 */

type CreateWizardSearch = {
  url?: string;
  purpose?: string;
  intent_suggested?: string;
  confidence?: string;
  source_id?: string;
  platform?: string;
  /** chunk1 1d — 탐색 카드에서 진입 시 본인 매장 자동 연결 */
  partner_id?: string;
};

// Home(purpose-suggestion.ts)은 영문 Purpose, wizard 는 한국어 DropPurpose 사용 → 매핑.
const PURPOSE_EN_TO_KO: Record<string, DropPurpose> = {
  info: "정보",
  coupon: "쿠폰",
  reservation: "예약",
  purchase: "구매",
  lead: "상담",
};

function toDropPurpose(raw: string | undefined): DropPurpose | undefined {
  if (!raw) return undefined;
  return (
    PURPOSE_EN_TO_KO[raw] ??
    (Object.values(PURPOSE_EN_TO_KO).includes(raw as DropPurpose)
      ? (raw as DropPurpose)
      : undefined)
  );
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function toConfidence(v: string | undefined): "high" | "medium" | "low" | undefined {
  return v === "high" || v === "medium" || v === "low" ? v : undefined;
}

export const Route = createFileRoute("/_user/create-wizard")({
  head: () => ({ meta: [{ title: "카드 만들기" }] }),
  validateSearch: (search: Record<string, unknown>): CreateWizardSearch => ({
    url: str(search.url),
    purpose: str(search.purpose),
    intent_suggested: str(search.intent_suggested),
    confidence: str(search.confidence),
    source_id: str(search.source_id),
    platform: str(search.platform),
    partner_id: str(search.partner_id),
  }),
  loader: async ({ location }): Promise<CreateWizardLoaderData> => {
    const supabase = await getAuthClient();
    const empty = { isBusiness: false, prefillUrl: null, prefillMetadata: null };
    if (!supabase) return empty;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty;
    const { data: isBusiness } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });

    // chunk1 1c — source_id prefill: 탐색 카드에서 진입 시 content_sources 단건
    //   lookup 후 initialUrl + initialMetadata 주입. 행 없으면 graceful (빈 prefill).
    const rawSearch = location.search as Record<string, unknown> | undefined;
    const sourceIdRaw = typeof rawSearch?.source_id === "string" ? rawSearch.source_id : null;
    let prefillUrl: string | null = null;
    let prefillMetadata: VideoMetadata | null = null;
    if (sourceIdRaw) {
      const { data: source } = await supabase
        .from("content_sources")
        .select("id, provider, source_url, title, author_name, thumbnail_url")
        .eq("id", sourceIdRaw)
        .maybeSingle();
      if (source?.source_url) {
        prefillUrl = source.source_url;
        const platform = source.provider === "instagram" ? "instagram" : "youtube";
        prefillMetadata = {
          platform,
          sourceUrl: source.source_url,
          sourceId: source.id,
          title: source.title ?? "",
          authorName: source.author_name ?? undefined,
          thumbnailUrl: source.thumbnail_url ?? undefined,
          fetchedBy: platform === "youtube" ? "youtube_fallback" : "instagram_fallback",
        };
      }
    }

    return {
      isBusiness: Boolean(isBusiness),
      prefillUrl,
      prefillMetadata,
    };
  },
  component: CreateWizardPage,
});

function CreateWizardPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { isBusiness, prefillUrl, prefillMetadata } = Route.useLoaderData();

  // phase1 B 방어: 일반 사용자가 prefill purpose="쿠폰" 으로 진입하면 "정보"로 폴백.
  const initialPurposeRaw = toDropPurpose(search.purpose);
  const initialPurposeGated =
    isBusiness || initialPurposeRaw === "정보"
      ? initialPurposeRaw
      : initialPurposeRaw
        ? ("정보" as const)
        : undefined;

  // chunk1 1c — search.url(직접 입력) 우선, 없으면 content_sources prefill 사용.
  const resolvedInitialUrl = search.url ?? prefillUrl ?? undefined;
  const resolvedInitialMetadata = search.url ? null : prefillMetadata;

  return (
    <CreateDropWizard
      // 가져오기/외부 진입(?source_id=·?url=) 시 prefill 을 새로 적용하려면 remount 필요
      // (위저드 내부 url state 는 initial* prop 변경을 무시하므로). 내부 입력 중엔 search 불변 → 안정.
      key={search.source_id ?? search.url ?? "fresh"}
      isBusiness={isBusiness}
      initialUrl={resolvedInitialUrl}
      initialMetadata={resolvedInitialMetadata}
      initialPurpose={initialPurposeGated}
      initialSuggestedPurpose={toDropPurpose(search.intent_suggested)}
      initialSuggestionConfidence={toConfidence(search.confidence)}
      initialPlatform={search.platform}
      initialSourceId={search.source_id}
      // ② AI 추천 매장 신호 — 이 드롭이 타깃하는 매장(탐색 진입 시 자동 연결).
      initialPartnerId={search.partner_id}
      onClose={() => navigate({ to: "/home" })}
      onComplete={async (data) => {
        // wizard 의 첫 카카오톡 공유/링크 복사 클릭 시 호출.
        // POST /api/drops 로 실제 저장하고 share_uuid + 공유 URL 을 반환한다.

        // ③ 카드 담기 — blocks 일반화. 구매면 본체 product 블록(pos 0) 유지 후
        //   담은 상품(attachedProducts)을 product 블록 N개로 이어붙인다(position 연속).
        //   구매 아니면 담은 상품만(pos 0..N). create_drop_v2(p_blocks) 시그니처 무변경.
        const blocks: Array<Record<string, unknown>> = [];
        if (data.purpose === "구매") {
          blocks.push({
            block_kind: "product",
            block_data: {
              name: data.productName ?? null,
              price_krw: data.priceKrw ?? null,
              buy_url: data.video.url,
            },
            position: 0,
          });
        }
        for (const p of data.attachedProducts ?? []) {
          // 나-2 — 저장 카피 스냅샷도 block_data 에 동봉(있을 때만). is_promo 없음(일반 상품).
          const points = (p.sellingPoints ?? []).map((s) => s.trim()).filter(Boolean);
          const headline = (p.headline ?? "").trim();
          blocks.push({
            block_kind: "product",
            block_data: {
              ref_drop_id: p.refDropId,
              ref_share_uuid: p.refShareUuid,
              name: p.name,
              price_krw: p.priceKrw,
              image_url: p.imageUrl,
              ...(headline ? { headline } : {}),
              ...(points.length > 0 ? { selling_points: points } : {}),
            },
            position: blocks.length,
          });
        }
        // B 상품 홍보 카드 — block_kind="product"(enum 재사용) + is_promo:true 로 구분.
        //   "관련 상품"(is_promo 없음)과 같은 enum, block_data 키로만 분기 → DDL 0.
        if (data.promoCard) {
          const pc = data.promoCard;
          blocks.push({
            block_kind: "product",
            block_data: {
              ref_drop_id: pc.refDropId,
              ref_share_uuid: pc.refShareUuid,
              name: pc.name,
              price_krw: pc.priceKrw,
              image_url: pc.imageUrl,
              headline: pc.headline,
              selling_points: pc.sellingPoints,
              is_promo: true,
            },
            position: blocks.length,
          });
        }
        // G2 멀티소스 — primary 외 추가 콘텐츠를 영상=video / 글=article 블록으로 이어붙인다.
        //   create_drop_v2 는 block_kind 를 enum 캐스팅(article 은 옵션 A DDL 로 enum 에 추가됨).
        //   video_start/end_seconds 는 타임링크 추후 → 미전송(RPC NULL 처리).
        for (const v of data.attachedVideos ?? []) {
          blocks.push({
            block_kind: v.type === "article" ? "article" : "video",
            block_data: {
              provider: v.provider,
              source_id: v.sourceId,
              source_url: v.sourceUrl,
              canonical_url: v.canonicalUrl,
              title: v.title,
              thumbnail_url: v.thumbnailUrl,
              author_name: v.authorName,
              ...(v.snippet ? { snippet: v.snippet } : {}),
            },
            position: blocks.length,
          });
        }

        const res = await fetch("/api/drops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_url: data.video.url,
            purpose: data.purpose,
            curator_message: data.makerMessage || null,
            // chunk1 1d — 탐색 카드에서 진입한 경우 본인 매장 자동 연결.
            ...(search.partner_id ? { partner_id: search.partner_id } : {}),
            // F2 커머스(구매) — price_krw/category 는 content_sources 에 persist(Slice 1).
            //   가격/상품명은 렌더용 product 블록(blocks)으로도 운반.
            ...(data.purpose === "구매"
              ? { price_krw: data.priceKrw ?? null, category: data.category ?? null }
              : {}),
            // blocks: 구매 본체 + 담은 상품. 비어있지 않을 때만 전송.
            ...(blocks.length > 0 ? { blocks } : {}),
          }),
        });
        const json = (await res.json()) as {
          drop?: { id?: string; share_uuid?: string };
          shareable_url?: string;
          message?: string;
        };
        if (!res.ok || !json.drop?.share_uuid) {
          throw new Error(json.message ?? "DROP_CREATE_FAILED");
        }
        const shareUuid = json.drop.share_uuid;
        const dropId = json.drop.id ?? null;
        // v5.12 — 쿠폰 목적에서 메이커가 직접 선택한 funnel coupon 적용.
        // 실패해도 공유 자체는 진행 (best-effort).
        if (dropId && data.selectedFunnelCouponId) {
          try {
            const { getSupabase } = await import("@/lib/supabase");
            const supabase = getSupabase();
            if (supabase) {
              const { error } = await supabase.rpc("set_drop_funnel_coupon", {
                p_drop_id: dropId,
                p_coupon_id: data.selectedFunnelCouponId,
              });
              if (error) {
                console.warn("[wizard] set_drop_funnel_coupon failed:", error.message);
              }
            }
          } catch (e) {
            console.warn("[wizard] set_drop_funnel_coupon exception:", e);
          }
        }
        // 서버가 만든 단축 URL(drop.how/{6자}) 우선, 없으면 현재 origin 기준 긴 URL fallback
        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
        const shareUrl = json.shareable_url ?? `${origin}/d/${shareUuid}`;
        return { shareUuid, shareUrl };
      }}
    />
  );
}
