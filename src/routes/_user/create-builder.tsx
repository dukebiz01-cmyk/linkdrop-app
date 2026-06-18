import { createFileRoute } from "@tanstack/react-router";
import { CardBuilder } from "@/components/create/CardBuilder";

// 새 카드 빌더 — /create-builder. studio.tsx 처럼 thin shell(로더 없음 — _user beforeLoad 가
//   auth 단독 처리, 리다이렉트 루프 방지). URL 은 화면 입력으로 받으므로 search param 불필요.
export const Route = createFileRoute("/_user/create-builder")({
  head: () => ({ meta: [{ title: "새 카드 만들기 — LinkDrop" }] }),
  component: CreateBuilderPage,
});

function CreateBuilderPage() {
  // 저장 책임 = 라우트(위저드와 동일 패턴). create-wizard 의 onComplete /api/drops→create_drop_v2
  //   호출을 그대로 미러링. 이번 단계 = 정보 목적·영상 소스만 → blocks/price/partner/funnel 없음.
  return (
    <CardBuilder
      onComplete={async (data) => {
        const res = await fetch("/api/drops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_url: data.video.url,
            purpose: data.purpose,
            curator_message: data.makerMessage || null,
          }),
        });
        const json = (await res.json()) as {
          drop?: { id?: string; share_uuid?: string };
          shareable_url?: string;
          message?: string;
        };
        if (!res.ok || !json.drop?.share_uuid) {
          throw new Error(json.message ?? "DROP_CREATE_FAILED");
        }
        const shareUuid = json.drop.share_uuid;
        // 서버 단축 URL 우선, 없으면 현재 origin 기준 긴 URL (위저드와 동일 폴백).
        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
        const shareUrl = json.shareable_url ?? `${origin}/d/${shareUuid}`;
        return { shareUuid, shareUrl };
      }}
    />
  );
}
