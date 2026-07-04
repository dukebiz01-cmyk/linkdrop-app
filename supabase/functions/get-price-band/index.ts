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

// ── S4 sale_mode(판매규격) 상수 — 스펙 §4(보수적 기본값, 튜닝 가능) ──
//   단위가 같을 때만 한 밴드. count/volume 은 규격 정확매칭 후 톨러런스 이내만, 부족하면 숨김.
const COUNT_TOLERANCE = 0.2; // 선언 30개 → 24~36개 허용
const VOLUME_TOLERANCE = 0.15; // 선언 500ml → 425~575ml 허용
const MIN_COMPARABLE = 5; // 비교매물 미만이면 시세 숨김(§0 graceful)

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

// ── P5a 구조화 블록(단위 헌법) — base_unit=kg 고정. 기존 sources 보존 + 추가 필드. ──
type WholesaleBlock = {
  min: number;
  max: number;
  avg: number;
  market_count: number;
  as_of: string;
};
type OnlineBlock = {
  // converted_count < MIN_COMPARABLE 이면 insufficient(통계 null·건수는 정직 보고).
  status: "ok" | "insufficient";
  min: number | null;
  max: number | null;
  avg: number | null;
  converted_count: number;
  excluded_count: number;
  as_of: string;
};

type PriceBandResult = {
  status: "ok" | "no_data" | "unconfigured" | "error";
  item_code: string;
  item_name: string | null;
  sources: PriceSource[];
  cached: boolean;
  note?: string;
  // P5a 확장(옵셔널 — 기존 소비자 무영향). 온라인 통계는 kg 환산가 기준으로만 산출.
  base_unit?: "kg";
  wholesale?: WholesaleBlock | null;
  online?: OnlineBlock | null;
  per_unit_weight_g?: number; // 요청 파라미터 에코
  unit_count?: number; // 요청 파라미터 에코
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

// p10~p90 범위 + 절사평균. low/high 는 백분위(범위 그대로), 평균은 그 구간 안의 값만
//   평균내 outlier(선물세트 등) 우편향 제거 → 평균이 항상 범위 안. 입력은 오름차순 정렬.
function bandStats(sortedAsc: number[]): { low: number; high: number; avg: number } {
  const pct = (p: number) => sortedAsc[Math.floor((sortedAsc.length - 1) * p)];
  const lo = pct(0.1);
  const hi = pct(0.9);
  const inBand = sortedAsc.filter((v) => v >= lo && v <= hi);
  const base = inBand.length > 0 ? inBand : sortedAsc;
  const avg = base.reduce((s, v) => s + v, 0) / base.length;
  return { low: Math.round(lo), high: Math.round(hi), avg: Math.round(avg) };
}

// 4-B 도매경락 — 전국 도매시장 실시간 경락가. fetchKamisRetail 과 동일 시그니처.
//   aT katRealTime2/trades2. 시장코드 미지정 → 전국 다시장 1회 수신(범위+평균).
//   regday 가 주말·휴장이면 며칠 역행해 직전 영업일로 자동 보정.
//   가공품(들기름 등)은 경락 대상 아님 → 0건 → null 반환(graceful, 소스 미표시).
async function fetchWholesale(
  itemName: string,
  regday: string,
  apiKey: string,
): Promise<{ source: PriceSource; item_name: string | null; stats: WholesaleBlock } | null> {
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
  //   10~90 백분위 범위 + 절사평균(범위 안 값만). 평균은 rank_note 에.
  kgPrices.sort((a, b) => a - b);
  const { low, high, avg } = bandStats(kgPrices);

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
  return {
    source,
    item_name: matched[0]?.corp_gds_item_nm ?? itemName,
    // P5a 구조화 블록 — 표기용 통계(low/high/avg 동일값, 계약 필드명으로 재노출).
    stats: {
      min: source.low,
      max: source.high,
      avg,
      market_count: markets.size,
      as_of: usedDate,
    },
  };
}

// 오늘(Asia/Seoul) YYYY-MM-DD — 네이버 실시간 판매가 기준일.
function todayKstIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// ── S4 sale_mode(판매규격) — 단위가 같을 때만 한 밴드(스펙 §2/§3). ──
type SaleMode = "weight" | "count" | "volume";
type NaverBandUnit = "krw_per_kg" | "krw_per_listing";

// 스펙 §5 출력 — mode-aware. band=null 이면 숨김(생산자 화면이 "직접 책정" 안내).
type SaleModeResult = {
  sale_mode: SaleMode;
  band: { low: number; avg: number; high: number } | null;
  band_unit: NaverBandUnit;
  spec_label: string;
  source_count: number;
  sources_used: string[];
  hidden_reason: null | "insufficient_comparables" | "no_taxonomy";
};

type NaverShopResult = {
  // P5a: weight 모드에서 환산 가능 리스팅이 MIN_COMPARABLE 미만이면 source=null
  //   (sources 배열 미표시, 건수는 excludedCount/comparables 로 정직 보고).
  source: PriceSource | null;
  item_name: string | null;
  // 밴드 산출용 가격 배열(오름차순). weight=원/kg(환산가만), count/volume=원/listing.
  comparables: number[];
  bandUnit: NaverBandUnit;
  // P5a: 구성(수량·중량) 불명으로 비교에서 제외한 리스팅 수(weight 모드 집계).
  excludedCount: number;
};

// ── P5a 리스팅 구성 파싱(단위 헌법) — 온라인 비교는 kg 환산가로만. ──
//   우선순위: 복합 곱("2kg×3박스"=6kg) > 중량 단일(Nkg|Ng) > 개수만(N개|N입|N미|N팩).
//   중량 표기가 서로 다른 값 2개+("500g/1kg 선택" 류) = 모호 → unknown(제외 집계).
type ListingComposition =
  | { kind: "kg"; kg: number }
  | { kind: "count_only"; count: number }
  | { kind: "unknown" };

function parseListingComposition(title: string): ListingComposition {
  // 1) 복합 곱 — "2kg×3(박스)" / "3×2kg" 양방향. 총중량 = 곱.
  const mulA = title.match(/(\d+(?:\.\d+)?)\s*(kg|g)\s*[x×*]\s*(\d{1,3})/i);
  if (mulA) {
    const w = Number(mulA[1]) * (mulA[2].toLowerCase() === "g" ? 0.001 : 1);
    return { kind: "kg", kg: w * Number(mulA[3]) };
  }
  const mulB = title.match(/(\d{1,3})\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(kg|g)/i);
  if (mulB) {
    const w = Number(mulB[2]) * (mulB[3].toLowerCase() === "g" ? 0.001 : 1);
    return { kind: "kg", kg: Number(mulB[1]) * w };
  }
  // 2) 중량 단일 — kg·g 토큰 전부 수집(kg 환산 후 중복 제거). 값 1개면 채택, 2개+면 모호.
  const kgTokens = [...title.matchAll(/(\d+(?:\.\d+)?)\s*kg/gi)].map((m) => Number(m[1]));
  const gTokens = [...title.matchAll(/(\d+(?:\.\d+)?)\s*g(?![a-zA-Z])/gi)].map(
    (m) => Number(m[1]) / 1000,
  );
  const weights = [...new Set([...kgTokens, ...gTokens])];
  if (weights.length === 1) return { kind: "kg", kg: weights[0] };
  if (weights.length > 1) return { kind: "unknown" };
  // 3) 개수만 — 요청 per_unit_weight_g 있을 때만 환산 가능(호출부 판단).
  const c = title.match(/(\d{1,4})\s*(개|입|미|팩)/);
  if (c) return { kind: "count_only", count: Number(c[1]) };
  return { kind: "unknown" };
}

// 수량 토큰 추출(스펙 3-2): (\d{1,4})\s*(개|입|알|구|과|봉|수|미|포기|통|송이)
function extractCount(title: string): number | null {
  const m = title.match(/(\d{1,4})\s*(개|입|알|구|과|봉|수|미|포기|통|송이)/);
  return m ? Number(m[1]) : null;
}

// 무게(kg) 추출 — count 보조 매칭(approx_weight_kg)용. "3kg"·"500g"(g→kg).
function extractWeightKg(title: string): number | null {
  const kgM = title.match(/([\d.]+)\s*kg/i);
  if (kgM) return Number(kgM[1]);
  const gM = title.match(/([\d.]+)\s*g(?![a-zA-Z])/i);
  if (gM) return Number(gM[1]) / 1000;
  return null;
}

// 용량/중량 토큰 추출 + 단위계열(스펙 3-3): ml계열=ml/mL/밀리/리터/L · g계열=g/kg. 교차 금지.
function extractVolume(title: string): { value: number; family: "ml" | "g" } | null {
  const m = title.match(/(\d{1,5})\s*(ml|mL|밀리|리터|L|g|kg)/);
  if (!m) return null;
  const u = m[2].toLowerCase();
  const family: "ml" | "g" = u === "g" || u === "kg" ? "g" : "ml";
  return { value: Number(m[1]), family };
}

// unit_label → 단위계열. 매칭 안 되면 null(=volume 필터에서 전부 제외).
function volumeFamilyOf(label: string): "ml" | "g" | null {
  const l = label.toLowerCase();
  if (l === "ml" || l === "밀리" || l === "리터" || l === "l") return "ml";
  if (l === "g" || l === "kg") return "g";
  return null;
}

// 품목별 차단어 사전 — generic EXCLUDE 로 못 거르는 동음·파생 상품 컷("옥수수"→"옥수수수염차" 등).
//   품목명에 등록된 차단어가 제목에 있으면 제외. 미등록 품목 = generic EXCLUDE 만(빈 배열 fallback).
//   ★ 차단어에 품목명 자체(예: "옥수수")는 절대 넣지 말 것 — 자기 자신을 막음.
const ITEM_BLOCKLIST: Record<string, string[]> = {
  "옥수수": ["차", "수염", "뻥튀기", "팝콘", "튀밥", "콘칩", "통조림", "사료", "팝"],
  "들기름": ["비누", "캡슐", "마사지", "들깨", "샴푸", "화장품"],
  "참기름": ["비누", "캡슐", "마사지", "샴푸", "화장품"],
  "고구마": ["말랭이", "스틱", "칩", "라떼", "분말", "케이크", "빵", "순"],
  "배추": ["겉절이", "포기김치", "묵은지", "씨"],
};

// 제목이 itemName 의 품목별 차단어 중 하나라도 포함하면 true(=제외). 미등록 품목 → 항상 false.
//   count/volume(filterBySpec)·weight 네이버 필터 양쪽에서 공통 호출.
function isBlockedByItem(title: string, itemName: string): boolean {
  const list = ITEM_BLOCKLIST[itemName] ?? [];
  return list.some((w) => title.includes(w));
}

// count/volume 규격 정확매칭 필터(순수, 단위검증 가능). kg환산 STOP — listing 가격 그대로 반환.
//   공통 제외룰(품목명 포함·양품종·가공/부산물)은 기존 weight 필터와 동일.
function filterBySpec(
  items: NaverShopItem[],
  o: {
    mode: "count" | "volume";
    itemName: string;
    unitQty: number;
    unitLabel: string;
    approxWeightKg?: number;
    stripTag: (s: string) => string;
    exclude: string[];
  },
): number[] {
  const out: number[] = [];
  const wantFamily = o.mode === "volume" ? volumeFamilyOf(o.unitLabel) : null;
  const countLo = o.unitQty * (1 - COUNT_TOLERANCE);
  const countHi = o.unitQty * (1 + COUNT_TOLERANCE);
  const volLo = o.unitQty * (1 - VOLUME_TOLERANCE);
  const volHi = o.unitQty * (1 + VOLUME_TOLERANCE);
  const wKgLo = o.approxWeightKg != null ? o.approxWeightKg * (1 - COUNT_TOLERANCE) : null;
  const wKgHi = o.approxWeightKg != null ? o.approxWeightKg * (1 + COUNT_TOLERANCE) : null;

  for (const it of items) {
    const title = o.stripTag(it.title ?? "");
    if (!title.includes(o.itemName)) continue;
    if (title.includes("양" + o.itemName)) continue;
    if (o.exclude.some((w) => title.includes(w))) continue;
    if (isBlockedByItem(title, o.itemName)) continue; // 품목별 차단어(옥수수수염차 등)
    const lp = parsePrice(it.lprice);
    if (lp == null) continue;

    if (o.mode === "count") {
      const c = extractCount(title);
      let ok = c != null && c >= countLo && c <= countHi;
      // 스펙 3-2 보조: 수량 토큰 없/불일치여도 approx_weight_kg 무게밴드 들면 허용.
      if (!ok && wKgLo != null && wKgHi != null) {
        const wkg = extractWeightKg(title);
        ok = wkg != null && wkg >= wKgLo && wkg <= wKgHi;
      }
      if (ok) out.push(lp);
    } else {
      // volume — 동일 단위계열만(ml↔g 교차 금지) + ±VOLUME_TOLERANCE. ml/g 정규화 X.
      const v = extractVolume(title);
      if (v == null) continue;
      if (wantFamily == null || v.family !== wantFamily) continue;
      if (v.value >= volLo && v.value <= volHi) out.push(lp);
    }
  }
  return out;
}

// 4-C 인터넷 판매가 — 네이버쇼핑 검색 API(공식, 크롤링 아님). fetchKamisRetail 동일 시그니처.
//   §0: 출처=네이버쇼핑, 검색어 명시. lprice=판매자 등록 최저가(우리 추천/단정 아님).
//   가공품(들기름 등)도 잡힘(도매와 달리). 키 없으면 null(graceful).
//   ★ opts 미전달(기존 호출부) = weight 기본 → 기존 동작 100% 보존(하위호환).
async function fetchNaverShop(
  itemName: string,
  clientId: string,
  clientSecret: string,
  opts?: {
    mode?: SaleMode;
    unitQty?: number;
    unitLabel?: string;
    approxWeightKg?: number;
    // P5a — 개당 중량(g). 개수만 표기된 리스팅("옥수수 20개")을 kg 환산할 때 사용.
    perUnitWeightG?: number;
  },
): Promise<NaverShopResult | null> {
  // 키 중간 비ASCII 제거(discover-content 패턴) — ByteString 위반 차단.
  const clean = (s: string) => s.replace(/[^\x21-\x7E]/g, "");
  const id = clean(clientId);
  const secret = clean(clientSecret);
  if (!id || !secret) return null;

  const mode: SaleMode = opts?.mode ?? "weight";
  const unitQty = opts?.unitQty;
  const unitLabel = opts?.unitLabel;

  // 쿼리 규격 바인딩(스펙 3-2/3-3) — count/volume 은 규격을 검색어에 붙여 정확매칭("옥수수 30개").
  //   weight/기본은 itemName 단독(기존 동작).
  const specBound =
    (mode === "count" || mode === "volume") &&
    typeof unitQty === "number" &&
    typeof unitLabel === "string" &&
    unitLabel.length > 0;
  const query = specBound ? `${itemName} ${unitQty}${unitLabel}` : itemName;

  const url = new URL("https://openapi.naver.com/v1/search/shop.json");
  url.searchParams.set("query", query);
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

  // ── count/volume: 규격 정확매칭(톨러런스) + kg환산 STOP. listing 가격 그대로 밴드(원/listing). ──
  if (mode === "count" || mode === "volume") {
    const comparables = filterBySpec(items, {
      mode,
      itemName,
      unitQty: unitQty ?? 0,
      unitLabel: unitLabel ?? "",
      approxWeightKg: opts?.approxWeightKg,
      stripTag,
      exclude: EXCLUDE,
    });
    if (comparables.length === 0) return null;
    const arr = comparables.slice().sort((a, b) => a - b);
    const { low, high, avg } = bandStats(arr);
    const specText = `${unitQty}${unitLabel}`;
    const source: PriceSource = {
      source: "네이버쇼핑",
      source_label: "인터넷 판매가",
      price_type: "online",
      low: Math.min(low, high),
      high: Math.max(low, high),
      unit: specText,
      rank_note: `"${query}" 네이버쇼핑 ${arr.length}건 · 판매자 등록가 · 평균 ${avg.toLocaleString("ko-KR")}원`,
      ref_date: todayKstIso(),
    };
    return { source, item_name: itemName, comparables: arr, bandUnit: "krw_per_listing", excludedCount: 0 };
  }

  // ── weight/기본 — P5a 단위 헌법: 구성 파싱 → kg 환산가로만 통계(원/listing 폴백 제거). ──
  //   복합("2kg×3박스")=곱 처리 · 개수만은 perUnitWeightG 있을 때만 환산 ·
  //   불명/모호/환산범위(0.1~50kg) 밖 → 제외하고 excludedCount 집계.
  const perKg: number[] = [];
  let excluded = 0;
  for (const it of items) {
    const title = stripTag(it.title ?? "");
    if (!title.includes(itemName)) continue;
    if (title.includes("양" + itemName)) continue; // 양배추 등 별종
    if (EXCLUDE.some((w) => title.includes(w))) continue;
    if (isBlockedByItem(title, itemName)) continue; // 품목별 차단어(옥수수수염차 등) — weight 검색에도 적용
    const lp = parsePrice(it.lprice);
    if (lp == null) continue;
    const comp = parseListingComposition(title);
    let kg: number | null = null;
    if (comp.kind === "kg") kg = comp.kg;
    else if (
      comp.kind === "count_only" &&
      typeof opts?.perUnitWeightG === "number" &&
      opts.perUnitWeightG > 0
    ) {
      kg = (comp.count * opts.perUnitWeightG) / 1000;
    }
    if (kg != null && kg >= 0.1 && kg <= 50) perKg.push(lp / kg);
    else excluded++;
  }

  const arr = perKg.slice().sort((a, b) => a - b);
  // 환산 표본이 MIN_COMPARABLE 미만 — sources 미표시(source=null), 건수만 정직 반환.
  if (arr.length < MIN_COMPARABLE) {
    return {
      source: null,
      item_name: itemName,
      comparables: arr,
      bandUnit: "krw_per_kg",
      excludedCount: excluded,
    };
  }
  const { low, high, avg } = bandStats(arr);

  const source: PriceSource = {
    source: "네이버쇼핑",
    source_label: "인터넷 판매가",
    price_type: "online",
    low: Math.min(low, high),
    high: Math.max(low, high),
    unit: "kg",
    rank_note: `"${itemName}" 네이버쇼핑 ${arr.length}건 환산 · 판매자 등록가 · 평균 ${avg.toLocaleString("ko-KR")}원/kg`,
    ref_date: todayKstIso(),
  };
  return { source, item_name: itemName, comparables: arr, bandUnit: "krw_per_kg", excludedCount: excluded };
}

// ── S4 오케스트레이션 — sale_mode 별 소스 분기(스펙 §3). 서로 다른 단위 한 밴드 절대 금지. ──
//   weight = KAMIS+도매+네이버(전부 원/kg) / count·volume = 네이버만(원/listing).
//   비교매물 < MIN_COMPARABLE → band=null + hidden_reason. 캐시 미사용(신규 path, 기존 캐시 무영향).
async function handleSaleMode(
  saleMode: SaleMode,
  ctx: {
    itemCode: string;
    categoryCode: string;
    regday: string;
    rankCode: "04" | "05" | undefined;
    itemNameKoInput: string | null;
    unitQty?: number;
    unitLabel?: string;
    approxWeightKg?: number;
  },
): Promise<SaleModeResult> {
  const { itemCode, categoryCode, regday, rankCode, unitQty, unitLabel } = ctx;
  const bandUnit: NaverBandUnit = saleMode === "weight" ? "krw_per_kg" : "krw_per_listing";
  const specLabel =
    saleMode === "weight" ? (unitLabel ?? "kg") : `${unitQty ?? ""}${unitLabel ?? ""}`;

  // 품목 한글명 — 입력(itemNameKo) 우선, 없으면 kamis_items 조회. 못 구하면 no_taxonomy.
  let itemNameKo = ctx.itemNameKoInput;
  if (!itemNameKo) {
    try {
      const { data: itemRow } = await supabase
        .from("kamis_items")
        .select("item_name")
        .eq("item_code", itemCode)
        .maybeSingle();
      itemNameKo = (itemRow as { item_name?: string } | null)?.item_name ?? null;
    } catch (e) {
      console.error("[get-price-band] kamis_items name lookup failed:", String((e as Error).message ?? e));
    }
  }
  if (!itemNameKo) {
    return {
      sale_mode: saleMode,
      band: null,
      band_unit: bandUnit,
      spec_label: specLabel,
      source_count: 0,
      sources_used: [],
      hidden_reason: "no_taxonomy",
    };
  }

  const naverOn = Boolean(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET);

  // ── count / volume: 네이버만(KAMIS=원/포기·도매=원/kg → 단위 불일치 → 제외). ──
  if (saleMode === "count" || saleMode === "volume") {
    const naver = naverOn
      ? await fetchNaverShop(itemNameKo, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, {
          mode: saleMode,
          unitQty,
          unitLabel,
          approxWeightKg: ctx.approxWeightKg,
        })
      : null;
    const comps = naver?.comparables ?? [];
    if (comps.length < MIN_COMPARABLE) {
      return {
        sale_mode: saleMode,
        band: null,
        band_unit: "krw_per_listing",
        spec_label: specLabel,
        source_count: comps.length,
        sources_used: comps.length > 0 ? ["naver"] : [],
        hidden_reason: "insufficient_comparables",
      };
    }
    const { low, high, avg } = bandStats(comps); // fetchNaverShop 이 이미 오름차순 정렬
    return {
      sale_mode: saleMode,
      band: { low, avg, high },
      band_unit: "krw_per_listing",
      spec_label: specLabel,
      source_count: comps.length,
      sources_used: ["naver"],
      hidden_reason: null,
    };
  }

  // ── weight: KAMIS + 도매 + 네이버, 전부 원/kg 만 밴드에 합침(다른 단위 절대 미혼입). ──
  const certKey = Deno.env.get("KAMIS_CERT_KEY");
  const certId = Deno.env.get("KAMIS_CERT_ID");
  const used: string[] = [];
  const kgPoints: number[] = [];
  let naverComparableCount = 0;
  let trustedSources = 0; // KAMIS/도매 = 신뢰소스(있으면 네이버 얇아도 표시 OK).

  if (certKey && certId) {
    const kamis = await fetchKamisRetail(itemCode, categoryCode, regday, rankCode, certKey, certId);
    if (kamis) {
      used.push("kamis");
      trustedSources++;
      kgPoints.push(kamis.source.low, kamis.source.high);
    }
  }
  if (WHOLESALE_API_KEY) {
    const wholesale = await fetchWholesale(itemNameKo, regday, WHOLESALE_API_KEY);
    if (wholesale) {
      used.push("wholesale");
      trustedSources++;
      kgPoints.push(wholesale.source.low, wholesale.source.high);
    }
  }
  if (naverOn) {
    const naver = await fetchNaverShop(itemNameKo, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, {
      mode: "weight",
      unitQty,
      unitLabel,
    });
    // weight 밴드 = 원/kg 만. P5a 이후 weight 모드는 항상 환산가(krw_per_kg)지만
    //   환산 0건일 수 있어 length 가드 추가(빈 소스가 used 에 집계되지 않게).
    if (naver && naver.bandUnit === "krw_per_kg" && naver.comparables.length > 0) {
      used.push("naver");
      naverComparableCount = naver.comparables.length;
      kgPoints.push(...naver.comparables);
    }
  }

  // 게이트(스펙 3-1): 신뢰소스(KAMIS·도매) 있으면 표시 OK / 네이버 단독이면 ≥ MIN_COMPARABLE.
  const naverOnly = trustedSources === 0;
  if (kgPoints.length === 0 || (naverOnly && naverComparableCount < MIN_COMPARABLE)) {
    return {
      sale_mode: "weight",
      band: null,
      band_unit: "krw_per_kg",
      spec_label: specLabel,
      source_count: used.length,
      sources_used: used,
      hidden_reason: "insufficient_comparables",
    };
  }
  const sorted = kgPoints.slice().sort((a, b) => a - b);
  const { low, high, avg } = bandStats(sorted);
  return {
    sale_mode: "weight",
    band: { low, avg, high },
    band_unit: "krw_per_kg",
    spec_label: specLabel,
    source_count: used.length,
    sources_used: used,
    hidden_reason: null,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ status: "error", message: "POST only" }, 405);

  let body: {
    item_code?: string;
    category_code?: string;
    regday?: string;
    rank_code?: string;
    // S4 판매규격(없으면 weight = 기존 동작).
    sale_mode?: string;
    unit_qty?: number;
    unit_label?: string;
    approx_weight_kg?: number;
    itemNameKo?: string;
    // P5a 구성 파라미터(옵셔널·하위호환 — 없으면 기존 호출 그대로).
    per_unit_weight_g?: number;
    unit_count?: number;
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

  // P5a — 판매 구성 파라미터(옵셔널). per_unit_weight_g 는 개수-only 리스팅 환산에 사용,
  //   unit_count 는 에코 전용(클라 '내 판매단위' 계산 검증용). 없으면 기존 동작 그대로.
  const perUnitWeightG =
    typeof body.per_unit_weight_g === "number" &&
    Number.isFinite(body.per_unit_weight_g) &&
    body.per_unit_weight_g > 0
      ? Math.round(body.per_unit_weight_g)
      : undefined;
  const unitCount =
    typeof body.unit_count === "number" && Number.isFinite(body.unit_count) && body.unit_count > 0
      ? Math.round(body.unit_count)
      : undefined;

  // ── S4: sale_mode 명시 시에만 신규 규격인지 path. 없으면/이상값이면 아래 기존 path 그대로(하위호환). ──
  const saleMode: SaleMode | null =
    body.sale_mode === "weight" || body.sale_mode === "count" || body.sale_mode === "volume"
      ? body.sale_mode
      : null;
  if (saleMode) {
    const result = await handleSaleMode(saleMode, {
      itemCode,
      categoryCode,
      regday,
      rankCode,
      itemNameKoInput: typeof body.itemNameKo === "string" ? body.itemNameKo.trim() || null : null,
      unitQty: typeof body.unit_qty === "number" ? body.unit_qty : undefined,
      unitLabel: typeof body.unit_label === "string" ? body.unit_label : undefined,
      approxWeightKg: typeof body.approx_weight_kg === "number" ? body.approx_weight_kg : undefined,
    });
    return jsonResponse(result);
  }

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

  // 1) 캐시 조회 — 품목별 동적 cache_key. P5a: 개당중량은 온라인 환산 결과를 바꾸므로 키에 포함.
  const cacheKey =
    `kamis|${itemCode}|${COUNTRY_CODE}|${regday}` +
    (perUnitWeightG != null ? `|puw${perUnitWeightG}` : "");
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
        const payload = row.retail as {
          item_name: string | null;
          sources: PriceSource[];
          base_unit?: "kg";
          wholesale?: WholesaleBlock | null;
          online?: OnlineBlock | null;
        };
        // P5a 이전 캐시(구조화 블록 없음)는 미스 취급 → 실호출로 재적재(1 TTL 내 자연 전환).
        if (payload.base_unit === "kg") {
          return jsonResponse({
            status: payload.sources.length > 0 ? "ok" : "no_data",
            item_code: itemCode,
            item_name: payload.item_name ?? null,
            sources: payload.sources ?? [],
            cached: true,
            base_unit: "kg",
            wholesale: payload.wholesale ?? null,
            online: payload.online ?? null,
            ...(perUnitWeightG != null ? { per_unit_weight_g: perUnitWeightG } : {}),
            ...(unitCount != null ? { unit_count: unitCount } : {}),
          } satisfies PriceBandResult);
        }
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
  let wholesaleBlock: WholesaleBlock | null = null;
  if (WHOLESALE_API_KEY && itemNameKo) {
    const wholesale = await fetchWholesale(itemNameKo, regday, WHOLESALE_API_KEY);
    if (wholesale) {
      sources.push(wholesale.source);
      wholesaleBlock = wholesale.stats;
      if (!itemName) itemName = wholesale.item_name;
    }
  }

  // 2-C) 인터넷 판매가 실호출(4-C). NAVER 키 + 품목명 있을 때만.
  //   P5a: kg 환산가 통계만(OnlineBlock). MIN_COMPARABLE 미만 → status insufficient(건수 정직 보고).
  let onlineBlock: OnlineBlock | null = null;
  if (NAVER_CLIENT_ID && NAVER_CLIENT_SECRET && itemNameKo) {
    const naver = await fetchNaverShop(itemNameKo, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, {
      perUnitWeightG,
    });
    if (naver) {
      if (naver.source) {
        sources.push(naver.source);
        if (!itemName) itemName = naver.item_name;
      }
      const conv = naver.comparables; // fetchNaverShop 이 이미 오름차순 정렬
      if (conv.length >= MIN_COMPARABLE) {
        const { low, high, avg } = bandStats(conv);
        onlineBlock = {
          status: "ok",
          min: low,
          max: high,
          avg,
          converted_count: conv.length,
          excluded_count: naver.excludedCount,
          as_of: todayKstIso(),
        };
      } else {
        onlineBlock = {
          status: "insufficient",
          min: null,
          max: null,
          avg: null,
          converted_count: conv.length,
          excluded_count: naver.excludedCount,
          as_of: todayKstIso(),
        };
      }
    }
  }

  const result: PriceBandResult = {
    status: sources.length > 0 ? "ok" : "no_data",
    item_code: itemCode,
    item_name: itemName,
    sources,
    cached: false,
    base_unit: "kg",
    wholesale: wholesaleBlock,
    online: onlineBlock,
    ...(perUnitWeightG != null ? { per_unit_weight_g: perUnitWeightG } : {}),
    ...(unitCount != null ? { unit_count: unitCount } : {}),
  };

  // 3) 캐시 저장 — sources+구조화 블록을 retail jsonb 에 담음(no_data 도 캐시해 반복 호출 절약).
  try {
    await supabase.from("price_cache").upsert(
      {
        cache_key: cacheKey,
        retail: {
          item_name: itemName,
          sources,
          base_unit: "kg",
          wholesale: wholesaleBlock,
          online: onlineBlock,
        },
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
