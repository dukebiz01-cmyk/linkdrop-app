import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_partner/partner/register")({
  head: () => ({ meta: [{ title: "파트너 등록" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">파트너 등록</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">매장 정보를 입력해 주세요.</p>
    </main>
  );
}
