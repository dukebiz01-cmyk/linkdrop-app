import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_user/d/$share_uuid")({
  head: () => ({ meta: [{ title: "공유 보기" }] }),
  component: ShareDetail,
});

function ShareDetail() {
  const { share_uuid } = Route.useParams();
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">공유</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">{share_uuid}</p>
    </main>
  );
}
