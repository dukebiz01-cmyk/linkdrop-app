import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_user/profile")({
  head: () => ({ meta: [{ title: "프로필" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">프로필</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">내 정보</p>
    </main>
  );
}
