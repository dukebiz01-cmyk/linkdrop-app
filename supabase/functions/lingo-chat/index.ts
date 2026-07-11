// lingo-chat — 링고 대화 엔진 v1 (T2). Claude Sonnet 4.6, SSE 스트리밍.
//
// POST { session_id?, message(≤2000자), context?, input_channel:'text' }
// → SSE: event meta {session_id, stage} → event delta {text}* → event done {message_id, tokens_used, cost_krw}
//   실패 시 event error {code, friendly}. quota 초과·검증 실패는 스트림 대신 JSON.
//
// T2.5 종료 액션 — POST { action:'close', session_id } (message 없이 허용, 단발 JSON 응답):
//   소유권 검증 → 세션 메시지(최대 40행) 로드 → 4행(2턴) 미만이면 추출 없이 closed →
//   추출(EXTRACT_SYSTEM_PROMPT, max_tokens 300, 비스트리밍) → 중복(포함관계) 제외 적재 →
//   유저당 20개 상한(오래된 것부터 삭제) → 세션 closed → {"closed":true,"facts_added":N}.
//   completions_count 무접촉(카드 완성과 별개). 추출 실패는 조용히 빈 배열(종료는 계속).
//
// 기존 방식 승계(T2 §2 지시, 실측 근거):
//   - verify_jwt: 기존 6함수와 동일 — 별도 config 없이 플랫폼 기본 ON 유지(끄지 않음).
//     함수 안에서는 generate-feedback 패턴으로 Authorization JWT → auth.getUser() 재확인.
//   - check_ai_quota: service 클라이언트 + p_user_id (generate-summary 패턴).
//   - record_ai_generation: generation_type CHECK 미확장(DDL 0)이라 generate-promo-copy 선례 승계 —
//     기존 값 'share_message' 재사용 + response.kind='lingo_chat' 로 식별. best-effort.
//   - CORS/OPTIONS·jsonResponse: 6함수 공통 골격 동일.
//   - USD→KRW 1400 환산: extract-bizdoc(Sonnet 단가 $3/$15) 승계.
//   - 프롬프트 캐싱: system cache_control ephemeral (generate-feedback 승계).
// DB 쓰기(lingo_sessions/messages/user_state)는 전부 service_role — RLS 가 클라이언트 쓰기를 막는 게 정상(T1).
// 기존 Edge 6함수·src/ 무접촉. 공유모듈 추출 없이 자립적(§0).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.110.0";
import { buildSystemPrompt, type LingoContext, type LingoStage } from "./persona.ts";
import { EXTRACT_SYSTEM_PROMPT } from "./extract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_PUBLISHABLE_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// service role — lingo_* 테이블 쓰기(RLS 우회) + quota/기록 RPC 전용. user_id 는 JWT uid 로 못박는다.
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const MAX_MESSAGE_CHARS = 2000;
const SURFACE = "studio";
const USD_TO_KRW = 1400;
// generation_type CHECK 기존 값 재사용(DDL 0, promo-copy 선례). response.kind 로 식별.
const GENERATION_TYPE = "share_message";

// T2.5 — 종료 추출 파라미터.
const EXTRACT_MAX_TOKENS = 300;
const MIN_MESSAGES_FOR_EXTRACT = 4; // 4행(2턴) 미만 = 추출 없이 종료(비용 절약).
const TRANSCRIPT_ROW_LIMIT = 40;
const TRANSCRIPT_CHARS_PER_ROW = 600; // 행당 상한 — 추출 입력 토큰 폭주 방지.
const FACTS_CAP = 20; // 유저당 총 상한 — 초과분은 가장 오래된 것부터 삭제.
const FACTS_MAX_PER_EXTRACT = 3;

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

// Sonnet 4.6 단가: input $3/1M, output $15/1M (extract-bizdoc 승계) → KRW 환산.
function costKrw(inTok: number, outTok: number): number {
  const usd = (inTok / 1_000_000) * 3 + (outTok / 1_000_000) * 15;
  return Math.round(usd * USD_TO_KRW * 100) / 100;
}

// SSE 프레임 인코딩 — event + data(JSON) 한 쌍.
const encoder = new TextEncoder();
function sseFrame(event: string, data: object): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

type RequestBody = {
  /** T2.5 — 'close' 면 대화 대신 종료 처리(message 불요). 미지정 = 대화. */
  action?: string;
  session_id?: string | null;
  message?: string;
  context?: LingoContext | null;
  input_channel?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ code: "method_not_allowed", friendly: "잘못된 요청이에요." }, 405);
  }

  // 0) 입력 파싱·검증
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ code: "invalid_json", friendly: "요청을 읽지 못했어요. 다시 시도해 주세요." }, 400);
  }
  // T2.5 — close 액션은 message 없이 허용(검증 스킵). 인증(1) 뒤 handleClose 로 분기.
  const isClose = body.action === "close";
  const message = (body.message ?? "").trim();
  if (!isClose) {
    if (!message) {
      return jsonResponse({ code: "empty_message", friendly: "하고 싶은 말을 입력해 주세요." }, 400);
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return jsonResponse(
        { code: "message_too_long", friendly: "메시지가 너무 길어요. 2000자 안으로 줄여 주세요." },
        400,
      );
    }
  }
  // v1 은 text 만 허용(voice 확장 자리 — 필드는 유지).
  const inputChannel = body.input_channel ?? "text";
  if (!isClose && inputChannel !== "text") {
    return jsonResponse(
      { code: "channel_not_supported", friendly: "지금은 글로만 대화할 수 있어요." },
      400,
    );
  }

  // 1) JWT → user_id (generate-feedback 패턴: Authorization 헤더로 user 클라이언트 생성 → getUser).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ code: "unauthorized", friendly: "로그인이 필요해요." }, 401);
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
    return jsonResponse({ code: "unauthorized", friendly: "세션이 만료됐어요. 다시 로그인해 주세요." }, 401);
  }
  const uid = user.id;

  // T2.5 — 종료 액션: 단발 JSON 처리 후 즉시 반환(스트림·대화 경로 미진입).
  if (isClose) {
    return await handleClose(uid, body.session_id ?? null);
  }

  // 2) quota 게이트 (check_ai_quota — generate-summary 와 동일 호출 방식).
  const { data: quota, error: quotaErr } = await admin.rpc("check_ai_quota", {
    p_user_id: uid,
  });
  if (quotaErr) {
    return jsonResponse({ code: "quota_check_failed", friendly: "잠시 후 다시 시도해 주세요." }, 500);
  }
  if (quota && quota.allowed === false) {
    // 스트림 대신 JSON (§2-2).
    return jsonResponse(
      { code: "quota", friendly: "오늘은 링고를 많이 썼어요. 내일 다시 도와드릴게요." },
      429,
    );
  }

  // 3) 세션 확보 — 없으면 INSERT(요약본 context), 있으면 소유권 검증.
  let sessionId: string;
  let sessionCreated = false;
  if (body.session_id) {
    const { data: sess } = await admin
      .from("lingo_sessions")
      .select("id, user_id")
      .eq("id", body.session_id)
      .maybeSingle();
    if (!sess) {
      return jsonResponse({ code: "session_not_found", friendly: "대화를 찾지 못했어요. 새로 시작해 주세요." }, 404);
    }
    if ((sess as { user_id: string }).user_id !== uid) {
      return jsonResponse({ code: "forbidden", friendly: "이 대화에 접근할 수 없어요." }, 403);
    }
    sessionId = (sess as { id: string }).id;
  } else {
    // context 요약본 — 원문 통짜 저장 금지(요약 참조만).
    const ctxSummary = {
      drop_id: body.context?.drop_id ?? null,
      video_summary: body.context?.video_summary?.slice(0, 200) ?? null,
      key_points_count: (body.context?.key_points ?? []).length,
      has_studio_state: !!body.context?.studio_state,
    };
    const { data: created, error: insErr } = await admin
      .from("lingo_sessions")
      .insert({
        user_id: uid,
        surface: SURFACE,
        context: ctxSummary,
        input_channel: inputChannel,
        status: "active",
      })
      .select("id")
      .single();
    if (insErr || !created) {
      return jsonResponse({ code: "session_create_failed", friendly: "대화를 시작하지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);
    }
    sessionId = (created as { id: string }).id;
    sessionCreated = true;
  }

  // 4) 상태 로드 — 없으면 stage='guide' UPSERT 생성.
  let stage: LingoStage = "guide";
  let sessionsCount = 0;
  let completionsCount = 0;
  {
    const { data: stateRow } = await admin
      .from("lingo_user_state")
      .select("stage, sessions_count, completions_count")
      .eq("user_id", uid)
      .eq("surface", SURFACE)
      .maybeSingle();
    if (stateRow) {
      const s = stateRow as { stage?: string; sessions_count?: number; completions_count?: number };
      if (s.stage === "guide" || s.stage === "assist" || s.stage === "standby") stage = s.stage;
      sessionsCount = s.sessions_count ?? 0;
      completionsCount = s.completions_count ?? 0;
    } else {
      await admin
        .from("lingo_user_state")
        .upsert(
          { user_id: uid, surface: SURFACE, stage: "guide", updated_at: new Date().toISOString() },
          { onConflict: "user_id,surface" },
        );
    }
  }

  // 5) 기억(최근 10건) + 대화 이력(해당 세션 최근 10턴 = 20행) 로드.
  const [{ data: factRows }, { data: historyRows }] = await Promise.all([
    admin
      .from("lingo_user_facts")
      .select("fact")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("lingo_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const facts = ((factRows as { fact: string }[] | null) ?? []).map((r) => r.fact);
  const history = (((historyRows as { role: string; content: string }[] | null) ?? []))
    .slice()
    .reverse() // 최신순 조회 → 시간순 정렬
    .map((r) => ({
      role: (r.role === "lingo" ? "assistant" : "user") as "assistant" | "user",
      content: r.content,
    }));

  // 6) 시스템프롬프트 조립 (persona.ts §3).
  const systemPrompt = buildSystemPrompt({ stage, facts, context: body.context });

  const messages = [...history, { role: "user" as const, content: message }];

  // 7~10) SSE 스트림 — meta → delta* → done / error. 예외를 밖으로 던지지 않는다(원칙 4·9).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sseFrame("meta", { session_id: sessionId, stage }));

      let fullText = "";
      let inTok = 0;
      let outTok = 0;
      try {
        // 7) Anthropic 스트리밍 — system 에 cache_control ephemeral (generate-feedback 방식 승계).
        const aiStream = await anthropic.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [
            { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
          ],
          messages,
          stream: true,
        });

        // 8) 중계 + 전문 버퍼링.
        for await (const event of aiStream) {
          if (event.type === "message_start") {
            inTok = event.message.usage.input_tokens ?? 0;
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(sseFrame("delta", { text: event.delta.text }));
          } else if (event.type === "message_delta") {
            outTok = event.usage.output_tokens ?? outTok;
          }
        }
        if (!fullText.trim()) throw new Error("EMPTY_RESULT");
      } catch (e) {
        console.error("[lingo-chat] anthropic stream failed:", e);
        // 10) 실패 — user 메시지는 기록하되 meta 에 상태 표시(lingo_messages.meta). best-effort.
        try {
          await admin.from("lingo_messages").insert({
            session_id: sessionId,
            role: "user",
            content: message,
            meta: { input_channel: inputChannel, ai_status: "error" },
          });
        } catch {
          // 기록 실패는 무시 — 에러 안내가 우선.
        }
        controller.enqueue(
          sseFrame("error", {
            code: "ai_failed",
            friendly: "죄송해요, 지금 링고가 잠깐 느려요. 조금 뒤에 다시 해볼게요.",
          }),
        );
        controller.close();
        return;
      }

      // 9) 완료 기록 — 전부 service_role. 실패해도 스트림은 완결(응답은 이미 전달됨).
      const cost = costKrw(inTok, outTok);
      const tokensUsed = inTok + outTok;
      const nowIso = new Date().toISOString();
      let messageId: string | null = null;
      try {
        // lingo_messages 2행 — user 먼저, lingo 응답에 tokens/cost.
        await admin.from("lingo_messages").insert({
          session_id: sessionId,
          role: "user",
          content: message,
          meta: { input_channel: inputChannel },
        });
        const { data: lingoRow } = await admin
          .from("lingo_messages")
          .insert({
            session_id: sessionId,
            role: "lingo",
            content: fullText,
            meta: { model: MODEL, stage },
            tokens_used: tokensUsed,
            cost_krw: cost,
          })
          .select("id")
          .single();
        messageId = (lingoRow as { id: string } | null)?.id ?? null;
      } catch (e) {
        console.error("[lingo-chat] message insert failed:", e);
      }

      // record_ai_generation — 통합 비용 추적(promo-copy 선례: 기존 type + response.kind). best-effort.
      try {
        await admin.rpc("record_ai_generation", {
          p_generation_type: GENERATION_TYPE,
          p_user_id: uid,
          p_model: MODEL,
          p_response: { kind: "lingo_chat", session_id: sessionId, message_id: messageId },
          p_tokens_used: tokensUsed,
          p_cost_krw: cost,
          p_status: "success",
        });
      } catch (e) {
        console.error("[lingo-chat] record_ai_generation failed:", e);
      }

      // lingo_user_state UPDATE — sessions_count 는 세션 신규 생성 시에만 +1. stage 는 유지.
      try {
        await admin.from("lingo_user_state").upsert(
          {
            user_id: uid,
            surface: SURFACE,
            stage,
            sessions_count: sessionsCount + (sessionCreated ? 1 : 0),
            completions_count: completionsCount,
            last_session_id: sessionId,
            last_seen_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "user_id,surface" },
        );
      } catch (e) {
        console.error("[lingo-chat] state upsert failed:", e);
      }

      controller.enqueue(
        sseFrame("done", { message_id: messageId, tokens_used: tokensUsed, cost_krw: cost }),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});

// ─────────────────────────────────────────────────────────────
// T2.5 — 세션 종료 + 장기기억 추출 (action:'close')
// ─────────────────────────────────────────────────────────────

async function handleClose(uid: string, sessionIdInput: string | null): Promise<Response> {
  if (!sessionIdInput) {
    return jsonResponse({ code: "session_required", friendly: "종료할 대화가 없어요." }, 400);
  }

  // 소유권 검증 — 본인 세션만(아니면 403).
  const { data: sess } = await admin
    .from("lingo_sessions")
    .select("id, user_id, status")
    .eq("id", sessionIdInput)
    .maybeSingle();
  if (!sess) {
    return jsonResponse({ code: "session_not_found", friendly: "대화를 찾지 못했어요." }, 404);
  }
  const s = sess as { id: string; user_id: string; status: string };
  if (s.user_id !== uid) {
    return jsonResponse({ code: "forbidden", friendly: "이 대화에 접근할 수 없어요." }, 403);
  }
  // 이미 닫힌 세션 — 재추출 없이 멱등 응답(이중 비용 방지).
  if (s.status === "closed") {
    return jsonResponse({ closed: true, facts_added: 0 });
  }
  const sessionId = s.id;

  // 세션 메시지 전체 로드(시간순, 최대 40행).
  const { data: msgRows } = await admin
    .from("lingo_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(TRANSCRIPT_ROW_LIMIT);
  const rows = (msgRows as { role: string; content: string }[] | null) ?? [];

  // 4행(2턴) 미만 = 추출 없이 종료(비용 절약).
  let factsAdded = 0;
  if (rows.length >= MIN_MESSAGES_FOR_EXTRACT) {
    // quota 초과·확인 실패 시 추출만 스킵하고 종료는 진행 — 종료가 quota 에 막히면
    // 세션이 영영 안 닫힌다(추출은 부가 기능, close 가 본질).
    const { data: quota, error: quotaErr } = await admin.rpc("check_ai_quota", {
      p_user_id: uid,
    });
    if (!quotaErr && (quota as { allowed?: boolean } | null)?.allowed !== false) {
      factsAdded = await extractAndStoreFacts(uid, sessionId, rows);
    }
  }

  // 세션 close — completions_count(lingo_user_state)는 무접촉(카드 완성과 별개).
  const { error: closeErr } = await admin
    .from("lingo_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (closeErr) {
    console.error("[lingo-chat] session close failed:", closeErr);
    return jsonResponse(
      { code: "close_failed", friendly: "대화를 정리하지 못했어요. 잠시 후 다시 시도해 주세요." },
      500,
    );
  }

  return jsonResponse({ closed: true, facts_added: factsAdded });
}

// 추출 → 검증 → 중복 제외 → 상한 유지 → INSERT. 어떤 실패도 밖으로 던지지 않는다(0 반환).
async function extractAndStoreFacts(
  uid: string,
  sessionId: string,
  rows: { role: string; content: string }[],
): Promise<number> {
  // 대화 원문 조립 — 행당 상한으로 입력 토큰 bound(메시지 자체는 ≤2000자라 40행 최대 방어).
  const transcript = rows
    .map(
      (r) =>
        `${r.role === "lingo" ? "링고" : "사용자"}: ${r.content.slice(0, TRANSCRIPT_CHARS_PER_ROW)}`,
    )
    .join("\n");

  // 추출 호출 — 단발(비스트리밍). 파싱은 기존 JSON.parse(replace) 방식 승계(extract-bizdoc 등).
  //   실패는 조용히 빈 배열(예외 금지) — 종료 처리는 계속돼야 한다.
  let rawFacts: { kind?: unknown; text?: unknown }[] = [];
  let inTok = 0;
  let outTok = 0;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: EXTRACT_MAX_TOKENS,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    });
    inTok = res.usage.input_tokens ?? 0;
    outTok = res.usage.output_tokens ?? 0;
    const block = res.content[0];
    const text = block?.type === "text" ? block.text : "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (Array.isArray(parsed?.facts)) rawFacts = parsed.facts;
  } catch (e) {
    console.error("[lingo-chat] fact extract failed:", e);
    rawFacts = [];
  }

  // 추출 비용 기록 — 호출이 실제 발생했을 때만. record_ai_generation 기존 방식(best-effort).
  if (inTok > 0 || outTok > 0) {
    try {
      await admin.rpc("record_ai_generation", {
        p_generation_type: GENERATION_TYPE,
        p_user_id: uid,
        p_model: MODEL,
        p_response: { kind: "lingo_fact_extract", session_id: sessionId },
        p_tokens_used: inTok + outTok,
        p_cost_krw: costKrw(inTok, outTok),
        p_status: "success",
      });
    } catch (e) {
      console.error("[lingo-chat] record_ai_generation(extract) failed:", e);
    }
  }

  // 검증 — kind 2종·비어있지 않은 text 만, 최대 3개.
  const candidates = rawFacts
    .filter(
      (f) =>
        (f?.kind === "fact" || f?.kind === "preference") &&
        typeof f?.text === "string" &&
        (f.text as string).trim().length > 0,
    )
    .map((f) => ({ kind: f.kind as "fact" | "preference", text: (f.text as string).trim() }))
    .slice(0, FACTS_MAX_PER_EXTRACT);
  if (candidates.length === 0) return 0;

  // 기존 facts 로드(오래된 순) — 중복 차단 + 상한 삭제 재료 겸용.
  const { data: existRows } = await admin
    .from("lingo_user_facts")
    .select("id, fact")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  const existing = (existRows as { id: string; fact: string }[] | null) ?? [];

  // 동일/유사(단순 포함관계) 중복 INSERT 금지 — 같은 배치 내부끼리도 동일 규칙.
  const contains = (a: string, b: string) => a.includes(b) || b.includes(a);
  const accepted: string[] = [];
  const toInsert = candidates.filter((c) => {
    if (existing.some((e) => contains(e.fact, c.text))) return false;
    if (accepted.some((t) => contains(t, c.text))) return false;
    accepted.push(c.text);
    return true;
  });
  if (toInsert.length === 0) return 0;

  // 유저당 총 20개 상한 — 초과분은 가장 오래된 것부터 삭제 후 INSERT.
  const overflow = existing.length + toInsert.length - FACTS_CAP;
  if (overflow > 0) {
    const removeIds = existing.slice(0, overflow).map((e) => e.id);
    try {
      await admin.from("lingo_user_facts").delete().in("id", removeIds);
    } catch (e) {
      console.error("[lingo-chat] facts cap delete failed:", e);
    }
  }

  const { error: insErr } = await admin.from("lingo_user_facts").insert(
    toInsert.map((c) => ({
      user_id: uid,
      fact: c.text,
      kind: c.kind,
      source_session_id: sessionId,
    })),
  );
  if (insErr) {
    console.error("[lingo-chat] facts insert failed:", insErr);
    return 0;
  }
  return toInsert.length;
}
