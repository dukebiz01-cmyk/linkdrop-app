import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_partner/partner/")({
  head: () => ({ meta: [{ title: "파트너 홈" }] }),
  component: PartnerHome,
});

function PartnerHome() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">파트너</h1>
      <section className="mt-8">
        <EmptyState title="아직 등록된 매장이 없어요" description="매장을 등록하고 리워드를 발행해 보세요." />
      </section>
    </main>
  );
}
