import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_user/create")({
  head: () => ({ meta: [{ title: "만들기" }] }),
  component: CreatePage,
});

function CreatePage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">만들기</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">새 공유 링크를 만들어요.</p>
    </main>
  );
}
