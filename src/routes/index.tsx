import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ActionButton } from "@/components/ActionButton";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkDrop — 친구가 진짜 가본 곳을 영상으로" },
      {
        name: "description",
        content:
          "친구가 진짜 가본 곳, 친구가 진짜 산 것을 영상으로 받아보세요. LinkDrop.",
      },
      { property: "og:title", content: "LinkDrop" },
      {
        property: "og:description",
        content: "친구가 진짜 가본 곳, 친구가 진짜 산 것, 영상으로 받아보세요.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase().auth.getSession();
    if (data.session) {
      throw redirect({ to: "/home" });
    }
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
      <header className="px-6 py-6">
        <span className="text-base font-extrabold text-text-strong">LinkDrop</span>
      </header>

      <main className="flex flex-1 flex-col px-6 pt-8">
        <h1 className="text-3xl font-extrabold text-text-strong">
          친구가 진짜 가본 곳,
          <br />
          친구가 진짜 산 것,
          <br />
          영상으로 받아보세요.
        </h1>

        <section className="mt-12 space-y-6">
          <div className="rounded-2xl border border-border p-6">
            <h2 className="text-base font-bold text-text-strong">
              친구한테 카톡으로 받았어요
            </h2>
            <p className="mt-2 text-sm font-medium text-text-muted">
              받은 링크를 다시 눌러주세요. 영상이 바로 열립니다.
            </p>
          </div>

          <div className="rounded-2xl border border-border p-6">
            <h2 className="text-base font-bold text-text-strong">
              LinkDrop이 처음이에요
            </h2>
            <p className="mt-2 text-sm font-medium text-text-muted">
              시작하시면 받은 영상이 한 곳에 모여요.
            </p>
            <div className="mt-6">
              <Link to="/login">
                <ActionButton type="button" className="w-full">
                  시작하기
                </ActionButton>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8">
        <nav className="flex justify-center gap-6">
          <Link
            to="/partner/register"
            className="text-xs font-medium text-text-muted hover:text-text-strong"
          >
            매장 입점 안내
          </Link>
          <Link
            to="/login"
            className="text-xs font-medium text-text-muted hover:text-text-strong"
          >
            영상제공자 등록
          </Link>
        </nav>
      </footer>
    </div>
  );
}
