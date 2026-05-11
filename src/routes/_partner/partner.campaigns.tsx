import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_partner/partner/campaigns")({
  head: () => ({ meta: [{ title: "캠페인" }] }),
  component: CampaignsPage,
});

function CampaignsPage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">캠페인</h1>
      <section className="mt-8">
        <EmptyState title="진행 중인 캠페인이 없어요" />
      </section>
    </main>
  );
}
