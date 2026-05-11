import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_partner/partner/redeem")({
  head: () => ({ meta: [{ title: "쿠폰 사용 처리" }] }),
  component: RedeemPage,
});

function RedeemPage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">쿠폰 사용</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">쿠폰 코드를 입력해 사용 처리합니다.</p>
    </main>
  );
}
