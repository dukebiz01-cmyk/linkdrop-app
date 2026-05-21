// suggest-purpose — 영상 메타 → 5목적 추천 (Claude Haiku 4.5)
//
// POST { source_id, user_id } → { purpose, confidence, reasoning, alternatives,
//                                 cached, ai_generation_id }
//
// Step 6 명세 §2 기준. 명세의 RPC 시그니처가 아니라 실제 v3.1 record_ai_generation /
// check_ai_quota 시그니처를 따른다 (A안):
//   - generation_type='intent_suggestion' (명세의 'purpose_suggestion' → 기존 enum 매핑)
//   - cost 는 cost_krw (USD→KRW 환산은 이 함수 내부)
//   - record_ai_generation 은 p_tokens_used 단일 (input+output 합)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const MODEL = "claude-haiku-4-5-20251001";
const USD_TO_KRW = 1400;
const CACHE_TTL_DAYS = 30;
// 명세 §2 의 'purpose_suggestion' 은 v3.0 generation_type CHECK 의 기존 값으로 매핑.
const GENERATION_TYPE = "intent_suggestion";

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

// Claude Haiku 4.5: input $1/1M, output $5/1M. → KRW 환산.
function costKrw(inTok: number, outTok: number): number {
  const usd = (inTok / 1_000_000) * 1 + (outTok / 1_000_000) * 5;
  return Math.round(usd * USD_TO_KRW * 100) / 100;
}

const SYSTEM_PROMPT = `너는 LinkDrop의 영상 분류 AI야.
영상 제목과 채널명을 보고 5가지 목적 중 하나를 추천해.

5가지 목적:
- 정보: 영상 내용 요약, 정보 공유 (예: 카페 소개, 여행 후기)
- 쿠폰: 매장 혜택, 할인 (예: 음식점 쿠폰, 신메뉴 출시)
- 예약: 예약 가능한 매장 (예: 캠핑장, 펜션, 미용실)
- 구매: 영상 속 상품 구매 (예: 캠핑 용품, 화장품, 책)
- 상담: 상담/문의 (예: 부동산, 법률, 의료)

응답 형식 (JSON only, 코드블록·설명 없이 JSON 만):
{
  "purpose": "정보|쿠폰|예약|구매|상담",
  "confidence": "high|medium|low",
  "reasoning": "한 줄 이유 (한국어)",
  "alternatives": [{"purpose": "...", "confidence": "high|medium|low"}]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { source_id?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!body.source_id || !body.user_id) {
    return jsonResponse(
      { error: "MISSING_PARAMS", message: "source_id, user_id 가 필요해요." },
      400,
    );
  }

  // 1) quota 게이트
  const { data: quota, error: quotaErr } = await supabase.rpc("check_ai_quota", {
    p_user_id: body.user_id,
  });
  if (quotaErr) {
    return jsonResponse({ error: "QUOTA_CHECK_FAILED", detail: quotaErr.message }, 500);
  }
  if (!quota?.allowed) {
    return jsonResponse(
      {
        error: "QUOTA_EXCEEDED",
        quota,
        message: "오늘 AI 사용 한도를 다 썼어요. 내일 다시 시도하거나 Pro로 업그레이드해 주세요.",
      },
      429,
    );
  }

  // 2) 30일 캐시 조회 (캐시 hit 은 quota 안 깎음)
  const since = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
  const { data: cachedRow } = await supabase
    .from("ai_generations")
    .select("response")
    .eq("generation_type", GENERATION_TYPE)
    .eq("source_id", body.source_id)
    .eq("status", "success")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedRow?.response) {
    const { data: cacheGenId } = await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_source_id: body.source_id,
      p_model: MODEL,
      p_response: cachedRow.response,
      p_cost_krw: 0,
      p_status: "cache_hit",
    });
    return jsonResponse({
      ...(cachedRow.response as Record<string, unknown>),
      cached: true,
      ai_generation_id: cacheGenId ?? null,
    });
  }

  // 3) content_sources 조회
  const { data: source, error: srcErr } = await supabase
    .from("content_sources")
    .select("title, author_name, raw_meta")
    .eq("id", body.source_id)
    .maybeSingle();
  if (srcErr || !source) {
    return jsonResponse(
      { error: "SOURCE_NOT_FOUND", message: "영상 정보를 찾을 수 없어요." },
      404,
    );
  }

  const description =
    ((source.raw_meta as Record<string, unknown> | null)?.["description"] as string) ?? "";
  const userPrompt =
    `제목: ${source.title ?? "(없음)"}\n채널: ${source.author_name ?? "(없음)"}\n설명: ${description}`;

  // 4) Claude Haiku 호출
  let inTok = 0;
  let outTok = 0;
  let result: {
    purpose: string;
    confidence: string;
    reasoning: string;
    alternatives: unknown[];
  };
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    inTok = res.usage.input_tokens;
    outTok = res.usage.output_tokens;
    const block = res.content[0];
    const text = block?.type === "text" ? block.text : "";
    result = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    // 실패 — status='error' 기록 (record_ai_generation 은 success 일 때만 quota +1 → 안전)
    await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_source_id: body.source_id,
      p_model: MODEL,
      p_tokens_used: inTok + outTok,
      p_cost_krw: costKrw(inTok, outTok),
      p_status: "error",
      p_error_message: String((e as Error).message ?? e),
    });
    return jsonResponse(
      { error: "AI_FAILED", message: "AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요." },
      502,
    );
  }

  // 5) record_ai_generation — status='success' → ai_usage_quotas +1
  const { data: genId } = await supabase.rpc("record_ai_generation", {
    p_generation_type: GENERATION_TYPE,
    p_user_id: body.user_id,
    p_source_id: body.source_id,
    p_model: MODEL,
    p_prompt: userPrompt,
    p_response: result,
    p_tokens_used: inTok + outTok,
    p_cost_krw: costKrw(inTok, outTok),
    p_status: "success",
  });

  return jsonResponse({ ...result, cached: false, ai_generation_id: genId ?? null });
});
