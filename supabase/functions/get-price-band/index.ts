// get-price-band — 시세 레이어 Slice 1 (mock + price_cache 캐시).
//
// POST { query: string, region?: string, grade?: string }
//   → PriceBand 고정 계약 (아래 PriceBand 타입).
//
// Slice 1 범위:
//   · query 무관하게 "고구마" 1품목 고정 (cache_key 상수).
//   · price_cache read/write 캐시 동작 (TTL 86400s).
//   · 실 KAMIS(aT) 소매가 호출은 TODO(Slice 1b) — 지금은 mock 반환.
//   · 가격 숫자는 mock 상수에서만 (환각 금지).
//
// service_role 키로 createClient → RLS 우회 (price_cache 정책 0 = Edge 전용).

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

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

// ── 고정 계약 ───────────────────────────────────────────────────────────
type Money = { price: number; unit: string; currency: "KRW" };

type PriceBand = {
  status: "ok" | "stale" | "no_match";
  item: string;
  retail: Money;
  /** 참고/상한 — UI에서 구매자에겐 숨김. */
  wholesale: { price: number; unit: string } | null;
  ref_date: string;
  source: "KAMIS(aT)";
  cached: boolean;
  note: string;
};

// Slice 1 — 고구마 고정. (품목 분기/별칭 맵은 후속 Slice.)
const CACHE_KEY = "sweetpotato|default|nationwide|normal";
const ITEM_NAME = "고구마";
const DEFAULT_TTL_SEC = 86400;
const SOURCE = "KAMIS(aT)" as const;

// 오늘 (Asia/Seoul 기준 YYYY-MM-DD).
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// fetchPrice — env-gated. 실 KAMIS 호출은 Slice 1b TODO.
//   가격 숫자는 mock 상수에서만 (AI 생성/환각 금지).
function fetchPrice(): {
  retail: Money;
  wholesale: { price: number; unit: string };
  ref_date: string;
  note: string;
} {
  const certId = Deno.env.get("KAMIS_CERT_ID");
  const certKey = Deno.env.get("KAMIS_CERT_KEY");

  if (certId && certKey) {
    // TODO(Slice 1b): 실 KAMIS(aT) 소매가 호출.
    //   엔드포인트/품목코드(p_itemcategorycode·p_itemcode)/CERT_ID 확정 후 구현.
    //   예: https://www.kamis.or.kr/service/price/xml.do?action=dailyPriceByCategoryList ...
    //   현재는 미구현 → mock fall-through (계약·캐시 흐름 검증용).
  }

  // mock (Slice 1) — 고구마 고정값.
  return {
    retail: { price: 25000, unit: "5kg", currency: "KRW" },
    wholesale: { price: 18000, unit: "10kg" },
    ref_date: todayKst(),
    note: "mock",
  };
}

type PriceCacheRow = {
  cache_key: string;
  retail: Money | null;
  wholesale: { price: number; unit: string } | null;
  ref_date: string | null;
  fetched_at: string;
  ttl_sec: number;
  source: string;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ status: "error", message: "POST only" }, 405);
  }

  try {
    // 입력 파싱 — Slice 1 은 query/region/grade 를 받기만 하고 고구마 고정.
    await req.json().catch(() => ({}));

    // a. 캐시 조회
    const { data: cached } = await supabase
      .from("price_cache")
      .select("cache_key, retail, wholesale, ref_date, fetched_at, ttl_sec, source")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();

    const row = cached as PriceCacheRow | null;

    // b. 신선하면 캐시 반환
    if (row?.retail && row.fetched_at) {
      const freshUntil = new Date(row.fetched_at).getTime() + row.ttl_sec * 1000;
      if (freshUntil > Date.now()) {
        const band: PriceBand = {
          status: "ok",
          item: ITEM_NAME,
          retail: row.retail,
          wholesale: row.wholesale,
          ref_date: row.ref_date ?? todayKst(),
          source: SOURCE,
          cached: true,
          note: "mock",
        };
        return jsonResponse(band);
      }
    }

    // c. 없거나 stale → fetch → upsert → 반환
    const fresh = fetchPrice();
    const fetchedAt = new Date().toISOString();

    const { error: upsertError } = await supabase.from("price_cache").upsert(
      {
        cache_key: CACHE_KEY,
        retail: fresh.retail,
        wholesale: fresh.wholesale,
        ref_date: fresh.ref_date,
        fetched_at: fetchedAt,
        ttl_sec: DEFAULT_TTL_SEC,
        source: SOURCE,
      },
      { onConflict: "cache_key" },
    );
    if (upsertError) {
      console.error("[get-price-band] cache upsert failed:", upsertError);
      // 캐시 실패해도 신선 데이터는 반환 (best-effort 캐시).
    }

    const band: PriceBand = {
      status: "ok",
      item: ITEM_NAME,
      retail: fresh.retail,
      wholesale: fresh.wholesale,
      ref_date: fresh.ref_date,
      source: SOURCE,
      cached: false,
      note: fresh.note,
    };
    return jsonResponse(band);
  } catch (e) {
    console.error("[get-price-band] error:", e);
    return jsonResponse(
      { status: "error", message: e instanceof Error ? e.message : "unknown" },
      500,
    );
  }
});
