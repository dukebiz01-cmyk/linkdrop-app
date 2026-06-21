import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Lock, Plus } from "lucide-react";

// 커머스 준비 가이드 — 판매 관리(partner.products.index)에서 등록 상품이 0개일 때
//   빈 화면 대신 4항목 체크리스트로 다음 액션을 안내한다.
//   approved 가맹점만 이 화면에 진입하므로 "사업자 인증"은 항상 완료 상태로 둔다.
//   상품 등록 CTA = /partner/products/new (내부 Link, props 없이 자체 완결).
export function CommercePrepGuide() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <header>
        <h2 className="text-lg font-bold tracking-ko text-text-strong">커머스 준비</h2>
        <p className="mt-1 text-sm font-medium tracking-ko text-text-muted">
          상품을 등록하면 판매 카드가 만들어져요
        </p>
        <p className="mt-3 text-xs font-semibold tracking-ko text-text-subtle">준비 1 / 2</p>
      </header>

      <ul className="mt-5 flex flex-col gap-3">
        {/* 항목1 — 사업자 인증: 항상 완료(approved 진입) */}
        <li className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-intent-success"
            strokeWidth={2}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-ko text-text-strong">사업자 인증</p>
            <p className="mt-0.5 text-xs font-medium tracking-ko text-text-muted">완료</p>
          </div>
        </li>

        {/* 항목2 — 상품·카드 등록: 현재 액션(강조) */}
        <li className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4">
          <Circle className="mt-0.5 size-5 shrink-0 text-text-strong" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-ko text-text-strong">상품·카드 등록</p>
            <p className="mt-0.5 text-xs font-medium tracking-ko text-text-muted">
              상품을 올리면 공유할 판매 카드가 자동으로 만들어져요
            </p>
            <Link
              to="/partner/products/new"
              className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-action px-5 py-2.5 text-sm font-semibold tracking-ko text-action-foreground transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" strokeWidth={2} />
              상품 등록하기
            </Link>
          </div>
        </li>

        {/* 항목3 — 배송 설정: 잠금(준비중) */}
        <li className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4 opacity-60">
          <Lock className="mt-0.5 size-5 shrink-0 text-text-disabled" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-ko text-text-subtle">배송 설정</p>
            <p className="mt-0.5 text-xs font-medium tracking-ko text-text-disabled">준비중</p>
          </div>
        </li>

        {/* 항목4 — 정산 연결: 잠금(결제 연동 후 열림) */}
        <li className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4 opacity-60">
          <Lock className="mt-0.5 size-5 shrink-0 text-text-disabled" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-ko text-text-subtle">정산 연결</p>
            <p className="mt-0.5 text-xs font-medium tracking-ko text-text-disabled">
              결제 연동(Toss) 후 열림
            </p>
          </div>
        </li>
      </ul>
    </section>
  );
}
