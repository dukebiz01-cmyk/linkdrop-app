// extract-bizdoc — 사업자등록증 이미지 → 적힌 정보만 추출 (Claude Haiku 4.5 Vision)
//
// POST { user_id, doc_path }
// → { b_nm, b_no, p_nm, start_dt, b_adr }
//
// detect-product/index.ts 골격 재사용. 단 이 함수는 "추출만" — 추론·생성·가격·평점 금지.
//   - doc_path = business-docs(비공개 버킷)의 {uid}/xxx.jpg
//   - 이미지는 비공개 버킷 download()로 bytes 확보 → base64 (getPublicUrl 금지)
//   - DB 쓰기 없음 (product_detections/offers INSERT 안 함). record_ai_generation 은 best-effort.

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

const MODEL = "claude-sonnet-4-6";
const USD_TO_KRW = 1400;
const BUCKET = "business-docs";
const GENERATION_TYPE = "bizdoc_ocr";

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
  const usd = (inTok / 1_000_000) * 3 + (outTok / 1_000_000) * 15;
  return Math.round(usd * USD_TO_KRW * 100) / 100;
}

// Uint8Array → base64 (대용량 이미지에서 call-stack 폭주 방지 위해 청크 처리)
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// 확장자 → media_type (Anthropic Vision 허용 타입). 미지정/기타는 jpeg 로.
function mediaTypeOf(path: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

const SYSTEM_PROMPT =
  "너는 한국 사업자등록증 이미지에서 적힌 정보만 정확히 추출하는 OCR이다. 추론·보정·생성 금지. 안 보이면 빈 문자열. 반드시 JSON만 출력(코드블록·설명 없이).";

const USER_TEXT =
  '다음 키로만 JSON 출력: b_nm(상호), b_no(사업자등록번호 숫자10자리만), p_nm(대표자명), start_dt(개업연월일 YYYYMMDD 8자리 숫자만), b_adr(사업장 주소). 값이 안 보이면 "".';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { user_id?: string; doc_path?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!body.user_id || !body.doc_path) {
    return jsonResponse(
      { error: "MISSING_PARAMS", message: "user_id, doc_path 가 필요해요." },
      400,
    );
  }

  // 0) 남의 폴더 접근 차단 — doc_path 첫 segment(폴더)가 user_id 와 일치해야 함.
  const firstSegment = body.doc_path.split("/")[0];
  if (firstSegment !== body.user_id) {
    return jsonResponse(
      { error: "FORBIDDEN", message: "본인 폴더의 파일만 분석할 수 있어요." },
      403,
    );
  }

  // 1) quota 게이트 (detect-product 와 동일; RPC 없으면 best-effort 통과)
  try {
    const { data: quota, error: quotaErr } = await supabase.rpc("check_ai_quota", {
      p_user_id: body.user_id,
    });
    if (!quotaErr && quota && quota.allowed === false) {
      return jsonResponse(
        {
          error: "QUOTA_EXCEEDED",
          quota,
          message: "오늘 AI 사용 한도를 다 썼어요. 내일 다시 시도하거나 Pro로 업그레이드해 주세요.",
        },
        429,
      );
    }
  } catch {
    // check_ai_quota 미존재/오류 → 게이트 생략(추출은 진행).
  }

  // 2) 비공개 버킷에서 이미지 bytes 로드 → base64 (공개 URL 사용 금지)
  let base64: string;
  const mediaType = mediaTypeOf(body.doc_path);
  try {
    const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(body.doc_path);
    if (dlErr || !file) {
      return jsonResponse(
        { error: "DOC_NOT_FOUND", message: "서류 이미지를 불러오지 못했어요." },
        404,
      );
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    base64 = bytesToBase64(buf);
  } catch (e) {
    return jsonResponse(
      { error: "DOC_LOAD_FAILED", message: "서류 이미지를 불러오지 못했어요.", detail: String((e as Error).message ?? e) },
      500,
    );
  }

  // 3) Claude Haiku Vision 호출 — 추출만.
  let result: {
    b_nm?: string;
    b_no?: string;
    p_nm?: string;
    start_dt?: string;
    b_adr?: string;
  };
  let inTok = 0;
  let outTok = 0;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: USER_TEXT },
          ],
        },
      ],
    });
    inTok = res.usage.input_tokens;
    outTok = res.usage.output_tokens;
    const block = res.content[0];
    const text = block?.type === "text" ? block.text : "";
    result = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    // 실패 기록(best-effort) 후 502.
    try {
      await supabase.rpc("record_ai_generation", {
        p_generation_type: GENERATION_TYPE,
        p_user_id: body.user_id,
        p_model: MODEL,
        p_tokens_used: inTok + outTok,
        p_cost_krw: costKrw(inTok, outTok),
        p_status: "error",
        p_error_message: String((e as Error).message ?? e),
      });
    } catch {
      // record_ai_generation 미존재/CHECK 위반 → 무시.
    }
    return jsonResponse(
      { error: "AI_FAILED", message: "서류 분석에 실패했어요. 사진이 선명한지 확인 후 다시 시도해 주세요." },
      502,
    );
  }

  // 4) 정규화 — b_no 숫자 10자리만, start_dt 숫자 8자리만. 나머지 trim.
  const digits = (v: unknown, len: number): string => {
    const d = String(v ?? "").replace(/[^0-9]/g, "");
    return d.length === len ? d : "";
  };
  const out = {
    b_nm: String(result.b_nm ?? "").trim(),
    b_no: digits(result.b_no, 10),
    p_nm: String(result.p_nm ?? "").trim(),
    start_dt: digits(result.start_dt, 8),
    b_adr: String(result.b_adr ?? "").trim(),
  };

  // 5) 성공 기록(best-effort) — DB 본 데이터 쓰기는 하지 않음.
  try {
    await supabase.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: body.user_id,
      p_model: MODEL,
      p_tokens_used: inTok + outTok,
      p_cost_krw: costKrw(inTok, outTok),
      p_status: "success",
    });
  } catch {
    // record_ai_generation 미존재/시그니처 불일치/CHECK 위반 → 무시(추출 결과엔 영향 0).
  }

  return jsonResponse(out);
});
