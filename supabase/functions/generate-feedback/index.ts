// generate-feedback — 크리에이터 성과 집계(get_creator_performance) → 성과 코칭 피드백 (Claude Sonnet 4.6)
//
// POST { period?: '7d'|'30d'|'all' }  (기본 '30d')
// → 고정 출력 스키마(아래) JSON.
//
// 설계:
//   - 숫자 생성 0. 주어진 실측 집계만 해석·우선순위·문구화(Sonnet 에 강한 가드).
//   - 호출자 JWT(Authorization)로 user 클라이언트 생성 → get_creator_performance(period) RPC
//     (auth.uid() = 호출자 보장. ① 함수 무수정, 호출만).
//   - 데이터 게이트: level==='insufficient'(드롭<3) → Sonnet 미호출, status:'collecting' 즉시 반환(비용 0).
//   - 캐시: ai_feedback_cache (user_id, period) 6h 이내면 payload 재사용(Sonnet 미호출). service role upsert.
//   - 프롬프트 캐싱: system 블록 cache_control(ephemeral) — 반복분 -90%.
//   - 파싱 실패 시 안전 fallback(빈 insights + parse_error 플래그), 앱 안 깨지게. fallback 은 캐시 안 함.
//
// 보존: 기존 Edge(generate-summary/promo-copy/detect-product) 무수정. ANTHROPIC_API_KEY 서버 시크릿(VITE_ 금지).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_PUBLISHABLE_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// service role 클라이언트 — 캐시 upsert(RLS 우회) 전용. user_id 는 호출자 uid 로 못박는다.
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 900;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const ICON_HINTS = new Set(["trophy", "clock", "channel", "funnel", "chart"]);

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

// ── Sonnet system 프롬프트 (가드 + few-shot + 출력 스키마). cache_control 로 캐싱. ──
const SYSTEM_PROMPT = `너는 LinkDrop 크리에이터의 '코치'다. 다음에 무엇을 어떻게 만들고 배포할지(미래·입력)만 조언한다. 매장의 확정 성과(전환·쿠폰사용·예약·정산)를 회고·진단하지 않는다 — 그건 별도 '진단' 기능의 몫이다. 전환 데이터는 미래 제작·배포 제안의 근거로만 쓰고, 결과 자체를 평가·처방하지 마라.
- 입력은 실측 집계 숫자다. 이 숫자만 인용한다. 없는 숫자·없는 비교를 새로 만들지 마라(절대).
- metrics 에 주어진 숫자는 그대로 쓴다. 반올림·근사·변경 금지(예: 1094 를 1095 로 쓰지 마라).
- funnel 순서 = shares → clicks → conversions. 공유하면 받은 사람이 클릭하고 그중 일부가 전환한다. clicks 는 shares 의 하류(결과)다. 비율은 '공유 1건당 클릭 N건'(clicks/shares = 도달 증폭)으로 해석하고, '클릭이 공유를 만든다'식 역방향이나 '공유 전환율' 같은 표현은 쓰지 마라.
- '드롭 수를 줄여라 / 새 드롭을 적게 만들어라 / 제작을 줄여라' 식 조언은 금지다. 플랫폼은 더 많은 드롭 제작을 장려한다. 조언은 항상 '각 드롭을 더 공유될 만하게(공유 동기·혜택 명시 등)' 만드는 데 초점을 둔다. 볼륨과 품질을 '적게 만들고 잘'식 트레이드오프로 프레이밍하지 말고 둘 다 권장하라.
- 확신도는 data_sufficiency 의 2개 축으로 따로 지배된다:
   * activity_level → 활동·도달 주장(공유 수·클릭·도달·드롭 수)의 확신도를 지배.
   * conversion_level → 전환 패턴 주장(전환율·시간대별·목적별·드롭별 성과)의 확신도를 지배.
   각 축 공통 규칙:
     insufficient → 그 영역의 주장 자체를 하지 마라(언급 금지).
     tentative   → '~하는 경향이 보여요'처럼 완화해 말한다.
     confident   → '~배'처럼 단정해도 된다.
- conversion_level 이 insufficient 또는 tentative 면 전환 패턴을 단정하지 말고, 활동·도달(공유·클릭·드롭) 코칭에 집중한다.
- per_drop 의 각 항목에는 reliable(boolean) 이 있다. reliable=false 인 드롭은 표본 부족이므로 '성과'나 conversion_rate 로 절대 언급하지 마라(전환 관련 비교/단정 금지).
- 각 insight = (근거 숫자 명시) + (짧은 해석) + (구체적 다음 액션). 일반론 금지('좋은 콘텐츠를 만드세요' 류 금지).
- recommendations = 데이터에서 실제로 나온 패턴만 2~3개.
- insights 와 recommendations 의 각 항목은 서로 다른 각도여야 한다. 같은 지표·같은 포인트를 여러 항목에서 반복하지 마라. 데이터가 얇아 할 말이 적으면 항목 수를 줄여라 — 날카로운 1~2개가 반복적인 3개보다 낫다.
- 톤: 친근하고 명료한 한국어. 과장·이모지 없음.
- 출력: 아래 스키마의 순수 JSON만. 마크다운·설명·코드펜스 없이.

출력 스키마(이 형태의 JSON 만 출력):
{
  "status": "ok",
  "insights": [ { "icon_hint": "trophy|clock|channel|funnel|chart", "headline": "string", "metric": "string", "action": "string" } ],
  "recommendations": [ { "pattern": "string", "rationale": "string" } ]
}
insights 는 최대 3개, recommendations 는 최대 3개. metric 에는 반드시 입력에 존재하는 실측 숫자만 넣는다.

예시(few-shot):
입력: {"totals":{"shares":120,"conversions":9,"conversion_rate":0.075},"dimensions":{"by_send_hour":[{"hour":19,"shares":30,"conversions":6,"conversion_rate":0.20},{"hour":13,"shares":40,"conversions":2,"conversion_rate":0.05}]},"data_sufficiency":{"drop_count":8,"level":"confident"}}
출력: {"status":"ok","insights":[{"icon_hint":"clock","headline":"저녁 7시 발송이 가장 잘 돼요","metric":"19시 전환율 20% vs 13시 5%","action":"다음 발송도 저녁 7~9시로 맞춰보세요"}],"recommendations":[{"pattern":"저녁 시간대 발송","rationale":"같은 콘텐츠도 전환율이 4배"}]}`;

type Insight = { icon_hint: string; headline: string; metric: string; action: string };
type Recommendation = { pattern: string; rationale: string };

// Sonnet 원문 → 안전 파싱. 실패하면 null(호출자가 fallback 처리).
function parseSonnet(text: string): { insights: Insight[]; recommendations: Recommendation[] } | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      insights?: unknown;
      recommendations?: unknown;
    };
    const insights: Insight[] = Array.isArray(parsed.insights)
      ? parsed.insights
          .map((x): Insight | null => {
            if (!x || typeof x !== "object") return null;
            const o = x as Record<string, unknown>;
            const headline = typeof o.headline === "string" ? o.headline.trim() : "";
            const metric = typeof o.metric === "string" ? o.metric.trim() : "";
            const action = typeof o.action === "string" ? o.action.trim() : "";
            if (!headline || !metric || !action) return null;
            const iconRaw = typeof o.icon_hint === "string" ? o.icon_hint.trim() : "";
            const icon_hint = ICON_HINTS.has(iconRaw) ? iconRaw : "chart";
            return { icon_hint, headline, metric, action };
          })
          .filter((x): x is Insight => x !== null)
          .slice(0, 3)
      : [];
    const recommendations: Recommendation[] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .map((x): Recommendation | null => {
            if (!x || typeof x !== "object") return null;
            const o = x as Record<string, unknown>;
            const pattern = typeof o.pattern === "string" ? o.pattern.trim() : "";
            const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";
            if (!pattern || !rationale) return null;
            return { pattern, rationale };
          })
          .filter((x): x is Recommendation => x !== null)
          .slice(0, 3)
      : [];
    if (insights.length === 0) return null; // 인사이트 0이면 사실상 실패 → fallback
    return { insights, recommendations };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  // 입력
  let period = "30d";
  try {
    const body = (await req.json()) as { period?: string };
    if (body?.period === "7d" || body?.period === "30d" || body?.period === "all") {
      period = body.period;
    }
  } catch {
    // body 없거나 깨져도 기본 '30d' 로 진행.
  }

  // 호출자 JWT → user 클라이언트. RPC 가 auth.uid()=호출자 로 실행되게 한다.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "로그인이 필요해요." }, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "세션이 만료됐어요." }, 401);
  }
  const uid = user.id;

  // 1) 캐시 조회 — (user_id, period) 6h 이내면 그대로 반환(RPC·Sonnet 미호출).
  try {
    const { data: cacheRow } = await admin
      .from("ai_feedback_cache")
      .select("payload, computed_at")
      .eq("user_id", uid)
      .eq("period", period)
      .maybeSingle();
    if (cacheRow?.payload && cacheRow.computed_at) {
      const age = Date.now() - new Date(cacheRow.computed_at as string).getTime();
      if (age >= 0 && age < CACHE_TTL_MS) {
        return jsonResponse({ ...(cacheRow.payload as object), cached: true });
      }
    }
  } catch {
    // 캐시 조회 실패는 치명 아님 — 그냥 생성 경로로 진행.
  }

  // 2) 성과 집계 RPC — 호출자 컨텍스트(auth.uid()=uid).
  const { data: metrics, error: rpcErr } = await userClient.rpc("get_creator_performance", {
    p_period: period,
  });
  if (rpcErr || !metrics) {
    return jsonResponse(
      { error: "METRICS_FAILED", message: "성과 데이터를 불러오지 못했어요.", detail: rpcErr?.message },
      502,
    );
  }
  const m = metrics as {
    data_sufficiency?: Record<string, unknown>;
  };
  // RPC 의 data_sufficiency 를 그대로 전달(activity_level·conversion_level 등 2축 포함).
  //   drop_count·level 만 안전 기본값 보강(데이터 게이트가 level 을 본다).
  const ds = (m.data_sufficiency ?? {}) as Record<string, unknown>;
  const sufficiency = {
    ...ds,
    drop_count: typeof ds.drop_count === "number" ? ds.drop_count : 0,
    level: typeof ds.level === "string" ? ds.level : "insufficient",
  };
  const nowIso = new Date().toISOString();

  // 3) 데이터 게이트 — insufficient(드롭<3) 면 Sonnet 미호출, 즉시 collecting 반환(비용 0). 캐시 안 함.
  if (sufficiency.level === "insufficient") {
    return jsonResponse({
      status: "collecting",
      data_sufficiency: sufficiency,
      insights: [],
      recommendations: [],
      message: "발송이 더 쌓이면 분석을 시작해요",
      generated_at: nowIso,
      model: MODEL,
      cached: false,
    });
  }

  // 4) Sonnet 호출 — system(가드+few-shot, 캐싱) + user(metrics JSON 문자열).
  let parsed: { insights: Insight[]; recommendations: Recommendation[] } | null = null;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(metrics) }],
    });
    const block = res.content[0];
    const text = block?.type === "text" ? block.text : "";
    parsed = parseSonnet(text);
  } catch {
    parsed = null;
  }

  // 5) 파싱/호출 실패 → 안전 fallback(빈 insights + parse_error). 200 으로 앱 안 깨지게. 캐시 안 함.
  if (!parsed) {
    return jsonResponse({
      status: "ok",
      data_sufficiency: sufficiency,
      insights: [],
      recommendations: [],
      parse_error: true,
      generated_at: nowIso,
      model: MODEL,
      cached: false,
    });
  }

  // 6) 성공 페이로드 — 고정 스키마. (cached 는 응답에만 붙이고 저장 payload 엔 미포함.)
  const payload = {
    status: "ok" as const,
    data_sufficiency: sufficiency,
    insights: parsed.insights,
    recommendations: parsed.recommendations,
    generated_at: nowIso,
    model: MODEL,
  };

  // 7) 캐시 upsert — service role(RLS 우회). user_id 는 호출자 uid 로 못박음.
  try {
    await admin
      .from("ai_feedback_cache")
      .upsert(
        { user_id: uid, period, payload, computed_at: nowIso },
        { onConflict: "user_id,period" },
      );
  } catch {
    // 캐시 쓰기 실패해도 결과는 반환(다음 호출 때 재생성).
  }

  return jsonResponse({ ...payload, cached: false });
});
