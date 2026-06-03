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

// v2 — 손님(수신자) 관점 + 영상·매장·시기 맥락 반영. 옛 v1 캐시는
//      PROMPT_VERSION 매치 미스로 자연 만료(30 일). backfill 별도.
const PROMPT_VERSION = "v2";

const SYSTEM_PROMPT = `너는 LinkDrop의 영상 요약 AI야.
이 요약은 카카오톡으로 링크를 받은 손님(수신자)이 읽어.
보내는 사람이 아니라 "받는 손님" 입장에서, "이게 나한테 어떤 가치가 있나"를 중심으로 정리해.

핵심 원칙:
1. 손님(받는 사람)이 주어. "당신이 받는/가는/알게 되는" 느낌. "손님 모으기", "혜택 제공" 같은 업주·판매자 표현 절대 금지.
2. 영상·매장의 맥락을 반영: 시기(계절·시간대), 장소(지역), 대상(가족·1인·연인·친구)을 정보에서 추정해 톤에 자연스럽게 녹여. 받는 시점에 맞는 권유 (예: 여름 캠핑 영상이면 "이 더위에 가기 좋아요").
3. 친구가 친구에게 추천하는 말투. 친근하고 자연스럽게.
4. 어려운 단어 금지 (어르신도 이해).
5. AI 추정임을 드러내 (단정형 금지, "~인 것 같아요" 톤).

목적별 강조 (모두 손님 시점):
- 정보: 이 영상에서 손님이 알게 될 핵심 + 따라 하기 좋은 팁
- 쿠폰: 받을 수 있는 혜택 + 받아두면 좋은 이유 + 사용 조건
- 예약: 예약할 때 고려할 점 + 시기·인원·분위기 추천 포인트
- 구매: 살 때 도움 될 비교 포인트 + 어떤 사람에게 맞나
- 상담: 어떤 고민이 있을 때 문의하면 좋은가 + 무엇을 기대할 수 있나

응답 형식 (JSON only, 코드블록·설명 없이 JSON 만):
{
  "ai_summary": "200-300자 요약 (한 문단)",
  "ai_key_points": ["핵심 1", "핵심 2", "핵심 3", "핵심 4", "핵심 5"]
}`;

const KO_MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
function currentSeasonKo(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return "봄";
  if (m >= 6 && m <= 8) return "여름";
  if (m >= 9 && m <= 11) return "가을";
  return "겨울";
}

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

  // 2) 30일 캐시 조회 — 캐시 키 (source_id, purpose, prompt_version)
  //    v7.2: prompt_version 매치 추가 → 옛 v1 캐시는 자연 만료, 신 v2 만 hit.
  const since = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
  const { data: cachedRow } = await supabase
    .from("ai_generations")
    .select("response")
    .eq("generation_type", GENERATION_TYPE)
    .eq("source_id", body.source_id)
    .eq("status", "success")
    .eq("response->>purpose", body.purpose)
    .eq("response->>prompt_version", PROMPT_VERSION)
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

  // v7.2 — drop_id 있으면 매장 맥락(display_name/partner_kind/address) 추가.
  // 위저드 미리보기 등 drop_id 없는 호출은 시기만 추가. 매장 정보 없어도 안전.
  let storeLine = "";
  if (body.drop_id) {
    const { data: dropRow } = await supabase
      .from("info_drops")
      .select("partner_id")
      .eq("id", body.drop_id)
      .maybeSingle();
    const partnerId = (dropRow as { partner_id?: string | null } | null)?.partner_id;
    if (partnerId) {
      const { data: partnerRow } = await supabase
        .from("partners")
        .select("display_name, partner_kind, address")
        .eq("id", partnerId)
        .maybeSingle();
      if (partnerRow) {
        const p = partnerRow as { display_name?: string; partner_kind?: string; address?: string };
        const parts = [p.display_name, p.partner_kind, p.address].filter((s) => s && String(s).trim());
        if (parts.length > 0) storeLine = `매장: ${parts.join(" · ")}\n`;
      }
    }
  }

  const now = new Date();
  const timeLine = `현재 시점: ${now.getFullYear()}년 ${KO_MONTHS[now.getMonth()]} (${currentSeasonKo()})\n`;

  const userPrompt =
    `제목: ${source.title ?? "(없음)"}\n채널: ${source.author_name ?? "(없음)"}\n` +
    `설명: ${description}\n` +
    storeLine +
    timeLine +
    `목적: ${body.purpose}`;

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

  // 6) record_ai_generation — response 에 purpose + prompt_version (캐시 키)
  const { data: genId } = await supabase.rpc("record_ai_generation", {
    p_generation_type: GENERATION_TYPE,
    p_user_id: body.user_id,
    p_source_id: body.source_id,
    p_drop_id: body.drop_id ?? null,
    p_model: MODEL,
    p_prompt: userPrompt,
    p_response: { ...result, purpose: body.purpose, prompt_version: PROMPT_VERSION },
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
