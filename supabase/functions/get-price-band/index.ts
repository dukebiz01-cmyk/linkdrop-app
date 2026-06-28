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
// 키 정렬(generate-promo-copy 패턴): V2 SECRET_KEY 우선, 레거시 SERVICE_ROLE_KEY 폴백.
const SUPABASE_SECRET_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// 4-B 도매경락 — data.go.kr aT katRealTime2. 미설정 시 도매 소스 graceful skip.
const WHOLESALE_API_KEY = Deno.env.get("WHOLESALE_API_KEY");
// 4-C 인터넷 판매가 — 네이버쇼핑 검색 API(공식). 미설정 시 인터넷 소스 graceful skip.
const NAVER_CLIENT_ID = Deno.env.get("NAVER_CLIENT_ID") ?? "";
const NAVER_CLIENT_SECRET = Deno.env.get("NAVER_CLIENT_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
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

// ── 4-B 도매경락(aT katRealTime2) ──
//   cond[필드::연산자]=값 표준필터(날짜 EQ 필수). 시장코드 미지정 = 전국 다시장 1회 수신.
const KAT_BASE = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
const KAT_NUM_ROWS = 1000; // 전국 다시장 표본 충분히(배추 3,500건 중 1,000 표본 = 8개+ 시장).
const KAT_LOOKBACK_DAYS = 6; // 주말·휴장 회피: regday 부터 최대 6일 역행해 직전 영업일.

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

// 도매경락(katRealTime2) item 한 행(필요 필드만).
type KatItem = {
  corp_gds_item_nm?: string; // 품목명
  scsbd_prc?: string; // 낙찰가(단위수량당)
  unit_qty?: string; // 단위수량(kg)
  unit_nm?: string; // 단위명(kg 등)
  whsl_mrkt_nm?: string; // 도매시장명
  whsl_mrkt_cd?: string; // 도매시장코드
};

// 네이버쇼핑 item(필요 필드만).
type NaverShopItem = {
  title?: string; // 상품명(HTML <b> 태그 포함 가능)
  lprice?: string; // 최저가(판매자 등록가)
  mallName?: string; // 판매처
};

// 타임아웃 fetch (extract-url-metadata 패턴 차용). init 옵션 = 네이버 인증 헤더용(추가, 기존 무영향).
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: "follow" });
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
  // regday 부터 최대 KAT_LOOKBACK_DAYS 역행하며 가격 있는 영업일 탐색.
  //   KAMIS 소매는 주말·휴일 dpr1="-"(미조사) → 단일 호출이면 주말엔 no_data.
  //   도매(fetchWholesale)와 동일 역행 패턴으로 직전 영업일 자동 보정.
  let usedDate = regday;
  let rows: KamisItem[] = [];
  for (let back = 0; back < KAT_LOOKBACK_DAYS; back++) {
    const d = addDaysIso(regday, -back);
    const params = new URLSearchParams({
      action: KAMIS_ACTION,
      p_product_cls_code: PRODUCT_CLS_RETAIL,
      p_country_code: COUNTRY_CODE,
      p_regday: d,
      p_convert_kg_yn: "N",
      p_item_category_code: categoryCode,
      p_cert_key: certKey,
      p_cert_id: certId, // cert_id 는 @ 포함 → URLSearchParams 가 인코딩 처리
      p_returntype: "json",
    });
    let json: { data?: { error_code?: string; item?: KamisItem[] } };
    try {
      const res = await fetchWithTimeout(`${KAMIS_BASE}?${params.toString()}`);
      if (!res.ok) {
        console.error("[get-price-band] KAMIS non-ok:", res.status);
        continue;
      }
      json = await res.json();
    } catch (e) {
      console.error("[get-price-band] KAMIS fetch error:", String((e as Error).message ?? e));
      continue;
    }
    const data = json?.data;
    // 미조사 품목(예: 옥수수)·오류코드 → 데이터 없음(다음 날로).
    if (!data || data.error_code !== "000" || !Array.isArray(data.item) || data.item.length === 0) {
      continue;
    }
    // 우리 item_code 매칭 행만.
    const matched = data.item.filter((r) => r.item_code === itemCode);
    if (matched.length === 0) continue;
    // 등급 필터(지정 시) — "04"=상품 / "05"=중품.
    const ranked = rankCode ? matched.filter((r) => r.rank_code === rankCode) : matched;
    const candidate = ranked.length > 0 ? ranked : matched;
    // 가격 1개라도 파싱되면 이 날 채택(주말 "-" 행만 있으면 다음 날로).
    if (!candidate.some((r) => parsePrice(r.dpr1) != null)) continue;
    rows = candidate;
    usedDate = d;
    break;
  }
  if (rows.length === 0) return null; // 6일 역행에도 가격 없음 → no_data

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
    ref_date: usedDate,
  };
  return { source, item_name: itemName };
}

// "YYYY-MM-DD" + n일 (UTC 단순 가감 — TZ 무관). 영업일 역행 탐색용.
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${nd.getUTCFullYear()}-${z(nd.getUTCMonth() + 1)}-${z(nd.getUTCDate())}`;
}

// 4-B 도매경락 — 전국 도매시장 실시간 경락가. fetchKamisRetail 과 동일 시그니처.
//   aT katRealTime2/trades2. 시장코드 미지정 → 전국 다시장 1회 수신(범위+평균).
//   regday 가 주말·휴장이면 며칠 역행해 직전 영업일로 자동 보정.
//   가공품(들기름 등)은 경락 대상 아님 → 0건 → null 반환(graceful, 소스 미표시).
async function fetchWholesale(
  itemName: string,
  regday: string,
  apiKey: string,
): Promise<{ source: PriceSource; item_name: string | null } | null> {
  // cond[필드::연산자]=값. 대괄호·콜론 인코딩 필수. serviceKey 는 인코딩 1회.
  const cond = (field: string, op: string, val: string) =>
    `${encodeURIComponent(`cond[${field}::${op}]`)}=${encodeURIComponent(val)}`;

  // regday 부터 최대 KAT_LOOKBACK_DAYS 역행하며 데이터 있는 영업일 탐색.
  let usedDate = regday;
  let items: KatItem[] = [];
  for (let back = 0; back < KAT_LOOKBACK_DAYS; back++) {
    const d = addDaysIso(regday, -back);
    const qs = [
      `serviceKey=${encodeURIComponent(apiKey)}`,
      "returnType=JSON",
      `numOfRows=${KAT_NUM_ROWS}`,
      "pageNo=1",
      cond("trd_clcln_ymd", "EQ", d),
      cond("corp_gds_item_nm", "LIKE", itemName),
    ].join("&");
    let json: { response?: { body?: { items?: { item?: KatItem[] } } } };
    try {
      const res = await fetchWithTimeout(`${KAT_BASE}?${qs}`);
      if (!res.ok) {
        console.error("[get-price-band] KAT non-ok:", res.status);
        continue;
      }
      json = await res.json();
    } catch (e) {
      console.error("[get-price-band] KAT fetch error:", String((e as Error).message ?? e));
      continue;
    }
    const arr = json?.response?.body?.items?.item;
    if (Array.isArray(arr) && arr.length > 0) {
      items = arr;
      usedDate = d;
      break;
    }
  }
  if (items.length === 0) return null; // 데이터 없음(가공품·휴장 연속) → 소스 미표시

  // 품목 정밀 매칭: 괄호 앞 본명(品名) 기준 + 부산물/별종 제외.
  //   · 괄호 앞 본명으로 비교 → "칼리플라워(꽃양배추)"·"적채(양배추)" 는 본명에 배추 없어 제외.
  //   · 순/줄기 제외 → "고구마순"·"고구마줄기" 컷(고구마·고구마(국산)는 유지).
  //   · "양"+itemName 제외 → 양배추/양상추/양파 등 substring 별종 컷(단배추·얼갈이배추는 유지).
  const matched = items.filter((r) => {
    if (typeof r.corp_gds_item_nm !== "string") return false;
    const base = r.corp_gds_item_nm.split("(")[0];
    return (
      base.includes(itemName) &&
      !base.includes("순") &&
      !base.includes("줄기") &&
      !base.includes("양" + itemName)
    );
  });
  if (matched.length === 0) return null;

  // kg당 정규화: 낙찰가 ÷ 단위수량 (unit_nm=kg 행만). 그 외 단위 제외.
  const kgPrices: number[] = [];
  const markets = new Set<string>();
  for (const r of matched) {
    if (r.unit_nm !== "kg") continue;
    const prc = parsePrice(r.scsbd_prc);
    const uq = Number(r.unit_qty);
    if (prc == null || !Number.isFinite(uq) || uq <= 0) continue;
    kgPrices.push(prc / uq);
    if (r.whsl_mrkt_nm) markets.add(r.whsl_mrkt_nm);
  }
  if (kgPrices.length === 0) return null;

  // 경매 떨이·프리미엄 outlier 가 raw min/max 를 오염(배추 20~10,500원) →
  //   10~90 백분위로 "대부분 이 범위" 도출. 평균은 rank_note 에.
  kgPrices.sort((a, b) => a - b);
  const pct = (p: number) => kgPrices[Math.floor((kgPrices.length - 1) * p)];
  const low = Math.round(pct(0.1));
  const high = Math.round(pct(0.9));
  const avg = Math.round(kgPrices.reduce((s, v) => s + v, 0) / kgPrices.length);

  const source: PriceSource = {
    source: "도매경락",
    source_label: "전국 도매시장 경락가",
    price_type: "wholesale",
    low: Math.min(low, high),
    high: Math.max(low, high),
    unit: "kg",
    rank_note: `전국 ${markets.size}개 시장 · 평균 ${avg.toLocaleString("ko-KR")}원/kg`,
    ref_date: usedDate,
  };
  return { source, item_name: matched[0]?.corp_gds_item_nm ?? itemName };
}

// 오늘(Asia/Seoul) YYYY-MM-DD — 네이버 실시간 판매가 기준일.
function todayKstIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// 4-C 인터넷 판매가 — 네이버쇼핑 검색 API(공식, 크롤링 아님). fetchKamisRetail 동일 시그니처.
//   §0: 출처=네이버쇼핑, 검색어 명시. lprice=판매자 등록 최저가(우리 추천/단정 아님).
//   가공품(들기름 등)도 잡힘(도매와 달리). 키 없으면 null(graceful).
async function fetchNaverShop(
  itemName: string,
  clientId: string,
  clientSecret: string,
): Promise<{ source: PriceSource; item_name: string | null } | null> {
  // 키 중간 비ASCII 제거(discover-content 패턴) — ByteString 위반 차단.
  const clean = (s: string) => s.replace(/[^\x21-\x7E]/g, "");
  const id = clean(clientId);
  const secret = clean(clientSecret);
  if (!id || !secret) return null;

  const url = new URL("https://openapi.naver.com/v1/search/shop.json");
  url.searchParams.set("query", itemName);
  url.searchParams.set("display", "100");
  url.searchParams.set("sort", "sim");

  let items: NaverShopItem[] = [];
  try {
    const res = await fetchWithTimeout(url.toString(), {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    });
    if (!res.ok) {
      console.error("[get-price-band] NAVER non-ok:", res.status);
      return null;
    }
    const json = await res.json();
    items = Array.isArray(json?.items) ? (json.items as NaverShopItem[]) : [];
  } catch (e) {
    console.error("[get-price-band] NAVER fetch error:", String((e as Error).message ?? e));
    return null;
  }
  if (items.length === 0) return null;

  // 관련성 필터: itemName 포함 + 별종(양배추류)·가공/부산물 제외. 도매 가드와 동일 취지.
  const stripTag = (s: string) => s.replace(/<[^>]+>/g, "");
  const EXCLUDE = ["씨앗", "모종", "종자", "김치", "절임", "즙", "분말", "가루", "효소", "환", "추출"];
  const perKg: number[] = [];
  const raw: number[] = [];
  for (const it of items) {
    const title = stripTag(it.title ?? "");
    if (!title.includes(itemName)) continue;
    if (title.includes("양" + itemName)) continue; // 양배추 등 별종
    if (EXCLUDE.some((w) => title.includes(w))) continue;
    const lp = parsePrice(it.lprice);
    if (lp == null) continue;
    raw.push(lp);
    // 중량 추출: "3kg"·"500g" → kg당 환산(가능할 때만).
    const kgM = title.match(/([\d.]+)\s*kg/i);
    const gM = title.match(/([\d.]+)\s*g(?![a-zA-Z])/i);
    let kg: number | null = null;
    if (kgM) kg = Number(kgM[1]);
    else if (gM) kg = Number(gM[1]) / 1000;
    if (kg != null && kg >= 0.1 && kg <= 50) perKg.push(lp / kg);
  }
  if (raw.length === 0) return null;

  // 중량표기 상품이 충분(≥10)하면 kg당, 아니면 상품 단가(개당).
  const useKg = perKg.length >= 10;
  const arr = (useKg ? perKg : raw).slice().sort((a, b) => a - b);
  const pct = (p: number) => arr[Math.floor((arr.length - 1) * p)];
  const low = Math.round(pct(0.1));
  const high = Math.round(pct(0.9));
  const avg = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

  const source: PriceSource = {
    source: "네이버쇼핑",
    source_label: "인터넷 판매가",
    price_type: "online",
    low: Math.min(low, high),
    high: Math.max(low, high),
    unit: useKg ? "kg" : "개",
    rank_note: `"${itemName}" 네이버쇼핑 ${arr.length}개 · 판매자 등록가 · 평균 ${avg.toLocaleString("ko-KR")}원`,
    ref_date: todayKstIso(),
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
    sources.push(kamis.source); // 4-C 인터넷가는 여기 추가 push
    itemName = kamis.item_name;
  }

  // 품목 한글명 1회 해결 — kamis 응답 → 없으면 kamis_items 조회(옥수수 등 미조사 품목 대응).
  //   도매(4-B)·인터넷(4-C) 둘 다 이 이름으로 검색.
  let itemNameKo = kamis?.item_name ?? null;
  const needName = Boolean(WHOLESALE_API_KEY) || Boolean(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET);
  if (!itemNameKo && needName) {
    try {
      const { data: itemRow } = await supabase
        .from("kamis_items")
        .select("item_name")
        .eq("item_code", itemCode)
        .maybeSingle();
      itemNameKo = (itemRow as { item_name?: string } | null)?.item_name ?? null;
    } catch (e) {
      console.error(
        "[get-price-band] kamis_items name lookup failed:",
        String((e as Error).message ?? e),
      );
    }
  }

  // 2-B) 도매경락 실호출(4-B). WHOLESALE_API_KEY + 품목명 있을 때만.
  if (WHOLESALE_API_KEY && itemNameKo) {
    const wholesale = await fetchWholesale(itemNameKo, regday, WHOLESALE_API_KEY);
    if (wholesale) {
      sources.push(wholesale.source);
      if (!itemName) itemName = wholesale.item_name;
    }
  }

  // 2-C) 인터넷 판매가 실호출(4-C). NAVER 키 + 품목명 있을 때만.
  if (NAVER_CLIENT_ID && NAVER_CLIENT_SECRET && itemNameKo) {
    const naver = await fetchNaverShop(itemNameKo, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET);
    if (naver) {
      sources.push(naver.source);
      if (!itemName) itemName = naver.item_name;
    }
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
