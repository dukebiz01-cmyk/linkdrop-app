import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_partner/partner/billing")({
  head: () => ({ meta: [{ title: "정산" }] }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">정산</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">청구 및 결제 내역</p>
    </main>
  );
}
