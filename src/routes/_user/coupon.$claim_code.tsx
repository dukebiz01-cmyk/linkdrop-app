import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_user/coupon/$claim_code")({
  head: () => ({ meta: [{ title: "쿠폰" }] }),
  component: CouponDetail,
});

function CouponDetail() {
  const { claim_code } = Route.useParams();
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">쿠폰</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">코드: {claim_code}</p>
    </main>
  );
}
