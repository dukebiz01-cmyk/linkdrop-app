// ProductRegisterForm — 상품 등록 폼 본체 (공용, P1 추출: partner.products.new 에서 이동).
//   순수 리팩터 — 동작·UI 변경 0. 라우터 데이터 결합 없음(loader/useSearch/useParams 미사용).
//   절단면: (a) createFileRoute/head 는 라우트 잔류 (b) 헤더 back-nav(Link)는 페이지 래퍼(라우트)에 잔류 →
//     컴포넌트는 router 훅 0. onNavigate 는 향후 임베드 호스트용 예약 옵션 prop.
//   (c) 저장은 onSubmit(payload) props 주입 — /api/drops insert 로직은 라우트가 그대로 소유.
//   (d) getSupabase 는 lib(비-라우터)라 컴포넌트 내부 유지(KAMIS 조회·get-price-band·업로드·세션).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ImagePlus,
  Package,
  Loader2,
  CheckCircle2,
  Sprout,
  Factory,
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

// KAMIS 품목 분류 — 라이브 DB kamis_categories(6행)/kamis_items(130행). types.ts 미반영이라 캐스트.
type KamisCategory = { category_code: string; category_name: string };
type KamisItem = { item_code: string; item_name: string };

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
  /** P2 임베드 모드(스튜디오 등) — 폼 자체 카드 크롬·"새 상품" 헤더 숨김 + 완료 화면의
   *  외부 이동 액션('카드 보기')을 숨긴다(호스트가 미리보기를 자체 표시). 기본 false = 기존 동작. */
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
  // 신선 원물(농가 선주문) — 기본 신선. 가공 선택 시 신선 입력칸 숨김 + is_fresh=false.
  const [isFresh, setIsFresh] = useState(true);
  const [harvestDate, setHarvestDate] = useState("");
  const [stockLimit, setStockLimit] = useState("");
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
        // 신선 원물 — 가공이면 is_fresh=false + 나머지 생략(null). 신선이면 예정일·수량·시세 플래그.
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
            block_data: { name: productName, price_krw: priceNum },
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

              {/* §0 — 손님 카드 시세 비교 노출은 영구 금지(표시광고법). 생산자 참고용
                  PriceBandAdvisor(아래 품목 선택 시)만 유지. '손님 노출 토글'은 제거. */}

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

      {/* 등록 완료 — 생성된 상품 카드 보기 / 공유 링크 복사 */}
      {result ? (
        <section className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#059669]" strokeWidth={2} />
            <h2 className="text-sm font-bold text-[#065F46]">상품 카드를 만들었어요</h2>
          </div>
          <p className="mt-2 break-all text-xs text-[#047857]">{result.shareUrl}</p>
          <div className="mt-3 flex gap-2">
            {/* P2 — 임베드에선 외부 이동 액션 숨김(호스트 미리보기가 카드를 즉시 표시). */}
            {embedded ? null : (
              <a
                href={`/d/${result.shareUuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white"
              >
                카드 보기
              </a>
            )}
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
    </>
  );
}
