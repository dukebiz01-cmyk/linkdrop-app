import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ImagePlus,
  Package,
  Loader2,
  CheckCircle2,
  Sprout,
  Factory,
  CalendarDays,
  Hash,
  TrendingUp,
  Tags,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";
import {
  ProductCopyEditor,
  EMPTY_PRODUCT_COPY,
  type ProductCopyValue,
} from "@/components/create/ProductCopyEditor";

// S2 — 매장관리 상품등록(프론트만). 사진을 'product-images' 버킷({uid}/...)에 업로드해
//   public URL 까지 확보하는 것을 증명한다. content_sources/drops 저장 연결은 다음 슬라이스.
//   RLS(S1, v7.5): INSERT 는 경로 첫 segment = auth.uid() 여야 통과 → 업로드 경로를
//   반드시 `${userId}/...` 로 만든다.

export const Route = createFileRoute("/_partner/partner/products/new")({
  head: () => ({ meta: [{ title: "상품 등록 — LinkDrop" }] }),
  component: ProductNewPage,
});

const MAX_WIDTH = 1200;
const BUCKET = "product-images";

// KAMIS 품목 분류 — 라이브 DB kamis_categories(6행)/kamis_items(130행). types.ts 미반영이라 캐스트.
type KamisCategory = { category_code: string; category_name: string };
type KamisItem = { item_code: string; item_name: string };

// get-price-band 응답(STEP4-A). sources 배열 = 다중소스(KAMIS 소매 + 추후 도매/인터넷).
type PriceSource = {
  source: string;
  source_label: string;
  price_type: string;
  low: number;
  high: number;
  unit: string;
  rank_note: string;
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

function fmtWon(n: number): string {
  return n.toLocaleString("ko-KR");
}
// "2026-06-23" → "06/23"
function fmtRefDate(iso: string): string {
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return m && d ? `${m}/${d}` : iso;
}

// KAMIS 소매 시세 어드바이저 — 농가 가격 결정 참고용(§0: 추천/단정 아님, 농가 결정).
//   다중소스 대비 sources.map(4-B 도매·4-C 인터넷 추가되면 자동으로 여러 줄).
function PriceBandAdvisor({
  priceBand,
  loading,
}: {
  priceBand: PriceBandResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-sm font-medium tracking-ko text-text-muted">시세 조회 중…</p>
      </div>
    );
  }
  if (!priceBand) return null;
  // unconfigured/error → 작은 안내만(등록 막지 않음).
  if (priceBand.status === "unconfigured" || priceBand.status === "error") {
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[12px] font-medium tracking-ko text-text-subtle">
          시세 정보를 불러올 수 없어요.
        </p>
      </div>
    );
  }
  // no_data(옥수수 등 미조사) → 담담한 회색 안내.
  if (priceBand.status === "no_data" || priceBand.sources.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <p className="text-[13px] font-medium leading-relaxed tracking-ko text-text-muted">
          이 품목은 KAMIS 시세 정보가 없어요 (시세 미조사 품목).
        </p>
      </div>
    );
  }
  // ok — 소스별 렌더.
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="size-4 text-text-strong" strokeWidth={2} />
        <span className="text-xs font-semibold tracking-ko text-text-strong">시세 참고 정보</span>
      </div>
      <ul className="space-y-1.5">
        {priceBand.sources.map((s) => (
          <li
            key={`${s.source}-${s.price_type}`}
            className="text-sm leading-relaxed tracking-ko text-text-strong"
          >
            <span className="font-semibold">{s.source_label}</span>{" "}
            <span className="font-bold tabular-nums">
              {s.low === s.high ? fmtWon(s.low) : `${fmtWon(s.low)}~${fmtWon(s.high)}`}원
            </span>
            {s.unit ? <span className="text-text-muted"> / {s.unit}</span> : null}
            {s.rank_note ? <span className="text-text-subtle"> ({s.rank_note})</span> : null}
            <span className="text-text-subtle"> · {fmtRefDate(s.ref_date)} 기준</span>
          </li>
        ))}
      </ul>
      {/* §0 — 우리가 가격 추천/단정 아님. 농가가 직접 결정. */}
      <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
        ※ 도매시장 소매 기준 참고가예요. 판매가는 직접 정하세요.
      </p>
    </div>
  );
}

function ProductNewPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  // 신선 원물(농가 선주문) — 기본 신선. 가공 선택 시 신선 입력칸 숨김 + is_fresh=false.
  const [isFresh, setIsFresh] = useState(true);
  const [harvestDate, setHarvestDate] = useState("");
  const [stockLimit, setStockLimit] = useState("");
  const [priceBandEnabled, setPriceBandEnabled] = useState(false);
  // KAMIS 품목 2단(부류→품목) — 시세(STEP4)·제철(STEP5) 연동 기반. 선택 사항(미선택 허용).
  const [kamisCategoryCode, setKamisCategoryCode] = useState("");
  const [kamisItemCode, setKamisItemCode] = useState("");
  const [kamisCategories, setKamisCategories] = useState<KamisCategory[]>([]);
  const [kamisItems, setKamisItems] = useState<KamisItem[]>([]);
  // STEP4-A — KAMIS 소매 시세 어드바이저(농가 가격 참고용). 품목 선택 시 get-price-band 조회.
  const [priceBand, setPriceBand] = useState<PriceBandResult | null>(null);
  const [priceBandLoading, setPriceBandLoading] = useState(false);
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

  // 품목 선택 시 KAMIS 소매 시세 조회 (미선택이면 호출 안 함 — 불필요 호출 방지).
  //   detach 주의: supabase.functions.invoke 를 메서드로 직접 호출(this 유지).
  useEffect(() => {
    if (!kamisItemCode || !kamisCategoryCode) {
      setPriceBand(null);
      return;
    }
    let cancelled = false;
    setPriceBandLoading(true);
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
          body: { item_code: kamisItemCode, category_code: kamisCategoryCode },
        });
        if (cancelled) return;
        setPriceBand(error || !data ? fail : (data as PriceBandResult));
      } catch {
        if (!cancelled) setPriceBand(fail);
      } finally {
        if (!cancelled) setPriceBandLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kamisItemCode, kamisCategoryCode]);

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
        console.error("[partner.products.new] upload failed:", upErr);
        setUploadError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      setPreviewUrl(publicUrl);
      setUploadedUrl(publicUrl);
      toast.success("사진을 업로드했어요.");
    } catch (err) {
      console.error("[partner.products.new] unexpected:", err);
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
    const productName = name.trim() || null;
    setSubmitting(true);
    try {
      // S2b — 자체업로드 분기로 저장(POST /api/drops, self_upload:true).
      //   가격/이름은 렌더용 product 블록으로도 운반(create-wizard 구매 흐름과 동일 형식).
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          self_upload: true,
          image_url: uploadedUrl,
          name: productName,
          price_krw: priceNum,
          // 나-1 — 카피 동봉(서버가 메인 product 블록 block_data 에 머지). 빈 값은 서버에서 생략.
          headline: copy.headline.trim(),
          selling_points: copy.sellingPoints.map((s) => s.trim()).filter(Boolean),
          // 신선 원물 — 가공이면 is_fresh=false + 나머지 생략(null). 신선이면 예정일·수량·시세 플래그.
          is_fresh: isFresh,
          harvest_date: isFresh && harvestDate ? harvestDate : null,
          stock_limit:
            isFresh && Number(stockLimit) >= 1 ? Math.floor(Number(stockLimit)) : null,
          price_band_enabled: isFresh ? priceBandEnabled : false,
          // KAMIS 품목코드 — 신선 + 선택했을 때만. 미선택이면 키 생략(ADDITIVE, 기존 등록 무영향).
          ...(isFresh && kamisItemCode ? { kamis_item_code: kamisItemCode } : {}),
          blocks: [
            {
              block_kind: "product",
              block_data: { name: productName, price_krw: priceNum },
              position: 0,
            },
          ],
        }),
      });
      const json = (await res.json()) as {
        drop?: { share_uuid?: string };
        shareable_url?: string;
        message?: string;
      };
      if (!res.ok || !json.drop?.share_uuid) {
        throw new Error(json.message ?? "DROP_CREATE_FAILED");
      }
      setResult({
        shareUuid: json.drop.share_uuid,
        shareUrl: json.shareable_url ?? `https://app.drop.how/d/${json.drop.share_uuid}`,
      });
      toast.success("상품 카드를 만들었어요.");
    } catch (err) {
      console.error("[partner.products.new] submit failed:", err);
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
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          매장 홈
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">상품 등록</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">상품 사진과 가격을 등록해요</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <Package className="size-4 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <h2 className="text-sm font-bold text-[#0F172A]">새 상품</h2>
          </div>

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

          {/* 가격 (필수) */}
          <div className="space-y-2">
            <label htmlFor="pd-price" className="block text-xs font-semibold text-[#0F172A]">
              가격
            </label>
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

          {/* 신선/가공 — 농가 선주문 속성. 기본 신선. 가공이면 신선 입력칸 숨김(is_fresh=false). */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
            <span className="block text-xs font-semibold tracking-ko text-text-strong">
              상품 유형
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsFresh(true)}
                aria-pressed={isFresh}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-sm font-semibold tracking-ko transition-colors ${
                  isFresh
                    ? "border-action bg-bg text-text-strong"
                    : "border-border bg-bg text-text-muted hover:border-text-muted"
                }`}
              >
                <Sprout className="size-4" strokeWidth={2} />
                신선 원물
              </button>
              <button
                type="button"
                onClick={() => setIsFresh(false)}
                aria-pressed={!isFresh}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-sm font-semibold tracking-ko transition-colors ${
                  !isFresh
                    ? "border-action bg-bg text-text-strong"
                    : "border-border bg-bg text-text-muted hover:border-text-muted"
                }`}
              >
                <Factory className="size-4" strokeWidth={2} />
                가공식품
              </button>
            </div>

            {isFresh ? (
              <div className="space-y-3 pt-1">
                {/* 수확/발송 예정일 */}
                <label htmlFor="pd-harvest" className="block">
                  <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                    <CalendarDays className="size-3.5" strokeWidth={2} />
                    수확·발송 예정일{" "}
                    <span className="font-medium text-text-subtle">(선택)</span>
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
                    한정 수량{" "}
                    <span className="font-medium text-text-subtle">(선택)</span>
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

                {/* 시세 표시 토글 */}
                <button
                  type="button"
                  onClick={() => setPriceBandEnabled((v) => !v)}
                  aria-pressed={priceBandEnabled}
                  className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold tracking-ko transition-colors ${
                    priceBandEnabled
                      ? "border-action bg-bg text-text-strong"
                      : "border-border bg-bg text-text-muted hover:border-text-muted"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="size-4" strokeWidth={2} />
                    시세 표시
                  </span>
                  <span
                    className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                      priceBandEnabled ? "bg-action" : "bg-border"
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full bg-bg transition-transform ${
                        priceBandEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </span>
                </button>
                <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
                  켜면 카드에 시세 비교가 표시될 예정이에요. (표시는 추후 제공)
                </p>

                {/* 품목 분류 — KAMIS 부류→품목 2단(선택). 시세·제철 연동 기반. 미선택 허용. */}
                <div className="space-y-2 pt-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                    <Tags className="size-3.5" strokeWidth={2} />
                    품목 분류{" "}
                    <span className="font-medium text-text-subtle">
                      (선택 · 시세·제철 연동용)
                    </span>
                  </span>
                  <select
                    aria-label="부류 선택"
                    value={kamisCategoryCode}
                    onChange={(e) => {
                      setKamisCategoryCode(e.target.value);
                      setKamisItemCode(""); // 부류 바뀌면 품목 선택 초기화(stale 방지)
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
                      onChange={(e) => setKamisItemCode(e.target.value)}
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

                  {/* KAMIS 소매 시세 어드바이저 — 품목 선택 시만. 농가 가격 참고용(§0). */}
                  {kamisItemCode ? (
                    <PriceBandAdvisor priceBand={priceBand} loading={priceBandLoading} />
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-[11px] font-medium leading-relaxed tracking-ko text-text-subtle">
                가공식품은 사진·가격·이름·홍보 문구만 등록해요. 유통기한·식품표시는 다음 단계에서
                지원합니다.
              </p>
            )}
          </div>

          {/* 나-1 — 홍보 문구(선택). 상품명·가격·메모 기반 AI 카피 + 수동 수정. */}
          <ProductCopyEditor
            productName={name}
            priceKrw={Number.isFinite(Number(price)) && Number(price) > 0 ? Number(price) : null}
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

        {/* 등록 완료 — 생성된 상품 카드 보기 / 공유 링크 복사 */}
        {result ? (
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
        ) : null}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
