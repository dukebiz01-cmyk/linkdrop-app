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
      navigate({ to: "/create" });
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
      to: "/create",
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

  return (
    <HomePageV3
      activeNavTab="home"
      onStartCreate={handleStartCreate}
      onNavTab={handleNavTab}
    />
  );
}
