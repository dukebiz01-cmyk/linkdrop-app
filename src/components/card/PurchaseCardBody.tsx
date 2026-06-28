import { Check, ShoppingCart, MapPin, CalendarDays, Sprout } from "lucide-react";
import { AiPriceComparisonCard, type PriceOfferRow } from "@/components/ai-price-comparison-card";
import { ActionButton } from "@/components/ActionButton";
import type { InfoDropPageProps } from "@/components/info-drop-page";

/**
 * PurchaseCardBody — 손님 구매(purchase) 카드 본체. info-drop-page L1418~1545 variant-purchase
 *   섹션을 순수 추출(presentational). 마크업·클래스·동작 100% 동일(기능 추가·변경 0).
 *
 * commerce 있으면 단순 상품 카드(이미지=source, 가격/이름=block, 구매=source url),
 *   없으면 기존 fallback(AiPriceComparisonCard). title = safeTitle, onSellerClick = handleCtaClick("seller").
 */
export function PurchaseCardBody({
  commerce,
  title,
  local,
  productName,
  brandGuess,
  priceOffers,
  onPreorder,
  onSellerClick,
}: {
  commerce: InfoDropPageProps["commerce"];
  title: string;
  local: InfoDropPageProps["local"];
  productName?: string;
  brandGuess?: string;
  priceOffers?: PriceOfferRow[];
  onPreorder?: () => void;
  onSellerClick: () => void;
}) {
  return commerce ? (
    // F2 커머스 — 시세·쿠폰 없는 단순 상품 카드(이미지=source, 가격/이름=block, 구매=source url).
    <section data-testid="variant-purchase" className="w-full max-w-full">
      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        {commerce.imageUrl ? (
          <img
            src={commerce.imageUrl}
            alt=""
            className="aspect-[4/3] w-full object-cover"
          />
        ) : null}
        <div className="space-y-3 p-4">
          <p className="text-base font-bold leading-snug tracking-ko text-text-strong">
            {commerce.name || title}
          </p>
          <p className="text-xl font-extrabold tracking-ko text-text-strong">
            {commerce.priceKrw != null
              ? `${commerce.priceKrw.toLocaleString("ko-KR")}원`
              : "가격 미정"}
          </p>
          {/* ② 농가/산지 — props.local 있을 때만(없으면 생략). 신뢰 강화. */}
          {local?.name?.trim() || local?.address?.trim() ? (
            <p className="flex items-center gap-1.5 text-sm font-medium tracking-ko text-text-muted">
              <MapPin className="size-4 shrink-0 text-text-subtle" strokeWidth={2} />
              <span className="min-w-0 truncate">
                {[local?.name?.trim(), local?.address?.trim()]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
          ) : null}
          {/* ② 신선 원물 strip — isFresh 일 때만. 수확·발송 예정일 + 한정 수량. 시세 미표시. */}
          {commerce.isFresh ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-ko text-text-strong">
                <Sprout className="size-4 shrink-0 text-text-strong" strokeWidth={2} />
                신선 원물
              </span>
              {commerce.harvestDate ? (
                <p className="flex items-center gap-1.5 text-sm font-medium tracking-ko text-text-muted">
                  <CalendarDays
                    className="size-4 shrink-0 text-text-subtle"
                    strokeWidth={2}
                  />
                  {(() => {
                    const parts = String(commerce.harvestDate).split("-");
                    const mm = parts[1];
                    const dd = parts[2];
                    return mm && dd
                      ? `${Number(mm)}월 ${Number(dd)}일 수확·발송 예정`
                      : String(commerce.harvestDate);
                  })()}
                </p>
              ) : null}
              {commerce.stockLimit != null ? (
                <span className="inline-flex w-fit items-center rounded-md border border-border bg-bg px-2 py-0.5 text-xs font-semibold tracking-ko text-text-strong">
                  {commerce.stockLimit}개 한정
                </span>
              ) : null}
            </div>
          ) : null}
          {/* 나-2 — 상품 저장 카피(나-1). 있으면 헤드라인+셀링포인트 리치 표시(없으면 회귀 0). */}
          {commerce.headline ? (
            <p className="text-base font-bold leading-snug tracking-ko text-text-strong">
              {commerce.headline}
            </p>
          ) : null}
          {commerce.sellingPoints && commerce.sellingPoints.length > 0 ? (
            <ul className="space-y-1.5">
              {commerce.sellingPoints.map((sp, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-muted"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-text-strong"
                    strokeWidth={2.5}
                  />
                  <span>{sp}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {commerce.selfUpload ? (
            // ③b 자체업로드 상품 — 1차 버튼 = 선주문하기. 부모(d.$shareUuid)가 로그인 강제 +
            //   PreorderSheet(발송일·수량·결제 스텁) 오픈 + create_preorder 호출을 핸들.
            <ActionButton
              type="button"
              className="w-full gap-2"
              onClick={() => onPreorder?.()}
            >
              <ShoppingCart className="size-4" strokeWidth={2} />
              선주문하기
            </ActionButton>
          ) : (
            <ActionButton
              type="button"
              className="w-full"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  commerce.buyUrl &&
                  commerce.buyUrl !== "#"
                ) {
                  window.open(commerce.buyUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              구매하기
            </ActionButton>
          )}
        </div>
      </div>
    </section>
  ) : (
    <section data-testid="variant-purchase">
      <AiPriceComparisonCard
        productName={productName ?? title}
        brandGuess={brandGuess}
        offers={priceOffers ?? []}
        className="mx-0 mt-0"
        onOfferClick={(_id) => {
          onSellerClick();
        }}
      />
    </section>
  );
}
