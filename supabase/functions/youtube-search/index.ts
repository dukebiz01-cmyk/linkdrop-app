// youtube-search — FIX-44 영상 서치 도우미 v1 (YouTube 한정 락 · B안: 클라 검색+선택).
//
// POST { q: string }
// → { candidates: [{ video_id, title, channel_title, thumbnail_url, published_at }] }
//
// 명세(41창 검수 경유 — 이탈 금지):
//   · YouTube Data API v3 search.list — q(사용자 검색어+매장명), type=video,
//     maxResults=5(서버 고정 상한 — 클라 지정 불가), regionCode=KR, relevanceLanguage=ko.
//   · 키 = Edge secret YOUTUBE_API_KEY — Deno.env.get 전용(코드 리터럴 절대 금지, 클라 노출 0).
//   · ⚠️ AI 호출 아님 — check_ai_quota/record_ai_generation 골격 미사용(41창 지시:
//     AI 쿼터 오소모·비용 장부 오염 방지). 경량 가드만:
//     인증 필수(verify_jwt 플랫폼 검증 + Authorization 헤더 확인) / q 필수·길이 상한 80.
//   · 응답 = API 실값 그대로(서버 재작성·요약 금지). 반환 후 처리 없음 —
//     기록 테이블 신설 금지(v1).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

const MAX_QUERY_LEN = 80;
const MAX_RESULTS = 5; // 고정 — 요청 body 로 변경 불가.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }
  // 인증 — 1차는 verify_jwt(플랫폼 게이트웨이). 헤더 부재 방어(--no-verify-jwt 배포 사고 대비).
  if (!req.headers.get("Authorization")) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "로그인이 필요해요." }, 401);
  }
  if (!YOUTUBE_API_KEY) {
    // 키 미설정 — 정직 표기(클라는 폴백 문구로 전환). 가짜 후보 생성 금지.
    return jsonResponse({ error: "UNCONFIGURED", message: "검색 키가 설정되지 않았어요." }, 503);
  }

  let q = "";
  try {
    const body = (await req.json()) as { q?: unknown };
    q = typeof body.q === "string" ? body.q.trim() : "";
  } catch {
    // body 파싱 실패 → 아래 MISSING_QUERY 로 수렴.
  }
  if (!q) {
    return jsonResponse({ error: "MISSING_QUERY", message: "검색어를 입력해 주세요." }, 400);
  }
  if (q.length > MAX_QUERY_LEN) {
    return jsonResponse({ error: "QUERY_TOO_LONG", message: "검색어가 너무 길어요." }, 400);
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(MAX_RESULTS));
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("key", YOUTUBE_API_KEY);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[youtube-search] upstream ${res.status}: ${detail.slice(0, 200)}`);
      return jsonResponse(
        { error: "YOUTUBE_SEARCH_FAILED", message: "영상 검색에 실패했어요." },
        502,
      );
    }
    const data = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          publishedAt?: string;
          thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
          };
        };
      }>;
    };
    // API 실값 그대로 이관 — 재작성·요약·필터링 창작 0. videoId 없는 행만 제외.
    const candidates = (data.items ?? []).flatMap((it) => {
      const vid = it.id?.videoId;
      if (!vid) return [];
      const sn = it.snippet ?? {};
      return [
        {
          video_id: vid,
          title: sn.title ?? null,
          channel_title: sn.channelTitle ?? null,
          thumbnail_url:
            sn.thumbnails?.high?.url ??
            sn.thumbnails?.medium?.url ??
            sn.thumbnails?.default?.url ??
            null,
          published_at: sn.publishedAt ?? null,
        },
      ];
    });
    return jsonResponse({ candidates });
  } catch (e) {
    console.error("[youtube-search] fetch error:", e);
    return jsonResponse({ error: "INTERNAL_ERROR", message: "영상 검색에 실패했어요." }, 500);
  }
});
