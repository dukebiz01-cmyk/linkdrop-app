import { createFileRoute } from "@tanstack/react-router";
import { ActionButton } from "@/components/ActionButton";
import { IntentChip } from "@/components/IntentChip";
import { IntentStrip } from "@/components/IntentStrip";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-text-strong">
          디자인 시스템 셸
        </h1>
        <p className="mt-2 text-sm font-medium text-text-muted">
          Module 0a + 0 — 13개 디자인 철학 토큰이 적용된 베이스 레이아웃입니다.
        </p>
      </header>

      <section className="space-y-3">
        <IntentStrip intent="info">
          Supabase 연결 정보를 .env.local 에 넣으면 데이터 화면이 살아납니다.
        </IntentStrip>
        <div className="flex flex-wrap gap-2">
          <IntentChip intent="success">활성</IntentChip>
          <IntentChip intent="warning">대기</IntentChip>
          <IntentChip intent="danger">만료</IntentChip>
          <IntentChip intent="info">신규</IntentChip>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-base font-bold text-text-strong">샘플 카드</h2>
        <p className="mt-2 text-sm font-medium text-text-muted">
          일반 카드는 그림자가 없고 border로 면을 분리합니다.
        </p>
      </section>

      <section className="mt-8">
        <EmptyState
          title="아직 표시할 항목이 없어요"
          description="라우트 12개와 페이지 컴포넌트는 다음 모듈에서 채워집니다."
        />
      </section>

      <div className="mt-8 flex justify-center">
        <ActionButton type="button">시작하기</ActionButton>
      </div>
    </main>
  );
}
