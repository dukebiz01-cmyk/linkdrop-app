import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_admin/admin/trends")({
  head: () => ({ meta: [{ title: "트렌드" }] }),
  component: Page,
});

function Page() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">트렌드</h1>
      <section className="mt-8">
        <EmptyState title="집계할 데이터가 부족해요" />
      </section>
    </main>
  );
}
