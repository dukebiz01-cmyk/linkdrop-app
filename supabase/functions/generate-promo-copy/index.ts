// generate-promo-copy — 업주 상품(이름·가격·메모) → AI 홍보 카피(헤드라인 + 셀링포인트) (Claude Haiku 4.5)
//
// POST { product_name, price_krw?, notes?, user_id, product_id? }
// → { headline, selling_points, cached, ai_generation_id }
//
// generate-summary 호출 골격 차용(invokeEdge·check_ai_quota·record_ai_generation·비용 KRW).
// DDL 0: ai_generations.generation_type CHECK 에 'promo' 가 없어 기존 'share_message' 재사용
//   (response.kind='promo' 로 구분). MVP 캐시 없음(구조 변경 회피).
//
// §0 가드(절대): 업주 1인칭 홍보 톤만. 입력(상품명·가격·메모)에 없는 효능·원산지·인증·품질·
//   수상 등 미검증 주장 생성 금지. 과장·허위·리뷰/뉴스/제3자 시점 금지. 이모지 금지.

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
// generation_type CHECK 기존 값 재사용(DDL 0). response.kind 로 promo 식별.
const GENERATION_TYPE = "share_message";
const PROMPT_VERSION = "promo_v1";

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

const SYSTEM_PROMPT = `너는 업주 본인 상품을 홍보하는 한국어 카피라이터야.
이 카피는 업주가 자기 상품을 손님에게 소개하는 "업주 1인칭 홍보물"이야.

핵심 원칙:
1. 너는 업주 본인. 1인칭 홍보 톤. ("제가 직접 만든", "저희 가게의" 처럼 업주가 소개하는 말투).
2. 절대 금지 — 입력(상품명·가격·메모)에 없는 사실을 지어내지 마.
   효능·효과, 원산지, 재배/제조 방식, 인증·수상, 품질 등급, 후기·평점 등 검증되지 않은 주장 생성 금지.
   메모에 적힌 사실만 근거로 써. 메모에 없으면 그 주장은 쓰지 마.
3. 과장·허위 금지 ("최고", "100%", "유일한" 등 입증 불가 표현 자제).
4. 독립 리뷰·뉴스·제3자 시점 사칭 절대 금지. 너는 파는 사람 본인이야.
5. 메모가 비어 있으면 = 상품명·카테고리 수준의 안전한 일반 홍보 카피만. (구체적 미검증 주장 없이.)
6. 어려운 단어 금지(어르신도 이해). 이모지 금지.

응답 형식 (JSON only, 코드블록·설명 없이 JSON 만):
{
  "headline": "1줄 헤드라인 (20자 내외)",
  "selling_points": ["셀링포인트 1", "셀링포인트 2", "셀링포인트 3"]
}
selling_points 는 3~5개. 각 항목은 짧게(한 줄).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: {
    product_name?: string;
    price_krw?: number | null;
    notes?: string;
    user_id?: string;
    product_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!body.product_name || !body.user_id) {
    return jsonResponse(
      { error: "MISSING_PARAMS", message: "product_name, user_id 가 필요해요." },
      400,
    );
  }

  // 1) quota 게이트 (generate-summary 와 동일 RPC)
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

  // 2) 사용자 프롬프트 — 상품명·가격·메모만. (없는 정보는 넣지 않는다.)
  const priceLine =
    typeof body.price_krw === "number" && body.price_krw > 0
      ? `가격: ${body.price_krw.toLocaleString("ko-KR")}원\n`
      : "";
  const notes = (body.notes ?? "").trim();
  const notesLine = notes ? `추가 정보(업주 제공 사실): ${notes}\n` : "추가 정보: (없음)\n";
  const userPrompt =
    `상품명: ${body.product_name}\n` +
    priceLine +
    notesLine +
    `위 정보만 근거로, 업주 1인칭 홍보 헤드라인 1줄과 셀링포인트 3~5개를 만들어줘. ` +
    `정보에 없는 주장은 절대 만들지 마.`;

  // 3) Claude Haiku 호출
  let inTok = 0;
  let outTok = 0;
  let result: { headline: string; selling_points: string[] };
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    inTok = res.usage.input_tokens;
    outTok = res.usage.output_tokens;
    const block = res.content[0];
    const text = block?.type === "text" ? block.text : "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const sellingPoints = Array.isArray(parsed.selling_points)
      ? parsed.selling_points
          .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s: string) => s.trim())
          .slice(0, 5)
      : [];
    if (!headline || sellingPoints.length === 0) throw new Error("EMPTY_RESULT");
    result = { headline, selling_points: sellingPoints };
  } catch (e) {
    await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_model: MODEL,
      p_tokens_used: inTok + outTok,
      p_cost_krw: costKrw(inTok, outTok),
      p_status: "error",
      p_error_message: String((e as Error).message ?? e),
    });
    return jsonResponse(
      { error: "AI_FAILED", message: "AI 카피 생성에 실패했어요. 직접 입력해 주세요." },
      502,
    );
  }

  // 4) record_ai_generation — response.kind='promo' 로 식별. source_id/drop_id 미연결(null).
  const { data: genId } = await supabase.rpc("record_ai_generation", {
    p_generation_type: GENERATION_TYPE,
    p_user_id: body.user_id,
    p_model: MODEL,
    p_prompt: userPrompt,
    p_response: {
      kind: "promo",
      prompt_version: PROMPT_VERSION,
      product_id: body.product_id ?? null,
      headline: result.headline,
      selling_points: result.selling_points,
    },
    p_tokens_used: inTok + outTok,
    p_cost_krw: costKrw(inTok, outTok),
    p_status: "success",
  });

  return jsonResponse({
    headline: result.headline,
    selling_points: result.selling_points,
    cached: false,
    ai_generation_id: genId ?? null,
  });
});
