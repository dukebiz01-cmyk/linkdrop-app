import { createFileRoute } from "@tanstack/react-router";
import { CardBuilder } from "@/components/create/CardBuilder";

// 새 카드 빌더 — /create-builder. studio.tsx 처럼 thin shell(로더 없음 — _user beforeLoad 가
//   auth 단독 처리, 리다이렉트 루프 방지). URL 은 화면 입력으로 받으므로 search param 불필요.
export const Route = createFileRoute("/_user/create-builder")({
  head: () => ({ meta: [{ title: "새 카드 만들기 — LinkDrop" }] }),
  component: CardBuilder,
});
