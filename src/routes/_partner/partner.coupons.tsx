import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_partner/partner/coupons")({
  head: () => ({ meta: [{ title: "쿠폰 관리" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">쿠폰</h1>
      <section className="mt-8">
        <EmptyState title="발행한 쿠폰이 없어요" description="첫 쿠폰을 만들어 보세요." />
      </section>
    </main>
  );
}
