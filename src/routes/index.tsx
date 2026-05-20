import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  Gift,
  Link as LinkIcon,
  Search,
  Bell,
  Phone,
  ShoppingBag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { WIZARD_PRIMARY_BUTTON_CLASS } from "@/components/create-wizard-button-styles";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const PURPOSE_CARDS = [
  { label: "정보", description: "영상 핵심 정리", icon: BookOpen },
  { label: "쿠폰", description: "혜택으로 손님 모으기", icon: Gift },
  { label: "예약", description: "날짜·예약 연결", icon: Calendar },
  { label: "구매", description: "AI 가격 비교", icon: ShoppingBag },
  { label: "상담", description: "문의·상담 받기", icon: Phone },
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkDrop — 영상을 Drop으로" },
      {
        name: "description",
        content:
          "유튜브·인스타 링크를 붙이면 AI가 핵심을 정리하고, 쿠폰·예약·구매·상담 버튼까지 추천해요.",
      },
      { property: "og:title", content: "LinkDrop" },
      {
        property: "og:description",
        content:
          "유튜브·인스타 링크를 붙이면 AI가 핵심을 정리하고, 쿠폰·예약·구매·상담 버튼까지 추천해요.",
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="flex h-14 items-center justify-between border-b border-[#E5E7EB] px-4">
        <span className="text-xl font-bold tracking-ko text-[#111111]">LinkDrop</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-lg text-[#111111] transition-colors hover:bg-[#F5F5F5]"
            aria-label="검색"
          >
            <Search className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="relative flex size-10 items-center justify-center rounded-lg text-[#111111] transition-colors hover:bg-[#F5F5F5]"
            aria-label="알림"
          >
            <Bell className="size-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-8 pt-8">
        <h1 className="text-3xl font-extrabold leading-tight tracking-ko text-[#111111]">
          영상을 Drop으로
        </h1>
        <p className="mt-4 text-base font-medium leading-relaxed tracking-ko text-[#525252]">
          유튜브·인스타 링크를 붙이면 AI가 핵심을 정리하고,
          <br />
          쿠폰·예약·구매·상담 버튼까지 추천해요.
        </p>

        <div className="relative mt-8">
          <LinkIcon
            className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#A3A3A3]"
            strokeWidth={2}
          />
          <Input
            type="url"
            readOnly
            placeholder="https://youtu.be/..."
            className="h-14 rounded-2xl border-[#E5E7EB] bg-white pl-12 font-mono text-sm placeholder:font-sans placeholder:text-[#A3A3A3]"
          />
        </div>

        <Link to="/login" className="mt-4 block">
          <span className={cn(WIZARD_PRIMARY_BUTTON_CLASS, "inline-flex")}>Drop 만들기</span>
        </Link>

        <section className="mt-12">
          <p className="text-sm font-semibold tracking-ko text-[#525252]">목적을 골라 시작해요</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {PURPOSE_CARDS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to="/login"
                  className="flex min-h-[100px] flex-col items-start justify-between rounded-2xl border border-[#E5E7EB] bg-white p-4 transition-colors hover:border-[#2563EB] hover:bg-[#EFF6FF]/30"
                >
                  <Icon className="size-6 text-[#2563EB]" strokeWidth={2} />
                  <div>
                    <p className="text-sm font-bold tracking-ko text-[#111111]">{item.label}</p>
                    <p className="mt-1 text-xs font-medium text-[#525252]">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E5E7EB] px-6 py-8">
        <nav className="flex justify-center gap-6">
          <Link
            to="/partner/register"
            className="text-xs font-medium text-[#525252] hover:text-[#111111]"
          >
            매장 입점 안내
          </Link>
          <Link
            to="/login"
            className="text-xs font-medium text-[#525252] hover:text-[#111111]"
          >
            영상제공자 등록
          </Link>
        </nav>
      </footer>
    </div>
  );
}
