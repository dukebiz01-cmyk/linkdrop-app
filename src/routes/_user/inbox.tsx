import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_user/inbox")({
  head: () => ({ meta: [{ title: "받은함" }] }),
  component: InboxPage,
});

function InboxPage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">받은함</h1>
      <section className="mt-8">
        <EmptyState title="새 알림이 없어요" description="새로운 리워드가 도착하면 표시됩니다." />
      </section>
    </main>
  );
}
