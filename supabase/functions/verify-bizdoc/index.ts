// verify-bizdoc — 국세청 사업자 진위확인. extract-bizdoc 출력(b_no/start_dt/p_nm)을
//   국세청(odcloud) status+validate 로 검증 후 통과 시에만 partners 본인행에 통과시각 기록.
//
// POST { user_id, partner_id, b_no, start_dt, p_nm }
// → 통과: { ok:true, b_stt_cd:"01", valid:"01", nts_verified_at }
//   실패: { ok:false, reason, b_stt_cd?|valid? }   (검증 실패 — DB 미기록)
//
// AI 안 씀(추출·검증만, 생성 0). extract-bizdoc 골격(env·verify_jwt·CORS·createClient) 재사용.
//   verify_jwt ON 유지 → Authorization Bearer 유저 JWT 로 auth.uid 확인(IDOR 차단).
//   ⚠️ NTS_SERVICE_KEY 는 Deno.env.get 으로만. 응답/로그에 serviceKey·키포함 URL 절대 노출 금지.
//   ⚠️ 국세청 API 비정상(키오류·네트워크) 이면 5xx — 절대 통과 처리/DB 기록 안 함.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NTS_SERVICE_KEY = Deno.env.get("NTS_SERVICE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 국세청(odcloud) 엔드포인트. serviceKey 는 호출부에서 "그대로"(추가 인코딩 금지) 붙인다.
const NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status";
const NTS_VALIDATE_URL = "https://api.odcloud.kr/api/nts-businessman/v1/validate";

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

// 숫자만 추출 후 정확히 len 자리일 때만 반환, 아니면 "".
function digits(v: unknown, len: number): string {
  const d = String(v ?? "").replace(/[^0-9]/g, "");
  return d.length === len ? d : "";
}

// 국세청 API 호출 — serviceKey 는 URL 쿼리에 그대로(추가 인코딩 금지).
//   응답은 절대 키/원본 URL 을 외부로 흘리지 않게 호출부에서 처리.
async function callNts(baseUrl: string, payload: object): Promise<Response> {
  const url = `${baseUrl}?serviceKey=${NTS_SERVICE_KEY}`;
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);

  // 0) 유저 JWT → auth.uid (verify_jwt 게이트 통과분이지만 uid 를 직접 확인해 IDOR 차단).
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ error: "AUTH_REQUIRED", message: "로그인이 필요해요." }, 401);
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const authUid = userData?.user?.id ?? null;
  if (userErr || !authUid) {
    return jsonResponse({ error: "AUTH_INVALID", message: "세션이 유효하지 않아요." }, 401);
  }

  let body: {
    user_id?: string;
    partner_id?: string;
    b_no?: string;
    start_dt?: string;
    p_nm?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (!body.user_id || !body.partner_id || !body.b_no || !body.start_dt || !body.p_nm) {
    return jsonResponse(
      {
        error: "MISSING_PARAMS",
        message: "user_id, partner_id, b_no, start_dt, p_nm 가 필요해요.",
      },
      400,
    );
  }

  // user_id 파라미터는 JWT 의 auth.uid 와 일치해야 함.
  if (body.user_id !== authUid) {
    return jsonResponse(
      { error: "FORBIDDEN", message: "본인 계정만 검증할 수 있어요." },
      403,
    );
  }

  // 형식 정규화/검증 — b_no 10자리, start_dt 8자리(YYYYMMDD).
  const bNo = digits(body.b_no, 10);
  const startDt = digits(body.start_dt, 8);
  const pNm = String(body.p_nm).trim();
  if (!bNo || !startDt || !pNm) {
    return jsonResponse(
      {
        error: "INVALID_FORMAT",
        message: "사업자번호 10자리·개업일 8자리(YYYYMMDD)·대표자명을 확인해 주세요.",
      },
      400,
    );
  }

  // 1) 소유 가드(IDOR 차단) — 본인 소유 매장만. secret 클라이언트라 RLS 우회 → WHERE 로 강제.
  const { data: partner, error: pErr } = await supabase
    .from("partners")
    .select("id")
    .eq("id", body.partner_id)
    .eq("owner_user_id", authUid)
    .maybeSingle();
  if (pErr) {
    return jsonResponse({ error: "DB_ERROR", message: pErr.message }, 500);
  }
  if (!partner) {
    return jsonResponse(
      { error: "FORBIDDEN", message: "본인 소유 매장이 아니에요." },
      403,
    );
  }

  // 2) 국세청 상태조회(status) — 운영 중("01")만 통과.
  let statusJson: { data?: Array<{ b_stt_cd?: string; b_stt?: string }> };
  try {
    const res = await callNts(NTS_STATUS_URL, { b_no: [bNo] });
    if (!res.ok) {
      // 키오류·쿼터·네트워크 등 → 5xx. (검증 통과로 처리 금지, DB 미기록.) 키는 로그에 안 찍음.
      console.error("[verify-bizdoc] NTS status non-ok:", res.status);
      return jsonResponse(
        { error: "NTS_STATUS_FAILED", status_code: res.status, message: "국세청 상태조회에 실패했어요. 잠시 후 다시 시도해 주세요." },
        502,
      );
    }
    statusJson = await res.json();
  } catch (e) {
    console.error("[verify-bizdoc] NTS status error:", String((e as Error).message ?? e));
    return jsonResponse(
      { error: "NTS_STATUS_ERROR", message: "국세청 상태조회 중 문제가 생겼어요." },
      502,
    );
  }

  const statusRow = statusJson?.data?.[0];
  const bSttCd = statusRow?.b_stt_cd ?? "";
  if (!bSttCd) {
    // 응답 형태 이상 → 비정상으로 간주, 통과 처리 안 함.
    return jsonResponse(
      { error: "NTS_STATUS_MALFORMED", message: "국세청 응답을 해석할 수 없어요." },
      502,
    );
  }
  if (bSttCd !== "01") {
    // "02"=휴업, "03"=폐업 등 → 운영 중 아님. 검증 실패(DB 미기록).
    return jsonResponse({ ok: false, reason: "휴업/폐업 사업자", b_stt_cd: bSttCd });
  }

  // 3) 국세청 진위확인(validate) — b_no+start_dt+p_nm 3값 일치("01")만 통과.
  let validateJson: { data?: Array<{ valid?: string; valid_msg?: string }> };
  try {
    const res = await callNts(NTS_VALIDATE_URL, {
      businesses: [{ b_no: bNo, start_dt: startDt, p_nm: pNm }],
    });
    if (!res.ok) {
      console.error("[verify-bizdoc] NTS validate non-ok:", res.status);
      return jsonResponse(
        { error: "NTS_VALIDATE_FAILED", status_code: res.status, message: "국세청 진위확인에 실패했어요. 잠시 후 다시 시도해 주세요." },
        502,
      );
    }
    validateJson = await res.json();
  } catch (e) {
    console.error("[verify-bizdoc] NTS validate error:", String((e as Error).message ?? e));
    return jsonResponse(
      { error: "NTS_VALIDATE_ERROR", message: "국세청 진위확인 중 문제가 생겼어요." },
      502,
    );
  }

  const validateRow = validateJson?.data?.[0];
  const valid = validateRow?.valid ?? "";
  if (!valid) {
    return jsonResponse(
      { error: "NTS_VALIDATE_MALFORMED", message: "국세청 응답을 해석할 수 없어요." },
      502,
    );
  }
  if (valid !== "01") {
    // "02"=불일치 → 개업일/대표자명/사업자번호 중 하나라도 안 맞음. 검증 실패(DB 미기록).
    return jsonResponse({
      ok: false,
      reason: "등록정보 불일치(개업일·대표자명 확인)",
      valid,
    });
  }

  // 4) 둘 다 통과 → partners 본인행에만 통과시각 기록.
  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("partners")
    .update({ nts_verified_at: nowIso })
    .eq("id", body.partner_id)
    .eq("owner_user_id", authUid);
  if (upErr) {
    return jsonResponse({ error: "DB_ERROR", message: upErr.message }, 500);
  }

  return jsonResponse({ ok: true, b_stt_cd: "01", valid: "01", nts_verified_at: nowIso });
});
