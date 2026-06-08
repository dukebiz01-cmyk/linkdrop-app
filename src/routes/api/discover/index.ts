// POST /api/discover — 매장 키워드 → 자동 보강 → YouTube 검색 후보
//
// 동작:
//   1) auth.getUser() — 로그인 필수 (사업자 게이트 해제: 일반 손님 개방).
//   2) approved partner 조회 (body.partner_id 우선, 없으면 첫 행). 손님은 null.
//   4) enhancedQuery 생성 — display_name / metadata.sub_category / address 첫 토큰
//      을 합쳐 매장 매칭 정확도 ↑. 길이 상한 60.
//   5) invokeEdge('discover-content', { keyword: enhancedQuery }).
//   6) response { rawQuery, enhancedQuery, candidates, stats, errors }.
//
// 인스타/틱톡/네이버클립 자동 검색 X (이번 청크 명시). URL 직접 입력은
// chunk1 의 "내가 모은 콘텐츠" 경로에서 향후 별도 처리.

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { invokeEdge } from "@/lib/edge-invoke.server";

type DiscoverBody = {
  keyword?: string;
  partner_id?: string;
};

type DiscoverCandidate = {
  provider: "youtube";
  source_url: string;
  source_id: string;
  canonical_url: string;
  title: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  duration_sec: number | null;
  raw_meta: Record<string, unknown>;
};

type DiscoverStats = { yt: number; kept: number };

type PartnerRow = {
  id: string;
  display_name: string | null;
  address: string | null;
  metadata: Record<string, unknown> | null;
};

const ENHANCED_MAX_LEN = 60;
const ENHANCED_MAX_TOKENS = 3;

// sub_category 영문 enum → 한글 라벨. metadata.sub_category 가 한글이면 그대로.
const SUB_CATEGORY_KR: Record<string, string> = {
  camping_site: "캠핑장",
  glamping: "글램핑",
  pension: "펜션",
  hotel: "호텔",
  stay: "숙박",
  restaurant: "식당",
  cafe: "카페",
  bakery: "베이커리",
  bar: "바",
  beauty: "미용",
  hair: "헤어",
  nail: "네일",
  experience: "체험",
  medical: "의료",
  clinic: "클리닉",
  shop: "쇼핑",
  store: "매장",
};

function subCategoryToKorean(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const raw = (meta as { sub_category?: unknown }).sub_category;
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // 이미 한글이면 그대로, 영문 enum 이면 매핑.
  if (/[가-힣]/.test(trimmed)) return trimmed;
  return SUB_CATEGORY_KR[trimmed] ?? "";
}

// 행정구역 단위 토큰 추출.
//   1순위: 군/구 (좁은 단위) — "괴산군"→"괴산", "강남구"→"강남".
//   2순위: 시 단위 — "수원시"→"수원". 단 광역시/특별시 ("서울특별시"·
//          "부산광역시"·"세종특별자치시" 등) 는 너무 광범위해 제외.
//   매칭 없으면 빈 문자열.
const MEGA_REGION_RE =
  /^(서울특별|부산광역|대구광역|인천광역|광주광역|대전광역|울산광역|세종특별|세종특별자치|제주특별|제주특별자치|강원특별자치|전북특별자치)$/;
const MEGA_CITY_RE = /^(서울|부산|대구|인천|광주|대전|울산|세종|제주)$/;

function pickRegionToken(address: string | null): string {
  if (!address) return "";
  // 1순위 — 군/구
  const m1 = address.match(/([가-힣]{1,4})(?:군|구)/);
  if (m1?.[1]) return m1[1].trim();
  // 2순위 — 시 (광역 단위 제외)
  for (const m of address.matchAll(/([가-힣]{1,5})시/g)) {
    const t = (m[1] ?? "").trim();
    if (!t) continue;
    if (MEGA_REGION_RE.test(t) || MEGA_CITY_RE.test(t)) continue;
    return t;
  }
  return "";
}

function buildEnhancedQuery(raw: string, partner: PartnerRow | null): string {
  const base = raw.trim();
  if (!partner) return base;

  const subKr = subCategoryToKorean(partner.metadata);
  const region = pickRegionToken(partner.address);

  const tokens: string[] = [];
  if (base) tokens.push(base);
  if (subKr && !base.includes(subKr)) tokens.push(subKr);
  if (region && !base.includes(region)) tokens.push(region);

  const dedup = Array.from(new Set(tokens.filter(Boolean))).slice(0, ENHANCED_MAX_TOKENS);
  const joined = dedup.join(" ");
  return joined.length > ENHANCED_MAX_LEN ? joined.slice(0, ENHANCED_MAX_LEN).trim() : joined;
}

export const Route = createFileRoute("/api/discover/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const supabase = getSupabaseServer();

          // 1. 인증
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            return Response.json(
              { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
              { status: 401 },
            );
          }

          // 2. 일반 손님 개방 — 비지니스 게이트 제거. 로그인(user)만 요구.
          //   partner 조회(아래 4)는 그대로 두되, 손님이면 null → buildEnhancedQuery
          //   가 원시 키워드로 fallback (null 안전).

          // 3. 입력
          const body = (await request.json()) as DiscoverBody;
          const raw = (body.keyword ?? "").trim();
          if (!raw) {
            return Response.json(
              { error: "MISSING_KEYWORD", message: "검색어를 입력해 주세요." },
              { status: 400 },
            );
          }
          if (raw.length > 80) {
            return Response.json(
              { error: "KEYWORD_TOO_LONG", message: "검색어가 너무 길어요." },
              { status: 400 },
            );
          }

          // 4. partner 조회 (body.partner_id 우선, 없으면 첫 approved)
          let partner: PartnerRow | null = null;
          if (body.partner_id) {
            const { data } = await supabase
              .from("partners")
              .select("id, display_name, address, metadata")
              .eq("id", body.partner_id)
              .eq("owner_user_id", user.id)
              .eq("verification_status", "approved")
              .maybeSingle();
            partner = (data as PartnerRow | null) ?? null;
          }
          if (!partner) {
            const { data } = await supabase
              .from("partners")
              .select("id, display_name, address, metadata")
              .eq("owner_user_id", user.id)
              .eq("verification_status", "approved")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            partner = (data as PartnerRow | null) ?? null;
          }

          // 5. 보강 키워드
          const enhancedQuery = buildEnhancedQuery(raw, partner);

          // 6. Edge Function 호출
          const { data: sess } = await supabase.auth.getSession();
          const jwt = sess.session?.access_token ?? null;
          const edge = await invokeEdge<{
            candidates: DiscoverCandidate[];
            stats: DiscoverStats;
            errors: Record<string, string>;
            cached: boolean;
          }>("discover-content", { keyword: enhancedQuery }, jwt);

          if (edge.error || !edge.data) {
            return Response.json(
              {
                error: "DISCOVER_FAILED",
                message: "검색에 실패했어요. 잠시 후 다시 시도해 주세요.",
              },
              { status: 502 },
            );
          }

          return Response.json({
            rawQuery: raw,
            enhancedQuery,
            candidates: edge.data.candidates ?? [],
            stats: edge.data.stats ?? { yt: 0, kept: 0 },
            cached: Boolean(edge.data.cached),
          });
        } catch (e) {
          return Response.json(
            {
              error: "INTERNAL_ERROR",
              message: "서버 오류가 발생했어요.",
              details: e instanceof Error ? e.message : String(e),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
