import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import StartIntro from "@/components/start-intro";

export const Route = createFileRoute("/_user/start")({
  // BUG-3A — 온보딩 게이트가 부착한 복귀 주소(next). 오픈 리다이렉트 방지: 같은 오리진
  //   경로("/..." 시작·"//" 차단)만 통과, 아니면 미보존.
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const n = search.next;
    return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? { next: n } : {};
  },
  component: StartPage,
});

type IntroChoice = "owner" | "creator" | "seller" | "browse" | "skip";

function StartPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  async function onSelect(choice: IntroChoice) {
    const supabase = await getAuthClient();
    if (supabase) { try { await supabase.rpc("mark_onboarding_complete"); } catch {} }
    // BUG-3A — 복귀 주소(next) 우선: 쿠폰 수령 등 funnel 복귀가 목적이므로 next 존재 시
    //   선택지 분기보다 앞서 그 경로로 이동(쿼리 보존 위해 하드 내비게이션). 없으면 현행 기본 분기.
    if (next && typeof window !== "undefined") {
      window.location.assign(next);
      return;
    }
    switch (choice) {
      case "creator": navigate({ to: "/create-wizard" }); break;
      case "owner":   navigate({ to: "/partner/register" }); break;
      case "seller":  navigate({ to: "/partner/register", search: { kind: "seller" } as never }); break;
      case "browse":  navigate({ to: "/explore" }); break;
      case "skip":
      default:        navigate({ to: "/home" }); break;
    }
  }
  return <StartIntro onSelect={onSelect} />;
}
