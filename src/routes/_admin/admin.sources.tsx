import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_admin/admin/sources")({
  head: () => ({ meta: [{ title: "소스" }] }),
  component: Page,
});

function Page() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">소스</h1>
      <section className="mt-8">
        <EmptyState title="소스가 없어요" />
      </section>
    </main>
  );
}
