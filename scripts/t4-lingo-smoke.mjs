// T4 — lingo-chat Edge Function 스모크 테스트 (READ + Edge 호출만, 배포/git 무관).
//
// 기본 모드: 단일 메시지 발사 → SSE 파싱 → lingo_sessions/messages RLS 조회 검증.
// 다중 모드(T4-2): `bun run scripts/t4-lingo-smoke.mjs multi`
//   — 서툰 입력 3개를 각각 "새 세션"(session_id 없이)으로 순차 발사, 답변 전문·비용만 출력(판정 없음).
// 종료 모드(T2.5 실측): `bun run scripts/t4-lingo-smoke.mjs close`
//   — 새 세션으로 2턴(사실+선호) 발사 → {action:'close', session_id} 호출(장기기억 추출)
//   → 유저 클라이언트로 lingo_user_facts 최근 5행(kind, text, created_at) RLS 조회 출력.
//
// 1) .env.local 에서 URL/publishable key 로드(BOM 제거 — create-review-accounts.ts 패턴).
// 2) 테스트 계정 password 로그인 → access_token (토큰·키·비번 stdout 출력 금지).
//    dukebiz01 우선 시도 → 실패 시 검수 계정(test01@drop.how) 폴백.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(repoRoot, ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local not found");
  process.exit(2);
}
const envText = readFileSync(envPath, "utf8").replace(/^﻿/, "");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const publishable = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishable) {
  console.error("Missing SUPABASE_URL / PUBLISHABLE_KEY in .env.local");
  process.exit(2);
}

// 후보 계정 — dukebiz01 우선, 검수 계정 폴백(create-review-accounts.ts 스펙).
const CANDIDATES = [
  { label: "dukebiz01", email: "dukebiz01@gmail.com", password: "dukebiz08" },
  { label: "review test01", email: "test01@drop.how", password: "linkdrop01!" },
];

const client = createClient(url, publishable, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let session = null;
let usedLabel = null;
for (const acc of CANDIDATES) {
  const { data, error } = await client.auth.signInWithPassword({
    email: acc.email,
    password: acc.password,
  });
  if (!error && data.session) {
    session = data.session;
    usedLabel = acc.label;
    console.log(`[login] ${acc.label}: password 로그인 OK`);
    break;
  }
  console.log(`[login] ${acc.label}: password 로그인 불가 (${error?.message ?? "no session"})`);
}
if (!session) {
  console.error("[abort] password 로그인 가능한 테스트 계정이 없음 — 중단");
  process.exit(1);
}
const token = session.access_token; // 출력 금지

// ── lingo-chat 1회 호출 (sessionId 미전송 = 새 세션 / context 전송 = T-A 액션 모드) → SSE 파싱 ──
async function runChat(message, sessionId = null, context = null) {
  const res = await fetch(`${url}/functions/v1/lingo-chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishable,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      input_channel: "text",
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(context ? { context } : {}),
    }),
  });

  const result = {
    status: res.status,
    stage: null,
    sessionId: null, // meta 프레임의 session_id — close 모드가 같은 세션 이어가기에 사용.
    answer: "",
    actions: null, // T-A — event: actions 의 data 원문({actions, steps}).
    done: null,
    error: null,
    nonSse: null,
  };
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream")) {
    result.nonSse = (await res.text()).slice(0, 500);
    return result;
  }

  const decoder = new TextDecoder();
  let buf = "";
  const handleFrame = (frame) => {
    const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
    if (!eventLine || !dataLine) return;
    const event = eventLine.slice(7).trim();
    let data;
    try {
      data = JSON.parse(dataLine.slice(6));
    } catch {
      return;
    }
    if (event === "meta") {
      result.stage = data.stage;
      result.sessionId = data.session_id ?? null;
    }
    else if (event === "delta") result.answer += data.text ?? "";
    else if (event === "actions") result.actions = data;
    else if (event === "done") result.done = data;
    else if (event === "error") result.error = data;
  };

  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      handleFrame(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
    }
  }
  if (buf.trim()) handleFrame(buf);
  return result;
}

function printResult(r) {
  console.log(`[http] status=${r.status} stage=${r.stage ?? "-"}`);
  if (r.nonSse) console.log("[non-sse body]", r.nonSse);
  console.log("[answer 전문]");
  console.log(r.answer || "(빈 응답)");
  if (r.done) {
    console.log(`[done] tokens_used=${r.done.tokens_used} cost_krw=${r.done.cost_krw} message_id=${r.done.message_id}`);
  }
  if (r.error) console.log(`[error 전문] ${JSON.stringify(r.error)}`);
}

const mode =
  process.argv[2] === "multi"
    ? "multi"
    : process.argv[2] === "close"
      ? "close"
      : process.argv[2] === "actions"
        ? "actions"
        : "single";

if (mode === "actions") {
  // ── T-A 실측 — context.studio 포함 발사, event: actions 원문 출력(판정 없음) ──
  const STUDIO = {
    mode: "commerce",
    deck: [
      { id: "content", label: "콘텐츠", applied: false, locked: false },
      { id: "product", label: "상품", applied: false, locked: false },
      { id: "shipping", label: "배송 안내", applied: false, locked: false },
      { id: "coupon", label: "쿠폰", applied: false, locked: true },
    ],
    fields: { title: "", productName: "", productPrice: "" },
  };
  const SHOTS = [
    "우리 농장 사과 5kg 팔고 싶어, 무료배송으로",
    "쿠폰도 넣어줘",
    // 3발 — 값이 갖춰진 요청(이름+가격): 액션 방출 경로 실측용.
    "괴산 사과 5kg 35,000원에 팔래, 상품 블록에 넣어줘",
  ];
  for (let i = 0; i < SHOTS.length; i++) {
    console.log(`\n════ [${i + 1}/${SHOTS.length}] "${SHOTS[i]}" (새 세션 · studio 포함) ════`);
    const r = await runChat(SHOTS[i], null, { studio: STUDIO });
    console.log(`[http] status=${r.status} stage=${r.stage ?? "-"}`);
    if (r.nonSse) console.log("[non-sse body]", r.nonSse);
    console.log(`[event: actions] ${r.actions ? "수신" : "미수신"}`);
    if (r.actions) console.log(JSON.stringify(r.actions, null, 2));
    console.log("[answer 전문]");
    console.log(r.answer || "(빈 응답)");
    if (r.done) {
      console.log(`[done] tokens_used=${r.done.tokens_used} cost_krw=${r.done.cost_krw}`);
    }
    if (r.error) console.log(`[error 전문] ${JSON.stringify(r.error)}`);
  }
  await client.auth.signOut();
  console.log(`\n[secure] 토큰·키·비밀번호 미출력 확인 (계정: ${usedLabel})`);
  process.exit(0);
}

if (mode === "close") {
  // ── T2.5 실측 — 2턴 대화 → close(장기기억 추출) → lingo_user_facts RLS 조회 ──
  const TURNS = ["저는 괴산에서 사과 농장을 해요", "카드에 사진을 먼저 넣는 걸 좋아해요"];

  console.log(`\n════ [1/2] "${TURNS[0]}" (새 세션) ════`);
  const r1 = await runChat(TURNS[0]);
  printResult(r1);
  const sessionId = r1.sessionId;
  if (!sessionId) {
    console.error("[abort] meta 프레임에서 session_id 를 얻지 못함 — close 진행 불가");
    await client.auth.signOut();
    process.exit(1);
  }
  console.log(`[session] id=${sessionId}`);

  console.log(`\n════ [2/2] "${TURNS[1]}" (같은 세션) ════`);
  const r2 = await runChat(TURNS[1], sessionId);
  printResult(r2);

  // 종료 액션 — 단발 JSON 응답 {closed, facts_added}.
  console.log(`\n════ close 호출 ════`);
  const closeRes = await fetch(`${url}/functions/v1/lingo-chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishable,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "close", session_id: sessionId }),
  });
  const closeText = await closeRes.text();
  console.log(`[close] status=${closeRes.status}`);
  console.log(`[close 응답 JSON] ${closeText.slice(0, 500)}`);

  // 유저 클라이언트(RLS 본인 SELECT)로 장기기억 최근 5행 조회.
  const { data: facts, error: fErr } = await client
    .from("lingo_user_facts")
    .select("kind, fact, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\n[lingo_user_facts 최근 5행]");
  if (fErr) {
    console.log(`조회 실패: ${fErr.message}`);
  } else if ((facts ?? []).length === 0) {
    console.log("(0행)");
  } else {
    for (const f of facts) {
      console.log(JSON.stringify({ kind: f.kind, text: f.fact, created_at: f.created_at }));
    }
  }
} else if (mode === "multi") {
  // ── T4-2 말귀 테스트 — 서툰 입력 3개, 각각 새 세션으로 순차 발사. 판정 없음(원문만). ──
  const MESSAGES = [
    "그거 어디서 바꾸는거야",
    "사진이 안올라가지네",
    "머부터 해야되ㅈ?",
  ];
  for (let i = 0; i < MESSAGES.length; i++) {
    console.log(`\n════ [${i + 1}/3] "${MESSAGES[i]}" (새 세션) ════`);
    const r = await runChat(MESSAGES[i]);
    printResult(r);
  }
} else {
  // ── 기본 모드 — 단일 발사 + DB 기록 조회(RLS 본인 SELECT) ──
  const r = await runChat("처음인데 뭐부터 하면 되나요?");
  printResult(r);

  const { data: sessions, error: sErr } = await client
    .from("lingo_sessions")
    .select("id, surface, status")
    .order("created_at", { ascending: false })
    .limit(1);
  console.log("\n[lingo_sessions 최근 1행]");
  console.log(sErr ? `조회 실패: ${sErr.message}` : JSON.stringify(sessions, null, 2));

  const { data: messages, error: mErr } = await client
    .from("lingo_messages")
    .select("role, content, tokens_used, cost_krw")
    .order("created_at", { ascending: false })
    .limit(2);
  console.log("\n[lingo_messages 최근 2행]");
  if (mErr) {
    console.log(`조회 실패: ${mErr.message}`);
  } else {
    for (const m of messages ?? []) {
      console.log(
        JSON.stringify({
          role: m.role,
          content: (m.content ?? "").slice(0, 80),
          tokens_used: m.tokens_used,
          cost_krw: m.cost_krw,
        }),
      );
    }
    if ((messages ?? []).length === 0) console.log("(0행)");
  }
}

await client.auth.signOut();
console.log(`\n[secure] 토큰·키·비밀번호 미출력 확인 (계정: ${usedLabel})`);
