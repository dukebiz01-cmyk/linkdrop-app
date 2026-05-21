// generate-summary — 영상 메타 + 목적 → AI 요약 + 핵심포인트 5개 (Claude Haiku 4.5)
//
// POST { source_id, purpose, user_id, drop_id? }
// → { ai_summary, ai_key_points, cached, ai_generation_id }
//
// Step 6 명세 §3 기준. 실제 v3.0/v3.1 schema 따름 (A안):
//   - generation_type='summary' (기존 CHECK 값)
//   - 캐시 키 = (source_id, purpose) — response jsonb 에 purpose 를 넣어 구분
//   - drop_id 있으면 info_drops.ai_summary / ai_key_points UPDATE

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
const GENERATION_TYPE = "summary";

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

function costKrw(inTok: number, outTok: number): number {
  const usd = (inTok / 1_000_000) * 1 + (outTok / 1_000_000) * 5;
  return Math.round(usd * USD_TO_KRW * 100) / 100;
}

const SYSTEM_PROMPT = `너는 LinkDrop의 영상 요약 AI야.
영상 정보를 친구한테 카톡으로 보낼 만큼 간결하고 매력적으로 정리해.

규칙:
1. 한국어로 작성
2. 친근하고 자연스러운 톤
3. 어려운 단어 X (어르신도 이해 가능)
4. AI 추정임을 명시 (단정형 X)

목적별 강조:
- 정보: 핵심 내용 + 추천 이유
- 쿠폰: 매장 + 혜택 + 사용 조건
- 예약: 매장 + 가격대 + 시즌 추천
- 구매: 제품 + 특징 + 추천 사용자
- 상담: 분야 + 전문성 + 응답 시간

응답 형식 (JSON only, 코드블록·설명 없이 JSON 만):
{
  "ai_summary": "200-300자 요약 (한 문단)",
  "ai_key_points": ["핵심 1", "핵심 2", "핵심 3", "핵심 4", "핵심 5"]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { source_id?: string; purpose?: string; user_id?: string; drop_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!body.source_id || !body.purpose || !body.user_id) {
    return jsonResponse(
      { error: "MISSING_PARAMS", message: "source_id, purpose, user_id 가 필요해요." },
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

  // 2) 30일 캐시 조회 — 캐시 키 (source_id, purpose)
  const since = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
  const { data: cachedRow } = await supabase
    .from("ai_generations")
    .select("response")
    .eq("generation_type", GENERATION_TYPE)
    .eq("source_id", body.source_id)
    .eq("status", "success")
    .eq("response->>purpose", body.purpose)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedRow?.response) {
    const r = cachedRow.response as Record<string, unknown>;
    const { data: cacheGenId } = await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_source_id: body.source_id,
      p_drop_id: body.drop_id ?? null,
      p_model: MODEL,
      p_response: r,
      p_cost_krw: 0,
      p_status: "cache_hit",
    });
    if (body.drop_id) {
      await supabase
        .from("info_drops")
        .update({ ai_summary: r.ai_summary, ai_key_points: r.ai_key_points })
        .eq("id", body.drop_id);
    }
    return jsonResponse({
      ai_summary: r.ai_summary,
      ai_key_points: r.ai_key_points,
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
    `제목: ${source.title ?? "(없음)"}\n채널: ${source.author_name ?? "(없음)"}\n` +
    `설명: ${description}\n목적: ${body.purpose}`;

  // 4) Claude Haiku 호출
  let inTok = 0;
  let outTok = 0;
  let result: { ai_summary: string; ai_key_points: string[] };
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    inTok = res.usage.input_tokens;
    outTok = res.usage.output_tokens;
    const block = res.content[0];
    const text = block?.type === "text" ? block.text : "";
    result = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_source_id: body.source_id,
      p_drop_id: body.drop_id ?? null,
      p_model: MODEL,
      p_tokens_used: inTok + outTok,
      p_cost_krw: costKrw(inTok, outTok),
      p_status: "error",
      p_error_message: String((e as Error).message ?? e),
    });
    return jsonResponse(
      { error: "AI_FAILED", message: "AI 요약에 실패했어요. 잠시 후 다시 시도해 주세요." },
      502,
    );
  }

  // 5) drop_id 있으면 info_drops UPDATE
  if (body.drop_id) {
    await supabase
      .from("info_drops")
      .update({ ai_summary: result.ai_summary, ai_key_points: result.ai_key_points })
      .eq("id", body.drop_id);
  }

  // 6) record_ai_generation — response 에 purpose 포함(캐시 키)
  const { data: genId } = await supabase.rpc("record_ai_generation", {
    p_generation_type: GENERATION_TYPE,
    p_user_id: body.user_id,
    p_source_id: body.source_id,
    p_drop_id: body.drop_id ?? null,
    p_model: MODEL,
    p_prompt: userPrompt,
    p_response: { ...result, purpose: body.purpose },
    p_tokens_used: inTok + outTok,
    p_cost_krw: costKrw(inTok, outTok),
    p_status: "success",
  });

  return jsonResponse({
    ai_summary: result.ai_summary,
    ai_key_points: result.ai_key_points,
    cached: false,
    ai_generation_id: genId ?? null,
  });
});
