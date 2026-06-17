import { useState } from "react";
import { Sparkles, Loader2, Plus, X, Megaphone } from "lucide-react";

// 나-1 상품-스코프 카피 에디터 — 상품 정보(props) + 메모 + AI 생성 + 검토/수정.
//   상품 선택 picker 없음(상품은 호출처에서 이미 결정). 상품 생성·편집 양쪽에서 재사용.
//   generate-promo-copy Edge(/api/generate-promo-copy) 무변경 호출. graceful: AI 실패해도 수동 입력.
//   controlled — value({headline, sellingPoints}) + onChange. (B 의 ProductPromoSection 은 미변경.)

export interface ProductCopyValue {
  headline: string;
  sellingPoints: string[];
}

export const EMPTY_PRODUCT_COPY: ProductCopyValue = { headline: "", sellingPoints: [] };

const MAX_POINTS = 5;

export function ProductCopyEditor({
  productName,
  priceKrw,
  productId,
  value,
  onChange,
}: {
  productName: string;
  priceKrw: number | null;
  /** 생성 기록 추적용(선택). */
  productId?: string | null;
  value: ProductCopyValue;
  onChange: (next: ProductCopyValue) => void;
}) {
  const [notes, setNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function generateCopy() {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/generate-promo-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName.trim() || "상품",
          price_krw: priceKrw,
          notes: notes.trim(),
          product_id: productId ?? null,
        }),
      });
      const json = (await res.json()) as {
        headline?: string;
        selling_points?: string[];
        message?: string;
      };
      if (!res.ok) {
        setAiError(json.message ?? "카피 생성에 실패했어요. 직접 입력해 주세요.");
        return;
      }
      onChange({
        headline: typeof json.headline === "string" ? json.headline : value.headline,
        sellingPoints:
          Array.isArray(json.selling_points) && json.selling_points.length > 0
            ? json.selling_points.slice(0, MAX_POINTS)
            : value.sellingPoints,
      });
    } catch {
      setAiError("네트워크 오류예요. 직접 입력해 주세요.");
    } finally {
      setAiLoading(false);
    }
  }

  function setHeadline(h: string) {
    onChange({ ...value, headline: h });
  }
  function updatePoint(i: number, v: string) {
    onChange({ ...value, sellingPoints: value.sellingPoints.map((p, idx) => (idx === i ? v : p)) });
  }
  function removePoint(i: number) {
    onChange({ ...value, sellingPoints: value.sellingPoints.filter((_, idx) => idx !== i) });
  }
  function addPoint() {
    if (value.sellingPoints.length >= MAX_POINTS) return;
    onChange({ ...value, sellingPoints: [...value.sellingPoints, ""] });
  }

  return (
    <div className="rounded-2xl border border-border bg-bg p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-text-strong" strokeWidth={2} />
        <p className="text-sm font-bold tracking-ko text-text-strong">홍보 문구</p>
      </div>

      {/* 추가 정보(선택) — AI 근거. 없으면 안전한 일반 카피만. */}
      <label className="mt-3 block text-xs font-semibold tracking-ko text-text-strong">
        추가 정보 <span className="font-medium text-text-subtle">(선택)</span>
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 300))}
        rows={2}
        placeholder="원산지·재배/제조 방식 등 사실만 적어주세요. (과장·없는 내용 금지)"
        className="mt-1 w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm tracking-ko text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
      />

      <button
        type="button"
        onClick={generateCopy}
        disabled={aiLoading}
        className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-action px-4 text-sm font-bold tracking-ko text-action-foreground transition-colors disabled:opacity-60"
      >
        {aiLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            카피 만드는 중…
          </>
        ) : (
          <>
            <Sparkles className="size-4" strokeWidth={2} />
            AI 카피 생성
          </>
        )}
      </button>
      {aiError ? (
        <p className="mt-2 text-xs font-medium tracking-ko text-text-muted">{aiError}</p>
      ) : null}

      {/* 검토·수정 — AI 없이 수동 입력도 가능 */}
      <label className="mt-4 block text-xs font-semibold tracking-ko text-text-strong">
        헤드라인
      </label>
      <input
        type="text"
        value={value.headline}
        onChange={(e) => setHeadline(e.target.value.slice(0, 40))}
        placeholder="한 줄 홍보 문구"
        className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold tracking-ko text-text-strong placeholder:font-medium placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
      />

      <label className="mt-3 block text-xs font-semibold tracking-ko text-text-strong">
        셀링포인트
      </label>
      <ul className="mt-1 space-y-2">
        {value.sellingPoints.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={p}
              onChange={(e) => updatePoint(i, e.target.value.slice(0, 60))}
              placeholder={`셀링포인트 ${i + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm tracking-ko text-text-strong placeholder:text-text-subtle focus:border-text-strong focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removePoint(i)}
              aria-label="셀링포인트 제거"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle hover:text-text-strong"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
      {value.sellingPoints.length < MAX_POINTS ? (
        <button
          type="button"
          onClick={addPoint}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted"
        >
          <Plus className="size-4" strokeWidth={2} />
          셀링포인트 추가
        </button>
      ) : null}
    </div>
  );
}
