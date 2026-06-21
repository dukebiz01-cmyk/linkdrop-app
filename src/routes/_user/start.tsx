import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import StartIntro from "@/components/start-intro";

export const Route = createFileRoute("/_user/start")({ component: StartPage });

type IntroChoice = "owner" | "creator" | "seller" | "browse" | "skip";

function StartPage() {
  const navigate = useNavigate();
  async function onSelect(choice: IntroChoice) {
    const supabase = await getAuthClient();
    if (supabase) { try { await supabase.rpc("mark_onboarding_complete"); } catch {} }
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
