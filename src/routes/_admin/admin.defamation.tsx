import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_admin/admin/defamation")({
  head: () => ({ meta: [{ title: "신고 관리" }] }),
  component: Page,
});

function Page() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">신고 관리</h1>
      <section className="mt-8">
        <EmptyState title="접수된 신고가 없어요" />
      </section>
    </main>
  );
}
