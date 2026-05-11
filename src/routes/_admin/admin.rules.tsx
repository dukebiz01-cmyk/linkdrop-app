import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_admin/admin/rules")({
  head: () => ({ meta: [{ title: "리워드 룰" }] }),
  component: Page,
});

function Page() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">리워드 룰</h1>
      <section className="mt-8">
        <EmptyState title="등록된 룰이 없어요" />
      </section>
    </main>
  );
}
