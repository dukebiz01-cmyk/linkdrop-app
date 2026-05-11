import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  component: HomePage,
});

function HomePage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">홈</h1>
      <section className="mt-8">
        <EmptyState title="아직 받은 리워드가 없어요" description="첫 쿠폰을 받으면 여기에 모입니다." />
      </section>
    </main>
  );
}
