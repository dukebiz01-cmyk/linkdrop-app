// get-price-band — KAMIS 소매가 실연동 (STEP 4-A).
//
// POST { item_code, category_code, regday?, rank_code? }
//   → { status, item_code, item_name, sources:[...], cached, note? }
//
// STEP 4-A 범위: KAMIS dailyPriceByCategoryList **소매가(p_product_cls_code=02)** 1개 소스만.
//   도매가(4-B)·네이버쇼핑(4-C)은 다음 단계 — 출력 `sources` 배열에 push 하면 확장됨.
//
// item_code/category_code = 우리 kamis_items 테이블 값(둘 다 보유).
// price_cache(v8.0) 재사용: cache_key 를 품목별 동적화. service_role 로 RLS 우회(Edge 전용).
// verify_jwt 는 함수 코드에서 체크 안 함(기존대로) — 클라가 functions.invoke 로 유저 JWT 동반.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// KAMIS 소매 일별 부류별 시세.
const KAMIS_BASE = "http://www.kamis.or.kr/service/price/xml.do";
const KAMIS_ACTION = "dailyPriceByCategoryList";
const PRODUCT_CLS_RETAIL = "02"; // 02=소매 (4-B 도매=01 은 다음 단계)
const COUNTRY_CODE = "1101"; // 서울
const DEFAULT_TTL_SEC = 86400;
const FETCH_TIMEOUT_MS = 10_000;

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

// 어제(Asia/Seoul) YYYY-MM-DD — KAMIS 당일가는 오전엔 미집계라 어제를 기본값으로.
function yesterdayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(Date.now() - 86_400_000),
  );
}

// "8,600" → 8600. 빈값/"-"/숫자 아님 → null.
function parsePrice(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).replace(/,/g, "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── 출력 소스(4-B/4-C 확장 대비 동일 shape) ──
type PriceSource = {
  source: string; // "KAMIS"
  source_label: string; // "KAMIS 소매시세"
  price_type: "retail" | "wholesale" | "online";
  low: number;
  high: number;
  unit: string;
  rank_note: string; // "상품~중품" 등
  ref_date: string;
};

type PriceBandResult = {
  status: "ok" | "no_data" | "unconfigured" | "error";
  item_code: string;
  item_name: string | null;
  sources: PriceSource[];
  cached: boolean;
  note?: string;
};

// KAMIS item 한 행(필요 필드만).
type KamisItem = {
  item_name?: string;
  item_code?: string;
  kind_name?: string;
  rank?: string;
  rank_code?: string;
  unit?: string;
  dpr1?: string; // 당일가(콤마 포함)
};

// 타임아웃 fetch (extract-url-metadata 패턴 차용).
async function fetchWithTimeout(url: string): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// KAMIS 소매가 호출 → KAMIS 소스 1개(또는 null=데이터 없음).
//   반환: { source, item_name } | null. error/no_data 는 null.
async function fetchKamisRetail(
  itemCode: string,
  categoryCode: string,
  regday: string,
  rankCode: "04" | "05" | undefined,
  certKey: string,
  certId: string,
): Promise<{ source: PriceSource; item_name: string | null } | null> {
  const params = new URLSearchParams({
    action: KAMIS_ACTION,
    p_product_cls_code: PRODUCT_CLS_RETAIL,
    p_country_code: COUNTRY_CODE,
    p_regday: regday,
    p_convert_kg_yn: "N",
    p_item_category_code: categoryCode,
    p_cert_key: certKey,
    p_cert_id: certId, // cert_id 는 @ 포함 → URLSearchParams 가 인코딩 처리
    p_returntype: "json",
  });
  const url = `${KAMIS_BASE}?${params.toString()}`;

  let json: { data?: { error_code?: string; item?: KamisItem[] } };
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error("[get-price-band] KAMIS non-ok:", res.status);
      return null;
    }
    json = await res.json();
  } catch (e) {
    console.error("[get-price-band] KAMIS fetch error:", String((e as Error).message ?? e));
    return null;
  }

  const data = json?.data;
  // 미조사 품목(예: 옥수수)·오류코드 → 데이터 없음(정상 처리).
  if (!data || data.error_code !== "000" || !Array.isArray(data.item) || data.item.length === 0) {
    return null;
  }

  // 우리 item_code 매칭 행만.
  const matched = data.item.filter((r) => r.item_code === itemCode);
  if (matched.length === 0) return null;

  // 등급 필터(지정 시) — "04"=상품 / "05"=중품.
  const ranked = rankCode ? matched.filter((r) => r.rank_code === rankCode) : matched;
  const rows = ranked.length > 0 ? ranked : matched;

  const sangPum = rows.find((r) => r.rank_code === "04"); // 상품
  const jungPum = rows.find((r) => r.rank_code === "05"); // 중품
  const sangPrice = parsePrice(sangPum?.dpr1);
  const jungPrice = parsePrice(jungPum?.dpr1);

  // 가격 후보 모음(상품/중품 외 등급 포함, 0보다 큰 값만).
  const allPrices = rows.map((r) => parsePrice(r.dpr1)).filter((n): n is number => n != null);
  if (allPrices.length === 0) return null; // 가격 다 빈값 → no_data

  // low=중품가 우선(없으면 최소), high=상품가 우선(없으면 최대).
  const low = jungPrice ?? Math.min(...allPrices);
  const high = sangPrice ?? Math.max(...allPrices);

  const unit = rows[0]?.unit ?? "";
  const itemName = rows[0]?.item_name ?? null;
  const rankNote =
    sangPrice != null && jungPrice != null
      ? "상품~중품"
      : sangPrice != null
        ? "상품"
        : jungPrice != null
          ? "중품"
          : "시세";

  const source: PriceSource = {
    source: "KAMIS",
    source_label: "KAMIS 소매시세",
    price_type: "retail",
    low: Math.min(low, high),
    high: Math.max(low, high),
    unit,
    rank_note: rankNote,
    ref_date: regday,
  };
  return { source, item_name: itemName };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ status: "error", message: "POST only" }, 405);

  let body: {
    item_code?: string;
    category_code?: string;
    regday?: string;
    rank_code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "error", note: "INVALID_JSON" }, 400);
  }

  const itemCode = typeof body.item_code === "string" ? body.item_code.trim() : "";
  const categoryCode = typeof body.category_code === "string" ? body.category_code.trim() : "";
  if (!itemCode || !categoryCode) {
    return jsonResponse(
      { status: "error", note: "item_code, category_code 가 필요해요.", item_code: itemCode, sources: [], cached: false },
      400,
    );
  }
  const regday =
    typeof body.regday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.regday)
      ? body.regday
      : yesterdayKst();
  const rankCode =
    body.rank_code === "04" || body.rank_code === "05" ? body.rank_code : undefined;

  // cert 미설정 → unconfigured (검증 통과로 처리 금지).
  const certKey = Deno.env.get("KAMIS_CERT_KEY");
  const certId = Deno.env.get("KAMIS_CERT_ID");
  if (!certKey || !certId) {
    return jsonResponse({
      status: "unconfigured",
      item_code: itemCode,
      item_name: null,
      sources: [],
      cached: false,
      note: "KAMIS 인증키 미설정",
    } satisfies PriceBandResult);
  }

  // 1) 캐시 조회 — 품목별 동적 cache_key.
  const cacheKey = `kamis|${itemCode}|${COUNTRY_CODE}|${regday}`;
  try {
    const { data: cached } = await supabase
      .from("price_cache")
      .select("retail, ref_date, fetched_at, ttl_sec")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    const row = cached as
      | { retail: unknown; ref_date: string | null; fetched_at: string; ttl_sec: number }
      | null;
    if (row?.retail && row.fetched_at) {
      const freshUntil = new Date(row.fetched_at).getTime() + row.ttl_sec * 1000;
      if (freshUntil > Date.now()) {
        const payload = row.retail as { item_name: string | null; sources: PriceSource[] };
        return jsonResponse({
          status: payload.sources.length > 0 ? "ok" : "no_data",
          item_code: itemCode,
          item_name: payload.item_name ?? null,
          sources: payload.sources ?? [],
          cached: true,
        } satisfies PriceBandResult);
      }
    }
  } catch (e) {
    console.error("[get-price-band] cache read failed:", String((e as Error).message ?? e));
    // 캐시 실패해도 실호출로 진행.
  }

  // 2) KAMIS 소매가 실호출.
  const kamis = await fetchKamisRetail(itemCode, categoryCode, regday, rankCode, certKey, certId);

  const sources: PriceSource[] = [];
  let itemName: string | null = null;
  if (kamis) {
    sources.push(kamis.source); // 4-B/4-C 는 여기 추가 push
    itemName = kamis.item_name;
  }

  const result: PriceBandResult = {
    status: sources.length > 0 ? "ok" : "no_data",
    item_code: itemCode,
    item_name: itemName,
    sources,
    cached: false,
  };

  // 3) 캐시 저장 — sources 를 retail jsonb 에 담음(no_data 도 캐시해 반복 호출 절약).
  try {
    await supabase.from("price_cache").upsert(
      {
        cache_key: cacheKey,
        retail: { item_name: itemName, sources },
        ref_date: regday,
        fetched_at: new Date().toISOString(),
        ttl_sec: DEFAULT_TTL_SEC,
        source: "KAMIS(aT)",
      },
      { onConflict: "cache_key" },
    );
  } catch (e) {
    console.error("[get-price-band] cache write failed:", String((e as Error).message ?? e));
    // 캐시 실패해도 결과는 반환.
  }

  return jsonResponse(result);
});
