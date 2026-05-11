import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/admin/extract")({
  head: () => ({ meta: [{ title: "추출" }] }),
  component: Page,
});

function Page() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">추출</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">데이터 추출 도구</p>
    </main>
  );
}
