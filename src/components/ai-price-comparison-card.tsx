import { ExternalLink, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PriceOfferRow {
  id: string;
  sellerName: string;
  platform: string;
  priceLabel: string;
  shippingLabel?: string;
  totalLabel: string;
  productUrl: string;
  isBest?: boolean;
}

export interface AiPriceComparisonCardProps {
  productName: string;
  brandGuess?: string;
  offers: PriceOfferRow[];
  onOfferClick?: (offerId: string) => void;
  className?: string;
}

function isDomesticOffer(offer: PriceOfferRow): boolean {
  return offer.platform.includes("국내") || offer.id.includes("kr");
}

function OfferList({
  offers,
  onOfferClick,
}: {
  offers: PriceOfferRow[];
  onOfferClick?: (offerId: string) => void;
}) {
  if (offers.length === 0) return null;
  return (
    <ul className="space-y-3">
      {offers.map((offer) => (
        <li
          key={offer.id}
          className={cn(
            "rounded-lg border border-border bg-bg p-4",
            offer.isBest && "border-accent ring-1 ring-accent/20",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-text-strong">{offer.sellerName}</p>
              <p className="text-xs font-medium text-text-muted">{offer.platform}</p>
            </div>
            {offer.isBest && (
              <span className="shrink-0 rounded-lg bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                최저가
              </span>
            )}
          </div>
          <p className="mt-2 text-base font-bold tabular-nums text-text-strong">{offer.totalLabel}</p>
          <p className="text-xs font-medium text-text-muted">
            상품 {offer.priceLabel}
            {offer.shippingLabel ? ` · 배송 ${offer.shippingLabel}` : ""}
          </p>
          <a
            href={offer.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOfferClick?.(offer.id)}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            구매처에서 보기
            <ExternalLink className="size-4" strokeWidth={2} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * 구매(purchase) 목적 Drop — AI 상품·가격 비교 카드.
 * WHY: v3 핵심 차별화. Phase 1은 mock/반자동 — 자동 가격 갱신은 Phase 3.
 */
export function AiPriceComparisonCard({
  productName,
  brandGuess,
  offers,
  onOfferClick,
  className,
}: AiPriceComparisonCardProps) {
  const domesticOffers = offers.filter(isDomesticOffer);
  const globalOffers = offers.filter((o) => !isDomesticOffer(o));

  return (
    <section className={cn("mx-5 mt-6 rounded-2xl border border-border bg-surface p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface">
          <ShoppingBag className="size-5 text-accent" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-ko text-text-subtle">AI 상품 발견</p>
          <h2 className="mt-1 text-lg font-bold tracking-ko text-text-strong">{productName}</h2>
          {brandGuess && (
            <p className="mt-0.5 text-sm font-medium text-text-muted">브랜드 추정: {brandGuess}</p>
          )}
        </div>
      </div>

      {domesticOffers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold tracking-ko text-text-strong">국내 가격 후보</h3>
          <div className="mt-2">
            <OfferList offers={domesticOffers} onOfferClick={onOfferClick} />
          </div>
        </div>
      )}

      {globalOffers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold tracking-ko text-text-strong">해외 가격 후보</h3>
          <div className="mt-2">
            <OfferList offers={globalOffers} onOfferClick={onOfferClick} />
          </div>
        </div>
      )}

      {offers.length === 0 && (
        <p className="mt-4 text-sm font-medium text-text-muted">가격 후보를 불러오는 중이에요.</p>
      )}

      <p className="mt-4 text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
        검색 당시 기준이며 실시간 최저가를 보장하지 않습니다.
      </p>
    </section>
  );
}
