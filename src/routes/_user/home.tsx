import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  HomePageV3,
  type HomePageV3NavTab,
  type HomeStartCreateParams,
} from "@/components/home-page-v3";

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  component: HomeRoute,
});

function HomeRoute() {
  const navigate = useNavigate();

  const handleNavTab = (tab: HomePageV3NavTab) => {
    if (tab === "home") return;
    if (tab === "create") {
      navigate({ to: "/create-wizard" });
      return;
    }
    if (tab === "my-drops") {
      navigate({ to: "/profile" });
      return;
    }
    if (tab === "inbox") {
      navigate({ to: "/inbox" });
      return;
    }
    if (tab === "profile") {
      navigate({ to: "/profile" });
    }
  };

  const handleStartCreate = (params: HomeStartCreateParams) => {
    navigate({
      to: "/create-wizard",
      search: {
        url: params.url,
        purpose: params.purpose,
        intent_suggested: params.intent_suggested,
        confidence: params.confidence,
        source_id: params.source_id,
        platform: params.platform,
      } as never,
    });
  };

  // v0 home-page-v3 (#25) 내부 fixed bottom nav 를 CSS 셀렉터로만 숨김. 파일 미편집.
  // home-page-v3.tsx L740 에 fixed bottom-0 가 그 nav 단 한 곳뿐임을 grep 으로 확인 —
  // 이 wrapper 안의 다른 요소를 우발적으로 숨길 위험 없음. N2 공통 nav 가 _user.tsx
  // 에서 별도로 렌더되어 유일 nav 가 됨.
  return (
    <div className="[&_.fixed.bottom-0]:hidden">
      <HomePageV3
        activeNavTab="home"
        onStartCreate={handleStartCreate}
        onNavTab={handleNavTab}
      />
    </div>
  );
}
