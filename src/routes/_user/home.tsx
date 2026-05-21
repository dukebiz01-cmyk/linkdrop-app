import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HomePageV3, type HomePageV3NavTab } from "@/components/home-page-v3";

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

  return (
    <HomePageV3
      isAuthenticated
      activeNavTab="home"
      onCreateDrop={() => navigate({ to: "/create" })}
      onPurposeClick={() => navigate({ to: "/create" })}
      onNavTab={handleNavTab}
    />
  );
}
