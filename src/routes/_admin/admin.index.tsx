import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({ meta: [{ title: "관리자" }] }),
  component: Page,
});

function Page() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">관리자</h1>
      <section className="mt-8">
        <EmptyState title="대시보드 데이터가 없어요" />
      </section>
    </main>
  );
}
