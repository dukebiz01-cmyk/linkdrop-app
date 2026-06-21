import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
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

function ProductNewPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  // 신선 원물(농가 선주문) — 기본 신선. 가공 선택 시 신선 입력칸 숨김 + is_fresh=false.
  const [isFresh, setIsFresh] = useState(true);
  const [harvestDate, setHarvestDate] = useState("");
  const [stockLimit, setStockLimit] = useState("");
  const [priceBandEnabled, setPriceBandEnabled] = useState(false);
  // 나-1 — 상품 카피(headline/selling_points). 비우면 저장 시 키 생략(회귀 0).
  const [copy, setCopy] = useState<ProductCopyValue>(EMPTY_PRODUCT_COPY);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 저장 성공 결과 — 생성된 드롭의 공유 URL(drop.how/{code}) + share_uuid(/d 미리보기용).
  const [result, setResult] = useState<{ shareUrl: string; shareUuid: string } | null>(null);

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
