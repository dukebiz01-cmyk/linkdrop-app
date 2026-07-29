// catalog-gen — 상품 사진 1장 → Claude 비전 → 카탈로그 초안 JSON (UI-5-T5-E5i-1).
//   "준비 중"이던 AI 원페이지 카탈로그의 실엔진. 클라 소비는 E5i-2(후속) — 이 함수는 계약만 확정.
//
// POST { imageUrl(필수: 자사 product-images 공개 URL), productName?, mode? }
// → 200 { title, desc, features[], caution, ai_generation_id }
// → 4xx/5xx { error, message } (부분 JSON 반환 금지 — 파싱 1회 재시도 후 실패 = error)
//
// 기존 방식 승계(별도 발명 금지 — lingo-chat/index.ts·generate-promo-copy/index.ts 동형):
//   - 인증: verify_jwt 플랫폼 기본 ON + Authorization JWT → auth.getUser() 재확인
//     (lingo-chat :324-336 = generate-feedback 패턴).
//   - quota: check_ai_quota(service 클라이언트 + p_user_id) — promo-copy :127 동형.
//   - 기록: record_ai_generation(generation_type='share_message' 재사용 — DB CHECK 무접촉,
//     response.kind='catalog' 로 식별 — promo-copy 'promo' 관례 동형). best-effort.
//   - 모델: claude-sonnet-4-6(lingo-chat :61 동일 계열 통일) · 비용 USD→KRW 1400(:100-104 동형).
//   - 이미지: fetch→base64 비전 입력(promo-copy :158-182 동형) — 단 본 함수는 이미지가 "필수"이며
//     자사 스토리지 URL 화이트리스트(SSRF 방어)·5MB 상한을 추가(§4).
//   - CORS/OPTIONS·jsonResponse: 공통 골격 동일.
// DB 스키마 무접촉 · lingo-chat 무수정(READ 참고만) · 공유모듈 추출 없이 자립적(§0 관례).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.110.0";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_PUBLISHABLE_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6"; // lingo-chat 동일 계열 통일.
const MAX_TOKENS = 700; // §4 상한(1000 내) — 카탈로그 JSON 소요 대비 여유.
const USD_TO_KRW = 1400;
const GENERATION_TYPE = "share_message"; // DB CHECK 무접촉 — response.kind='catalog' 로 식별.
const PROMPT_VERSION = "catalog_v1";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // §4 — 페치 후 5MB 초과 = error.
const CALL_TIMEOUT_MS = 25_000; // §4 — 모델 호출 타임아웃.
// §1 SSRF 방어 — 자사 스토리지 공개 URL만(외부 URL 페치 금지). 경로 = product-images 공개 버킷 한정.
const ALLOWED_IMAGE_PREFIX = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/product-images/`;

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
// Sonnet 4.6 단가 input $3/1M · output $15/1M (lingo-chat :100-104 동형).
function costKrw(inTok: number, outTok: number): number {
  const usd = (inTok / 1_000_000) * 3 + (outTok / 1_000_000) * 15;
  return Math.round(usd * USD_TO_KRW * 100) / 100;
}

// ── §3 프롬프트 가드(명문) ─────────────────────────────────────────────
//   금칙 출처: FIX-51 명칭의 독립 목록은 repo 부재 — 실존 정본 2곳을 편입.
//   ① lingo-chat/persona.ts :97-98 (수익·금액 약속 / 효능·치료(건강·다이어트·질병) /
//      최상급·단정 과장(최고·1등·무조건) / 타 매장·서비스 비교 금지)
//   ② generate-promo-copy/index.ts :58-64·:78 (입력·사진에 없는 효능·원산지·인증·수상·품질·
//      후기 주장 금지 / "최고"·"100%"·"유일한" 과장 / 사진에 실제 보이는 것만).
const SYSTEM_PROMPT = `너는 소상공인 상품 카탈로그를 쓰는 카피라이터다. 상품 사진 1장을 보고 카탈로그 초안을 만든다.

[출력 — JSON만]
- 아래 스키마의 JSON "본문만" 출력한다. 백틱·코드펜스·서문·후기 어떤 것도 붙이지 않는다.
- {"title": string(20자 이내), "desc": string(80자 이내), "features": string[](정확히 3~4개, 각 30자 이내), "caution": string(60자 이내)}
- caution 은 보관·취급 안내 등 손님에게 도움이 되는 한 줄(사진·제공 정보로 알 수 있는 범위만).

[진실의 경계 — 절대 규칙]
- 숫자 창작 금지: 가격·중량·수량·원산지·날짜·당도 등 사진에서 확실히 읽히지 않는 수치는 절대 만들지 않는다. 사진 라벨에 명확히 인쇄된 경우에만 그대로 옮긴다.
- 효능·치료 표현 금지: "~에 좋다"·"치료"·"개선"·다이어트·질병 관련 단정 금지(식품표시광고법).
- 수익·금액 약속 금지. 최상급·단정 과장(최고·1등·무조건·100%·유일한) 금지. 타 매장·타 상품 비교 금지.
- 사진·제공 정보에 없는 효능·원산지·재배/제조 방식·인증·수상·품질 등급·후기·평점 주장 생성 금지. 사진에서 실제로 보이는 외형·색·구성·상태만 근거로 쓴다.
- 사진에 사람이 식별되면 인물 묘사는 일절 넣지 않는다(상품만 다룬다).

[톤]
- 60대 대표님의 상품을 손님에게 소개하는 따뜻하고 담백한 존댓말. 이모지·감탄 남발 금지. 짧고 정직하게.`;

type CatalogResult = { title: string; desc: string; features: string[]; caution: string };

// §2 — 응답 파싱·형식 검증(부분 JSON 반환 금지: 형식 미달 = throw → 재시도/최종 error).
function parseCatalog(text: string): CatalogResult {
  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 20) : "";
  const desc = typeof parsed.desc === "string" ? parsed.desc.trim().slice(0, 80) : "";
  const features = Array.isArray(parsed.features)
    ? parsed.features
        .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s: string) => s.trim().slice(0, 30))
        .slice(0, 4)
    : [];
  const caution = typeof parsed.caution === "string" ? parsed.caution.trim().slice(0, 60) : "";
  if (!title || !desc || features.length < 3 || !caution) throw new Error("SCHEMA_MISMATCH");
  return { title, desc, features, caution };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { imageUrl?: string; productName?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  // 1) 인증 — Authorization JWT → getUser 재확인(lingo-chat :324-336 동형).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "UNAUTHORIZED", message: "로그인이 필요해요." }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "UNAUTHORIZED", message: "로그인이 필요해요." }, 401);

  // 2) 입력 계약 — imageUrl 필수 + 자사 스토리지 화이트리스트(SSRF 방어 · 외부 URL 페치 금지).
  const rawImageUrl = (body.imageUrl ?? "").trim();
  if (!rawImageUrl) {
    return jsonResponse({ error: "MISSING_PARAMS", message: "imageUrl 이 필요해요." }, 400);
  }
  if (!rawImageUrl.startsWith(ALLOWED_IMAGE_PREFIX)) {
    return jsonResponse(
      { error: "INVALID_IMAGE_URL", message: "자사 상품 사진 URL만 쓸 수 있어요." },
      400,
    );
  }

  // 3) quota 게이트(promo-copy :127 동형 — uid 는 JWT 검증분).
  const { data: quota, error: quotaErr } = await admin.rpc("check_ai_quota", {
    p_user_id: user.id,
  });
  if (quotaErr) return jsonResponse({ error: "QUOTA_CHECK_FAILED", detail: quotaErr.message }, 500);
  if (!quota?.allowed) {
    return jsonResponse(
      { error: "QUOTA_EXCEEDED", quota, message: "오늘 AI 사용 한도를 다 썼어요." },
      429,
    );
  }

  // 4) 이미지 페치 → base64 비전 입력(promo-copy :158-182 동형 + §4: 필수·5MB 상한 — 실패 = error).
  let imageBlock: { type: "image"; source: { type: "base64"; media_type: string; data: string } };
  try {
    const imgRes = await fetch(rawImageUrl);
    if (!imgRes.ok) throw new Error(`IMAGE_FETCH_${imgRes.status}`);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "IMAGE_TOO_LARGE", message: "사진이 너무 커요(5MB 이하)." }, 413);
    }
    const ct = imgRes.headers.get("content-type") ?? "";
    const mediaType = ct.startsWith("image/") ? ct.split(";")[0].trim() : "image/jpeg";
    imageBlock = { type: "image", source: { type: "base64", media_type: mediaType, data: encodeBase64(bytes) } };
  } catch (e) {
    console.error("[catalog-gen] image fetch failed:", e);
    return jsonResponse({ error: "IMAGE_FETCH_FAILED", message: "사진을 불러오지 못했어요." }, 502);
  }

  // 5) 사용자 프롬프트 — 제공 사실만(§3: 없는 정보는 넣지 않는다). 요청당 1이미지(§4).
  const nameLine = (body.productName ?? "").trim()
    ? `상품명(업주 제공): ${(body.productName ?? "").trim()}\n`
    : "상품명: (미제공 — 사진만 근거로)\n";
  const userPrompt =
    nameLine +
    `위 사진 1장을 근거로 카탈로그 초안 JSON을 만들어줘. 스키마와 절대 규칙을 지켜.`;

  // 6) 모델 호출 — 타임아웃(§4) + 파싱 실패 1회 재시도(§2 — 재실패 = error, 부분 반환 금지).
  let result: CatalogResult | null = null;
  let inTok = 0;
  let outTok = 0;
  let lastErr = "";
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      const res = (await Promise.race([
        anthropic.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: [{ type: "text" as const, text: userPrompt }, imageBlock] },
          ],
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), CALL_TIMEOUT_MS)),
      ])) as Anthropic.Message;
      inTok += res.usage?.input_tokens ?? 0;
      outTok += res.usage?.output_tokens ?? 0;
      const block = res.content[0];
      const text = block?.type === "text" ? block.text : "";
      result = parseCatalog(text);
    } catch (e) {
      lastErr = String((e as Error).message ?? e);
      console.warn(`[catalog-gen] attempt ${attempt + 1} failed:`, lastErr);
    }
  }
  if (!result) {
    // 실패 기록(best-effort — promo-copy :218-226 동형).
    try {
      await admin.rpc("record_ai_generation", {
        p_generation_type: GENERATION_TYPE,
        p_user_id: user.id,
        p_model: MODEL,
        p_tokens_used: inTok + outTok,
        p_cost_krw: costKrw(inTok, outTok),
        p_status: "error",
        p_error_message: lastErr,
      });
    } catch {
      /* 기록 실패는 조용히 */
    }
    return jsonResponse(
      { error: "AI_FAILED", message: "카탈로그 생성에 실패했어요. 잠시 후 다시 시도해 주세요." },
      502,
    );
  }

  // 7) 성공 기록(best-effort) + 응답.
  let genId: string | null = null;
  try {
    const { data } = await admin.rpc("record_ai_generation", {
      p_generation_type: GENERATION_TYPE,
      p_user_id: user.id,
      p_model: MODEL,
      p_prompt: userPrompt,
      p_response: { kind: "catalog", prompt_version: PROMPT_VERSION, ...result },
      p_tokens_used: inTok + outTok,
      p_cost_krw: costKrw(inTok, outTok),
      p_status: "success",
    });
    genId = (data as string | null) ?? null;
  } catch {
    /* 기록 실패는 조용히 — 결과 반환은 계속 */
  }
  return jsonResponse({ ...result, ai_generation_id: genId });
});
