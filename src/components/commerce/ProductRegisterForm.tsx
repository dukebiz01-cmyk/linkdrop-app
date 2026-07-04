// ProductRegisterForm — 상품 등록 폼 본체 (공용, P1 추출: partner.products.new 에서 이동).
//   순수 리팩터 — 동작·UI 변경 0. 라우터 데이터 결합 없음(loader/useSearch/useParams 미사용).
//   절단면: (a) createFileRoute/head 는 라우트 잔류 (b) 헤더 back-nav(Link)는 페이지 래퍼(라우트)에 잔류 →
//     컴포넌트는 router 훅 0. onNavigate 는 향후 임베드 호스트용 예약 옵션 prop.
//   (c) 저장은 onSubmit(payload) props 주입 — /api/drops insert 로직은 라우트가 그대로 소유.
//   (d) getSupabase 는 lib(비-라우터)라 컴포넌트 내부 유지(KAMIS 조회·get-price-band·업로드·세션).
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ImagePlus,
  Package,
  Loader2,
  CheckCircle2,
  Sprout,
  Factory,
  Box,
  CalendarDays,
  Hash,
  Tags,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import {
  ProductCopyEditor,
  EMPTY_PRODUCT_COPY,
  type ProductCopyValue,
} from "@/components/create/ProductCopyEditor";
import { PriceBandAdvisor, type PriceBandResult } from "@/components/commerce/PriceBandAdvisor";

const MAX_WIDTH = 1200;
const BUCKET = "product-images";

// CAT-1 카테고리 3분기 — 상품정보제공고시(전자상거래법 13조④) 유형 분기의 최소선.
//   fresh=신선식품(KAMIS 시세·구성), processed=가공식품(내용량·소비기한), goods=공산품·잡화(고지만).
export type ProductCategory = "fresh" | "processed" | "goods";

const CATEGORY_OPTIONS: Array<{ key: ProductCategory; label: string; Icon: typeof Sprout }> = [
  { key: "fresh", label: "신선식품", Icon: Sprout },
  { key: "processed", label: "가공식품", Icon: Factory },
  { key: "goods", label: "공산품·잡화", Icon: Box },
];

// KAMIS 품목 분류 — 라이브 DB kamis_categories(6행)/kamis_items(130행). types.ts 미반영이라 캐스트.
type KamisCategory = { category_code: string; category_name: string };
type KamisItem = { item_code: string; item_name: string };
// CAT-2 — 전 부류 병합 목록 행(검색용). 기존 2단 로딩 타입(KamisItem)은 폴백이 그대로 사용.
type KamisItemFull = KamisItem & { category_code: string };

// CAT-2 검색 정규화 — 공백·괄호문자 제거 + 소문자. §0: 추천(fuzzy)용일 뿐,
//   확정은 후보 탭/Enter = 정확 item_code 선택만. 시세 조회는 확정 코드로만 나간다.
function normalizeItemText(s: string): string {
  return s.toLowerCase().replace(/[\s()（）]/g, "");
}

// CAT-2 동의어 사전 — 부분일치로 못 잡는 이명·사투리·품종·표기변형만 등록(확장 가능 구조).
//   값 = kamis_items.item_name 정확값. 부분일치로 잡히는 파생어(찰옥수수·애호박 등)는 등록 불필요.
const ITEM_SYNONYMS: Record<string, string> = {
  "강냉이": "옥수수",
  "스위트콘": "옥수수",
  "고구마순": "고구마",
  "무우": "무",
  "동태": "명태",
  "코다리": "명태",
  "키위": "참다래",
  "밀감": "감귤",
  "부사": "사과",
  "샤인머스캣": "샤인머스켓",
};

/** onSubmit 에 넘기는 저장 payload — 기존 /api/drops body 필드 그대로(신규 필드 추가 금지). */
export interface ProductRegisterPayload {
  self_upload: boolean;
  image_url: string;
  name: string | null;
  price_krw: number;
  headline: string;
  selling_points: string[];
  is_fresh: boolean;
  harvest_date: string | null;
  stock_limit: number | null;
  price_band_enabled: boolean;
  kamis_item_code?: string;
  blocks: Array<{ block_kind: string; block_data: Record<string, unknown>; position: number }>;
}

/** onSubmit 반환 — 생성된 드롭의 공유 정보. */
export interface ProductRegisterResult {
  shareUuid: string;
  shareUrl: string;
}

export interface ProductRegisterFormProps {
  /** 저장 핸들러(라우트가 /api/drops insert 로직 소유). payload → {shareUuid, shareUrl} 반환 또는 throw. */
  onSubmit: (payload: ProductRegisterPayload) => Promise<ProductRegisterResult>;
  /** 예약 옵션 — 임베드 호스트가 폼 내 네비를 필요로 할 때 주입(현 폼 본체는 미사용). */
  onNavigate?: (to: string) => void;
  /** P2 임베드 모드(스튜디오 등) — 폼 자체 카드 크롬·"새 상품" 헤더 숨김 + 완료 섹션(단축주소·
   *  카드 보기·공유하기)을 한 줄 상태로 대체(P2.1 S20: 단축주소는 호스트 발행 단일 경로).
   *  기본 false = 기존 동작. */
  embedded?: boolean;
}

// File → 가로 최대 1200px 비율유지 → image/jpeg 0.8 Blob. 캔버스 압축은 브라우저 전용.
async function resizeToJpegBlob(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    el.src = dataUrl;
  });

  const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 처리에 실패했어요.");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) throw new Error("이미지 압축에 실패했어요.");
  return blob;
}

export function ProductRegisterForm({ onSubmit, embedded = false }: ProductRegisterFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  // CAT-1 카테고리 3분기 — 기본 신선. 하위호환: 기존 is_fresh 저장값은 true→fresh / false→processed
  //   에 대응(goods 는 신규 — 구 데이터엔 없음). payload 의 is_fresh 는 category==="fresh" 파생 유지.
  const [category, setCategory] = useState<ProductCategory>("fresh");
  const isFresh = category === "fresh";
  const [harvestDate, setHarvestDate] = useState("");
  const [stockLimit, setStockLimit] = useState("");
  // CAT-1 가공 — 내용량(숫자+단위 g/ml/개입)·소비기한. 내용량은 폼 상태만(저장은 후속 슬라이스),
  //   소비기한만 product 블록 jsonb(expiry_date)로 저장.
  const [contentAmount, setContentAmount] = useState("");
  const [contentUnit, setContentUnit] = useState("g");
  const [expiryDate, setExpiryDate] = useState("");
  // CAT-1 고지 — 원산지(전 카테고리 필수, 상품정보제공고시). 빈칸 제출 시 인라인 안내 + 차단.
  const [origin, setOrigin] = useState("");
  const [originError, setOriginError] = useState(false);
  // KAMIS 품목 2단(부류→품목) — 시세(STEP4)·제철(STEP5) 연동 기반. 선택 사항(미선택 허용).
  const [kamisCategoryCode, setKamisCategoryCode] = useState("");
  const [kamisItemCode, setKamisItemCode] = useState("");
  const [kamisCategories, setKamisCategories] = useState<KamisCategory[]>([]);
  const [kamisItems, setKamisItems] = useState<KamisItem[]>([]);
  // CAT-2 품목 자동 매칭 — 전 부류 병합 목록(1회 로드) + 검색어/드롭다운/키보드 상태.
  const [allKamisItems, setAllKamisItems] = useState<KamisItemFull[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemActiveIdx, setItemActiveIdx] = useState(0);
  // STEP4-A — KAMIS 소매 시세 어드바이저(농가 가격 참고용). 품목 선택 시 get-price-band 조회.
  const [priceBand, setPriceBand] = useState<PriceBandResult | null>(null);
  const [priceBandLoading, setPriceBandLoading] = useState(false);
  // P5b 판매 구성(단위 헌법) — 포장형태×입수×총중량. 시세 환산(per_unit_weight_g) 전용 폼 상태.
  //   저장 payload 미포함 — blocks/스키마 신규 컬럼 금지(저장 확장은 별도 슬라이스).
  const [packType, setPackType] = useState("박스");
  const [packCount, setPackCount] = useState("");
  const [packWeightKg, setPackWeightKg] = useState("");
  const packCountNum = Math.floor(Number(packCount));
  const packWeightNum = Number(packWeightKg);
  const compositionValid =
    Number.isFinite(packCountNum) &&
    packCountNum >= 1 &&
    Number.isFinite(packWeightNum) &&
    packWeightNum > 0;
  // 개당 중량(g) — 총중량÷입수. get-price-band per_unit_weight_g 로 전달 + 자동 표시.
  const perUnitWeightG = compositionValid
    ? Math.round((packWeightNum * 1000) / packCountNum)
    : null;
  // 정합성 가드 — 개당 10g 미만 / 5kg 초과면 확인 배너(차단 아닌 확인).
  const compositionSuspect =
    perUnitWeightG != null && (perUnitWeightG < 10 || perUnitWeightG > 5000);
  // 시세 조회에 실을 입수 — 구성이 완성됐을 때만(미완성 타이핑 중 재조회 방지용 dep).
  const unitCountForQuery = perUnitWeightG != null ? packCountNum : null;
  // 나-1 — 상품 카피(headline/selling_points). 비우면 저장 시 키 생략(회귀 0).
  const [copy, setCopy] = useState<ProductCopyValue>(EMPTY_PRODUCT_COPY);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 저장 성공 결과 — 생성된 드롭의 공유 URL(drop.how/{code}) + share_uuid(/d 미리보기용).
  const [result, setResult] = useState<{ shareUrl: string; shareUuid: string } | null>(null);

  // 부류 6개 1회 로드 (register.tsx business_categories 패턴). types.ts 미반영 → as never 캐스트.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabase()
        .from("kamis_categories" as never)
        .select("category_code, category_name")
        .order("sort_order");
      if (!cancelled) setKamisCategories((data as unknown as KamisCategory[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CAT-2 — 전 부류 품목 1회 병합 로드(약 130행, 클라 자체 필터로 충분 — 라이브러리 금지).
  //   실패해도 아래 기존 2단 로딩(직접 찾기 폴백)이 살아 있어 무해.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabase()
        .from("kamis_items" as never)
        .select("item_code, item_name, category_code")
        .order("sort_order");
      if (!cancelled) setAllKamisItems((data as unknown as KamisItemFull[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 부류 선택 시 해당 품목 로드 (register.tsx 149-166 패턴). 부류 비면 품목 비움.
  useEffect(() => {
    if (!kamisCategoryCode) {
      setKamisItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabase()
        .from("kamis_items" as never)
        .select("item_code, item_name")
        .eq("category_code", kamisCategoryCode)
        .order("sort_order");
      if (!cancelled) setKamisItems((data as unknown as KamisItem[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [kamisCategoryCode]);

  // CAT-2 부류명 표시 — 후보 드롭 "품목명 · 부류명" 용.
  const categoryNameOf = (code: string) =>
    kamisCategories.find((c) => c.category_code === code)?.category_name ?? "";

  // CAT-2 후보 매칭 — 정확 일치 > 동의어 > 품목명이 검색어 포함 > 검색어가 품목명 포함(2자+).
  //   단문자 품목(무·파·갓 등)의 역포함 노이즈는 2자+ 가드로 차단. 최대 7건.
  const itemCandidates = useMemo(() => {
    const q = normalizeItemText(itemQuery);
    if (!q || allKamisItems.length === 0) return [];
    const synTargets = new Set<string>();
    for (const [key, target] of Object.entries(ITEM_SYNONYMS)) {
      if (q.includes(normalizeItemText(key))) synTargets.add(normalizeItemText(target));
    }
    const scored: Array<{ it: KamisItemFull; score: number }> = [];
    for (const it of allKamisItems) {
      const n = normalizeItemText(it.item_name);
      let score = -1;
      if (n === q) score = 0;
      else if (synTargets.has(n)) score = 1;
      else if (n.includes(q)) score = 2 + n.length;
      else if (n.length >= 2 && q.includes(n)) score = 100 + (q.length - n.length);
      if (score >= 0) scored.push({ it, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 7).map((s) => s.it);
  }, [itemQuery, allKamisItems]);

  // CAT-2 상품명 선제 제안 — 상품명에서 품목이 읽히면 칩 1개 제안. 자동 확정 금지(§0:
  //   확정은 사용자의 [적용] 탭). 가장 긴 품목명 일치 우선(방울토마토 > 토마토), 폴백 동의어.
  const nameSuggestion = useMemo(() => {
    const q = normalizeItemText(name);
    if (!q || allKamisItems.length === 0) return null;
    let best: KamisItemFull | null = null;
    let bestLen = 0;
    for (const it of allKamisItems) {
      const n = normalizeItemText(it.item_name);
      if (n.length >= 2 && q.includes(n) && n.length > bestLen) {
        best = it;
        bestLen = n.length;
      }
    }
    if (!best) {
      for (const [key, target] of Object.entries(ITEM_SYNONYMS)) {
        if (q.includes(normalizeItemText(key))) {
          best =
            allKamisItems.find(
              (it) => normalizeItemText(it.item_name) === normalizeItemText(target),
            ) ?? null;
          if (best) break;
        }
      }
    }
    return best && best.item_code !== kamisItemCode ? best : null;
  }, [name, allKamisItems, kamisItemCode]);

  // CAT-2 후보 확정 — 검색 드롭·제안 칩 공용. 정확 item_code+category_code 동시 확정(§0)
  //   → 기존 시세 파이프라인(아래 effect)이 확정 코드로만 발화.
  function pickKamisItem(it: KamisItemFull) {
    setKamisCategoryCode(it.category_code);
    setKamisItemCode(it.item_code);
    setItemQuery(it.item_name);
    setItemSearchOpen(false);
    setItemActiveIdx(0);
  }

  // 품목 선택 시 KAMIS 소매 시세 조회 (미선택이면 호출 안 함 — 불필요 호출 방지).
  //   detach 주의: supabase.functions.invoke 를 메서드로 직접 호출(this 유지).
  //   P5b — 판매 구성(per_unit_weight_g/unit_count) 동반 전달 + 구성 타이핑 연타 방지 debounce(350ms).
  useEffect(() => {
    // CAT-1 — 신선 외 카테고리는 시세 조회·표시 자체를 중단(어설픈 표시 금지, §0).
    if (!isFresh || !kamisItemCode || !kamisCategoryCode) {
      setPriceBand(null);
      setPriceBandLoading(false);
      return;
    }
    let cancelled = false;
    setPriceBandLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const fail: PriceBandResult = {
          status: "error",
          item_code: kamisItemCode,
          item_name: null,
          sources: [],
          cached: false,
        };
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase.functions.invoke("get-price-band", {
            body: {
              item_code: kamisItemCode,
              category_code: kamisCategoryCode,
              // 단위 헌법 — 구성 입력 시 개수-only 리스팅도 개당중량으로 kg 환산(P5a 파라미터).
              ...(perUnitWeightG != null && unitCountForQuery != null
                ? { per_unit_weight_g: perUnitWeightG, unit_count: unitCountForQuery }
                : {}),
            },
          });
          if (cancelled) return;
          setPriceBand(error || !data ? fail : (data as PriceBandResult));
        } catch {
          if (!cancelled) setPriceBand(fail);
        } finally {
          if (!cancelled) setPriceBandLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isFresh, kamisItemCode, kamisCategoryCode, perUnitWeightG, unitCountForQuery]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadedUrl(null);
    setResult(null);
    setUploading(true);
    try {
      const supabase = getSupabase();
      // 세션 명시 hydrate — anon 으로 나가면 RLS(auth.uid() NULL) 차단되므로 먼저 확인.
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        setUploadError("로그인이 필요해요.");
        return;
      }

      const blob = await resizeToJpegBlob(file);
      // 경로 첫 segment = userId → RLS INSERT(S1) 통과 조건.
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) {
        console.error("[ProductRegisterForm] upload failed:", upErr);
        setUploadError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      setPreviewUrl(publicUrl);
      setUploadedUrl(publicUrl);
      toast.success("사진을 업로드했어요.");
    } catch (err) {
      console.error("[ProductRegisterForm] unexpected:", err);
      setUploadError(err instanceof Error ? err.message : "사진 처리 중 문제가 생겼어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!uploadedUrl) {
      toast.error("상품 사진을 먼저 업로드해 주세요.");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("가격을 올바르게 입력해 주세요.");
      return;
    }
    // CAT-1 — 원산지 필수(상품정보제공고시). 빈칸이면 인라인 안내 + 제출 차단.
    const originTrimmed = origin.trim();
    if (!originTrimmed) {
      setOriginError(true);
      return;
    }
    const productName = name.trim() || null;
    setSubmitting(true);
    try {
      // S2b — 자체업로드 분기로 저장(payload → onSubmit, self_upload:true). insert 로직은 라우트 소유.
      //   가격/이름은 렌더용 product 블록으로도 운반(create-wizard 구매 흐름과 동일 형식).
      const payload: ProductRegisterPayload = {
        self_upload: true,
        image_url: uploadedUrl,
        name: productName,
        price_krw: priceNum,
        // 나-1 — 카피 동봉(서버가 메인 product 블록 block_data 에 머지). 빈 값은 서버에서 생략.
        headline: copy.headline.trim(),
        selling_points: copy.sellingPoints.map((s) => s.trim()).filter(Boolean),
        // 신선 원물 — CAT-1: is_fresh = (category==="fresh") 파생 유지(하위호환).
        //   processed/goods 는 false + 신선 키 생략(null) — 기존 가공 저장값과 동일 형태.
        is_fresh: isFresh,
        harvest_date: isFresh && harvestDate ? harvestDate : null,
        stock_limit: isFresh && Number(stockLimit) >= 1 ? Math.floor(Number(stockLimit)) : null,
        // §0 — 손님 카드 시세 노출 영구 금지(표시광고법) → 항상 false.
        price_band_enabled: false,
        // KAMIS 품목코드 — 신선 + 선택했을 때만. 미선택이면 키 생략(ADDITIVE, 기존 등록 무영향).
        ...(isFresh && kamisItemCode ? { kamis_item_code: kamisItemCode } : {}),
        blocks: [
          {
            block_kind: "product",
            block_data: {
              name: productName,
              price_krw: priceNum,
              // CAT-1 — 카테고리·고지(상품정보제공고시 최소선). jsonb 키 추가만(스키마 무변경).
              //   서버(/api/drops)는 block_data 를 스프레드 보존 머지하므로 그대로 저장된다.
              category,
              origin: originTrimmed,
              ...(category === "processed" && expiryDate ? { expiry_date: expiryDate } : {}),
            },
            position: 0,
          },
        ],
      };
      const r = await onSubmit(payload);
      setResult({ shareUuid: r.shareUuid, shareUrl: r.shareUrl });
      toast.success("상품 카드를 만들었어요.");
    } catch (err) {
      console.error("[ProductRegisterForm] submit failed:", err);
      toast.error("상품 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      toast.success("공유 링크를 복사했어요.");
    } catch {
      toast.error("복사에 실패했어요.");
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={
          embedded
            ? "space-y-4"
            : "rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4"
        }
      >
        {embedded ? null : (
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <Package className="size-4 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <h2 className="text-sm font-bold text-[#0F172A]">새 상품</h2>
          </div>
        )}

        {/* 사진 (필수) */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-[#0F172A]">상품 사진</span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFAFA] px-4 py-8 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                올리는 중…
              </>
            ) : (
              <>
                <ImagePlus className="size-5" strokeWidth={2} />
                {previewUrl ? "다른 사진으로 바꾸기" : "사진 선택"}
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
              <img
                src={previewUrl}
                alt="업로드한 상품 사진 미리보기"
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : null}

          {uploadedUrl ? (
            <p className="break-all text-[11px] text-[#15803D]">업로드됨: {uploadedUrl}</p>
          ) : null}

          {uploadError ? <p className="text-[11px] text-[#EF4444]">{uploadError}</p> : null}
        </div>

        {/* 상품명 (선택) */}
        <div className="space-y-2">
          <label htmlFor="pd-name" className="block text-xs font-semibold text-[#0F172A]">
            상품명 <span className="font-medium text-[#94A3B8]">(선택)</span>
          </label>
          <input
            id="pd-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 해남 꿀고구마 5kg"
            maxLength={80}
            className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
          />
        </div>

        {/* CAT-1 카테고리 3분기 — 신선식품/가공식품/공산품·잡화(상품정보제공고시 유형 분기).
            fresh=KAMIS·구성·시세(P5d 그대로) / processed=내용량·소비기한 / goods=고지만. */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
          <span className="block text-xs font-semibold tracking-ko text-text-strong">
            상품 유형
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={category === key}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold tracking-ko transition-colors ${
                  category === key
                    ? "border-action bg-bg text-text-strong"
                    : "border-border bg-bg text-text-muted hover:border-text-muted"
                }`}
              >
                <Icon className="size-4" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          {isFresh ? (
            <div className="space-y-3 pt-1">
              {/* 수확/발송 예정일 */}
              <label htmlFor="pd-harvest" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <CalendarDays className="size-3.5" strokeWidth={2} />
                  수확·발송 예정일 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <input
                  id="pd-harvest"
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                />
              </label>

              {/* 한정 수량 */}
              <label htmlFor="pd-stock" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <Hash className="size-3.5" strokeWidth={2} />
                  한정 수량 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <input
                  id="pd-stock"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={stockLimit}
                  onChange={(e) => setStockLimit(e.target.value)}
                  placeholder="예: 30"
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                />
              </label>

              {/* §0 — 손님 카드 시세 비교 노출은 영구 금지(표시광고법). 생산자 참고용
                  PriceBandAdvisor(아래 품목 선택 시)만 유지. '손님 노출 토글'은 제거. */}

              {/* 품목 분류 — CAT-2: 검색 자동 매칭이 기본, 부류→품목 2단은 "직접 찾기" 폴백.
                  선택 사항(미선택 허용). 시세·제철 연동 기반. */}
              <div className="space-y-2 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <Tags className="size-3.5" strokeWidth={2} />
                  품목 분류{" "}
                  <span className="font-medium text-text-subtle">(선택 · 시세·제철 연동용)</span>
                </span>

                {/* CAT-2 품목 검색 — fuzzy 추천, 확정은 후보 선택(정확 item_code)만(§0). */}
                <div className="relative">
                  <input
                    type="text"
                    role="combobox"
                    aria-label="품목 검색"
                    aria-expanded={itemSearchOpen && itemCandidates.length > 0}
                    aria-controls="pd-item-listbox"
                    value={itemQuery}
                    onChange={(e) => {
                      setItemQuery(e.target.value);
                      setItemSearchOpen(true);
                      setItemActiveIdx(0);
                    }}
                    onFocus={() => {
                      if (itemQuery.trim()) setItemSearchOpen(true);
                    }}
                    onBlur={() => setItemSearchOpen(false)}
                    onKeyDown={(e) => {
                      if (!itemSearchOpen || itemCandidates.length === 0) {
                        if (e.key === "Enter") e.preventDefault(); // 검색 중 실수 제출 방지
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setItemActiveIdx((i) => Math.min(i + 1, itemCandidates.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setItemActiveIdx((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        pickKamisItem(itemCandidates[itemActiveIdx]);
                      } else if (e.key === "Escape") {
                        setItemSearchOpen(false);
                      }
                    }}
                    placeholder="품목 이름을 입력하세요 (예: 옥수수)"
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                  {itemSearchOpen && itemCandidates.length > 0 ? (
                    <ul
                      id="pd-item-listbox"
                      role="listbox"
                      aria-label="품목 후보"
                      className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-bg shadow-soft"
                    >
                      {itemCandidates.map((c, i) => (
                        <li key={c.item_code} role="option" aria-selected={i === itemActiveIdx}>
                          <button
                            type="button"
                            // onMouseDown + preventDefault — input blur 보다 먼저 확정(클릭 유실 방지).
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickKamisItem(c);
                            }}
                            onMouseEnter={() => setItemActiveIdx(i)}
                            className={`flex w-full min-h-[44px] items-center px-3 text-sm tracking-ko ${
                              i === itemActiveIdx ? "bg-surface" : "bg-bg"
                            }`}
                          >
                            <span className="font-semibold text-text-strong">{c.item_name}</span>
                            <span className="ml-1 text-[11px] font-medium text-text-subtle">
                              · {categoryNameOf(c.category_code)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {/* CAT-2 상품명 선제 제안 — 자동 확정 금지(§0): [적용] 탭이 유일한 확정 행위. */}
                {nameSuggestion ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="text-[12px] font-medium tracking-ko text-text-muted">
                      혹시 &lsquo;{nameSuggestion.item_name}&rsquo;인가요?
                    </span>
                    <button
                      type="button"
                      onClick={() => pickKamisItem(nameSuggestion)}
                      className="shrink-0 min-h-[44px] min-w-[44px] rounded-lg px-3 text-xs font-bold tracking-ko text-accent hover:bg-bg"
                    >
                      적용
                    </button>
                  </div>
                ) : null}

                {/* CAT-2 직접 찾기 폴백 — 기존 부류→품목 2단 select 보존(자동 매칭 실패 탈출구).
                    같은 state(kamisCategoryCode/kamisItemCode)를 쓰므로 검색 선택과 상호 동기. */}
                <details>
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-[12px] font-semibold tracking-ko text-text-muted hover:text-text-strong">
                    직접 찾기 (부류 → 품목 선택)
                  </summary>
                  <div className="space-y-2 pt-1">
                    <select
                      aria-label="부류 선택"
                      value={kamisCategoryCode}
                      onChange={(e) => {
                        setKamisCategoryCode(e.target.value);
                        setKamisItemCode(""); // 부류 바뀌면 품목 선택 초기화(stale 방지)
                        setItemQuery(""); // CAT-2 상호 동기 — 선택 해제 시 검색창 표시도 비움
                      }}
                      className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                    >
                      <option value="">부류 선택</option>
                      {kamisCategories.map((c) => (
                        <option key={c.category_code} value={c.category_code}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                    {kamisCategoryCode && kamisItems.length > 0 ? (
                      <select
                        aria-label="품목 선택"
                        value={kamisItemCode}
                        onChange={(e) => {
                          setKamisItemCode(e.target.value);
                          // CAT-2 상호 동기 — 폴백에서 고르면 검색창 표시도 품목명으로 일치.
                          const picked = kamisItems.find((i) => i.item_code === e.target.value);
                          setItemQuery(picked?.item_name ?? "");
                        }}
                        className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                      >
                        <option value="">품목 선택</option>
                        {kamisItems.map((it) => (
                          <option key={it.item_code} value={it.item_code}>
                            {it.item_name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </details>

                {/* P5b 판매 구성(단위 헌법) — 포장형태×입수×총중량 → 개당 중량 자동 표시.
                    시세 환산 전용(per_unit_weight_g 전달) — 저장 payload 미포함. */}
                {kamisItemCode ? (
                  <div className="space-y-2 pt-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                      <Package className="size-3.5" strokeWidth={2} />
                      판매 구성{" "}
                      <span className="font-medium text-text-subtle">(선택 · 시세 환산용)</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        aria-label="포장형태"
                        value={packType}
                        onChange={(e) => setPackType(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                      >
                        {["박스", "봉", "망", "기타"].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="입수(개)"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={packCount}
                        onChange={(e) => setPackCount(e.target.value)}
                        placeholder="예: 30"
                        className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                      />
                      <input
                        aria-label="총중량(kg)"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        value={packWeightKg}
                        onChange={(e) => setPackWeightKg(e.target.value)}
                        placeholder="예: 10"
                        className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                      />
                    </div>
                    {perUnitWeightG != null ? (
                      <p className="text-[11px] font-medium tabular-nums tracking-ko text-text-muted">
                        개당 약 {perUnitWeightG.toLocaleString("ko-KR")}g ({packCountNum}개 ·{" "}
                        {packWeightNum}kg)
                      </p>
                    ) : null}
                    {/* 정합성 가드 — 차단 아닌 확인(개당 10g 미만/5kg 초과). */}
                    {compositionSuspect ? (
                      <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
                        <p className="text-[11px] font-medium leading-relaxed tracking-ko text-[#92400E]">
                          입력값을 확인해 주세요: {packCountNum}개에 {packWeightNum}kg이 맞습니까?
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* KAMIS 소매 시세 어드바이저 — 품목 선택 시만. 농가 가격 참고용(§0). */}
                {kamisItemCode ? (
                  <PriceBandAdvisor
                    priceBand={priceBand}
                    loading={priceBandLoading}
                    composition={
                      compositionValid
                        ? { packType, unitCount: packCountNum, totalKg: packWeightNum }
                        : null
                    }
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {/* CAT-1 processed — 내용량(숫자+단위 g/ml/개입) + 소비기한. KAMIS·구성 4칸 숨김,
              시세 어드바이저 미렌더(가공 시세 소스는 후속 슬라이스 — 어설픈 표시 금지). */}
          {category === "processed" ? (
            <div className="space-y-3 pt-1">
              <label htmlFor="pd-content" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <Hash className="size-3.5" strokeWidth={2} />
                  내용량 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
                  <input
                    id="pd-content"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={contentAmount}
                    onChange={(e) => setContentAmount(e.target.value)}
                    placeholder="예: 500"
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm tabular-nums text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
                  />
                  <select
                    aria-label="내용량 단위"
                    value={contentUnit}
                    onChange={(e) => setContentUnit(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                  >
                    {["g", "ml", "개입"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label htmlFor="pd-expiry" className="block">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                  <CalendarDays className="size-3.5" strokeWidth={2} />
                  소비기한·유통기한 <span className="font-medium text-text-subtle">(선택)</span>
                </span>
                <input
                  id="pd-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-bg px-3 text-sm text-text-strong focus:border-text-strong focus:outline-none"
                />
              </label>
            </div>
          ) : null}

          {/* CAT-1 goods — KAMIS·구성·시세 전부 숨김(§0: 브랜드 상품 비교는 정직하게 미제공). */}
          {category === "goods" ? (
            <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
              공산품·잡화는 시세 비교를 제공하지 않아요. 사진·가격·홍보 문구와 아래 고지만
              등록합니다.
            </p>
          ) : null}

          {/* CAT-1 고지 — 원산지(전 카테고리 노출·필수, 상품정보제공고시 최소선).
              goods 는 "상세페이지 참조" 프리셋 버튼 제공. 빈칸 제출 시 인라인 안내 + 차단. */}
          <label htmlFor="pd-origin" className="block pt-1">
            <span className="text-xs font-semibold tracking-ko text-text-strong">
              원산지{" "}
              <span className="font-medium text-text-subtle">(필수 · 상품정보제공고시)</span>
            </span>
            <div className="mt-2 flex gap-2">
              <input
                id="pd-origin"
                type="text"
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  if (originError) setOriginError(false);
                }}
                placeholder="예: 국산(충북 괴산)"
                maxLength={80}
                className={`flex-1 min-w-0 min-h-[44px] rounded-xl border bg-bg px-3 text-sm text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none ${
                  originError ? "border-[#EF4444]" : "border-border"
                }`}
              />
              {category === "goods" ? (
                <button
                  type="button"
                  onClick={() => {
                    setOrigin("상세페이지 참조");
                    setOriginError(false);
                  }}
                  className="shrink-0 min-h-[44px] rounded-xl border border-border bg-bg px-3 text-xs font-semibold tracking-ko text-text-muted hover:border-text-muted"
                >
                  상세페이지 참조
                </button>
              ) : null}
            </div>
            {originError ? (
              <p className="mt-2 text-[11px] font-medium tracking-ko text-[#EF4444]">
                원산지를 입력해 주세요 — 상품정보제공고시 필수 항목이에요.
              </p>
            ) : null}
          </label>
        </div>

        {/* 가격 (필수) — P1.5: 품목→시세 확인 후 입력(순서 유도, 강제 아님). */}
        <div className="space-y-2">
          <label htmlFor="pd-price" className="block text-xs font-semibold text-[#0F172A]">
            가격
          </label>
          {/* P1.5 — 시세 데이터(status ok) 있을 때만 참고 문구. 미조회·데이터 없음이면 숨김. */}
          {priceBand?.status === "ok" ? (
            <p className="text-[11px] font-medium tracking-ko text-text-subtle">
              위 시세를 참고해 판매 가격을 정하세요
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              id="pd-price"
              type="number"
              inputMode="numeric"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="19900"
              className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm tabular-nums text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
              required
            />
            <span className="shrink-0 text-sm font-semibold text-[#64748B]">원</span>
          </div>
        </div>

        {/* 나-1 — 홍보 문구(선택). 상품명·가격·메모 기반 AI 카피 + 수동 수정. */}
        <ProductCopyEditor
          productName={name}
          priceKrw={Number.isFinite(Number(price)) && Number(price) > 0 ? Number(price) : null}
          imageUrl={uploadedUrl}
          value={copy}
          onChange={setCopy}
        />

        <button
          type="submit"
          disabled={uploading || submitting || !uploadedUrl}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <CheckCircle2 className="size-4" strokeWidth={2} />
          )}
          {submitting ? "등록 중…" : "상품 등록"}
        </button>
      </form>

      {/* 등록 완료 — P2.1(S20) 컨펌 단일화: embedded 는 완료 섹션(단축주소·공유하기) 전면 미렌더.
          단축주소는 스튜디오 발행 단일 경로만 — 여기선 한 줄 상태 표시(입력값 보존, 수정 재제출 가능).
          비임베드(파트너 라우트)는 기존 완료 섹션 그대로. */}
      {result ? (
        embedded ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
            <CheckCircle2 className="size-4" strokeWidth={2} />
            상품이 카드에 붙었어요
          </p>
        ) : (
          <section className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#059669]" strokeWidth={2} />
              <h2 className="text-sm font-bold text-[#065F46]">상품 카드를 만들었어요</h2>
            </div>
            <p className="mt-2 break-all text-xs text-[#047857]">{result.shareUrl}</p>
            <div className="mt-3 flex gap-2">
              <a
                href={`/d/${result.shareUuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white"
              >
                카드 보기
              </a>
              <button
                type="button"
                onClick={handleShare}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#0E4D42] bg-white px-4 text-sm font-bold text-[#0E4D42] hover:bg-[#E1F5EE]"
              >
                공유하기
              </button>
            </div>
          </section>
        )
      ) : null}
    </>
  );
}
