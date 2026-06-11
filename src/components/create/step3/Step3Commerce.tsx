import { Input } from "@/components/ui/input";
import { StepBadge } from "@/components/create/StepBadge";

/**
 * F2 커머스(구매) 전용 Step — 가격(필수) + 상품명(선택).
 * 시세·쿠폰 없음(Slice 2·3). 가격 입력 시 sticky CTA(공유 미리보기)가 통과.
 * 상품명을 비우면 렌더는 source.title(상품 페이지 OG 제목)을 사용한다.
 */
export function Step3Commerce({
  price,
  onPriceChange,
  name,
  onNameChange,
}: {
  price: string;
  onPriceChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
        판매 정보를 입력해 주세요
      </h1>
      <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
        가격은 필수예요. 상품명을 비우면 상품 페이지 제목을 그대로 사용해요.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <span className="text-sm font-semibold tracking-ko text-text-strong">
            가격 (원)
          </span>
          <div className="mt-2 flex h-12 items-center gap-2 rounded-lg border border-border bg-bg px-4">
            <Input
              type="text"
              inputMode="numeric"
              value={price}
              onChange={(e) => onPriceChange(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="19900"
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="shrink-0 text-sm font-medium tracking-ko text-text-muted">원</span>
          </div>
        </div>

        <div>
          <span className="text-sm font-semibold tracking-ko text-text-strong">
            상품명 <span className="font-medium text-text-subtle">(선택)</span>
          </span>
          <Input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="비우면 상품 페이지 제목 사용"
            className="mt-2 h-12 rounded-lg border-border text-sm placeholder:text-text-subtle"
          />
        </div>
      </div>
    </main>
  );
}
