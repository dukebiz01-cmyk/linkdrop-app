import { createFileRoute } from "@tanstack/react-router";
import { SignupTerms } from "@/components/signup-terms";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <SignupTerms onComplete={(agreed) => console.log("agreed:", agreed)} />
    </div>
  );
}
