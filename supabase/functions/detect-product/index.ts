// detect-product — 구매 목적 영상 → 상품 탐지 + 가격 후보 (Claude Haiku 4.5)
//
// POST { source_id, drop_id, user_id }
// → { detection_id, product, offers, cached, ai_generation_id }
//
// Step 6 명세 §4 기준. 실제 v3.0/v3.1 schema 따름 (A안):
//   - generation_type='product_detection' (기존 CHECK 값)
//   - product_detections.confidence CHECK = 한국어('높음'/'보통'/'확인 필요') → Claude high/medium/low 매핑
//   - product_offers.seller_country CHECK = '국내'/'해외' → Claude korea/overseas 매핑
//   - product_detections.ai_generation_id FK 연결 (v3.3)
// 캐시 hit 이어도 product_detections/offers 는 이 drop_id 에 INSERT — 캐시는 AI 비용만 절약.

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
const GENERATION_TYPE = "product_detection";

const CONFIDENCE_MAP: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "확인 필요",
};
const COUNTRY_MAP: Record<string, string> = { korea: "국내", overseas: "해외" };

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

const SYSTEM_PROMPT = `너는 LinkDrop의 상품 탐지 AI야.
영상에서 소개된 상품을 식별하고 가격 후보를 추정해.

규칙:
1. 영상 제목/설명에서 명확히 식별 가능한 상품만 (추측 X)
2. 신뢰도 보수적 (확실치 않으면 low)
3. 가격은 시장 평균 추정 (실시간 X)
4. 한국 시장 우선

응답 형식 (JSON only, 코드블록·설명 없이 JSON 만):
{
  "product": {
    "name": "상품명 (한국어)",
    "brand": "브랜드명 또는 null",
    "category": "카테고리",
    "confidence": "high|medium|low"
  },
  "offers": [
    {
      "seller": "네이버쇼핑",
      "region": "korea|overseas",
      "price_estimate": 89000,
      "currency": "KRW",
      "shipping_info": "배송비 무료",
      "url": null
    }
  ]
}

국내 셀러 3-4개(네이버쇼핑, 쿠팡, 스마트스토어, G마켓) + 해외 1-2개(Amazon, AliExpress).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { source_id?: string; drop_id?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!body.source_id || !body.drop_id || !body.user_id) {
    return jsonResponse(
      { error: "MISSING_PARAMS", message: "source_id, drop_id, user_id 가 필요해요." },
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

  // 2) 30일 캐시 조회 — 캐시 키 (source_id)
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

  let result: {
    product: { name: string; brand: string | null; category: string; confidence: string };
    offers: Array<{
      seller: string;
      region: string;
      price_estimate: number;
      currency: string;
      shipping_info: string;
      url: string | null;
    }>;
  };
  let isCached = false;
  let inTok = 0;
  let outTok = 0;

  if (cachedRow?.response) {
    // 캐시 hit — AI 호출 생략, 결과 재사용. product_detections 는 이 drop 에 새로 INSERT.
    result = cachedRow.response as typeof result;
    isCached = true;
  } else {
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
    try {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
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
        p_drop_id: body.drop_id,
        p_model: MODEL,
        p_tokens_used: inTok + outTok,
        p_cost_krw: costKrw(inTok, outTok),
        p_status: "error",
        p_error_message: String((e as Error).message ?? e),
      });
      return jsonResponse(
        { error: "AI_FAILED", message: "상품 분석에 실패했어요. 잠시 후 다시 시도해 주세요." },
        502,
      );
    }
  }

  // 4-b) 상품 미식별 방어 — Claude 가 product 를 못 채우면(상품 없는 영상) 우아하게 반환.
  if (!result?.product?.name) {
    const { data: noGenId } = await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_source_id: body.source_id,
      p_drop_id: body.drop_id,
      p_model: MODEL,
      p_response: result ?? {},
      p_tokens_used: isCached ? null : inTok + outTok,
      p_cost_krw: isCached ? 0 : costKrw(inTok, outTok),
      p_status: isCached ? "cache_hit" : "success",
    });
    return jsonResponse(
      {
        error: "NO_PRODUCT_FOUND",
        message: "이 영상에서 살 수 있는 상품을 찾지 못했어요.",
        ai_generation_id: noGenId ?? null,
      },
      200,
    );
  }
  result.offers = Array.isArray(result.offers) ? result.offers : [];

  // 5) record_ai_generation — ai_generation_id 확보 (product_detections FK 연결용)
  const { data: genId } = await supabase.rpc("record_ai_generation", {
    p_generation_type: GENERATION_TYPE,
    p_user_id: body.user_id,
    p_source_id: body.source_id,
    p_drop_id: body.drop_id,
    p_model: MODEL,
    p_response: result,
    p_tokens_used: isCached ? null : inTok + outTok,
    p_cost_krw: isCached ? 0 : costKrw(inTok, outTok),
    p_status: isCached ? "cache_hit" : "success",
  });

  // 6) product_detections INSERT — confidence 한국어 매핑
  const { data: detection, error: detErr } = await supabase
    .from("product_detections")
    .insert({
      drop_id: body.drop_id,
      product_name_guess: result.product.name,
      brand_guess: result.product.brand,
      category: result.product.category,
      confidence: CONFIDENCE_MAP[result.product.confidence] ?? "확인 필요",
      ai_generation_id: genId ?? null,
    })
    .select("id")
    .single();

  if (detErr || !detection) {
    return jsonResponse(
      { error: "DB_ERROR", message: detErr?.message ?? "상품 저장에 실패했어요." },
      500,
    );
  }

  // 7) product_offers INSERT — seller_country 한국어 매핑
  const offerRows = result.offers.map((o) => ({
    detection_id: detection.id,
    seller_name: o.seller,
    seller_country: COUNTRY_MAP[o.region] ?? "국내",
    platform: o.seller,
    product_url: o.url,
    price: o.price_estimate,
    currency: o.currency ?? "KRW",
  }));
  if (offerRows.length > 0) {
    await supabase.from("product_offers").insert(offerRows);
  }

  return jsonResponse({
    detection_id: detection.id,
    product: result.product,
    offers: result.offers,
    cached: isCached,
    ai_generation_id: genId ?? null,
  });
});
