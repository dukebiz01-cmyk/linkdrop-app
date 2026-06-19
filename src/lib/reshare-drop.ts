import { getSupabase } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";

// 재공유 헬퍼 — 탐색 등에서 카드를 카톡으로 "진짜 재공유"(parent 연결) 한다.
//   d.$shareUuid.tsx 의 onKakaoShare(BOOST1-RESHARE) 흐름을 복제(추출 아님 — /d 무영향 보장).
//   백엔드 신규 0: 기존 ld_create_share_edge_v3 + shareToKakao 재사용.
//   거동: 로그인 sender / 무로그인 NULL(ld RPC 가 'anonymous' 처리), best-effort(실패해도 공유는 진행).

const PROD_BASE = "https://app.drop.how";
const SHORT_BASE = "https://drop.how";

// intent/purpose → 카톡 버튼 CTA 라벨. /d onKakaoShare 분기와 동일 규칙(+commerce 매핑).
function ctaTitleForPurpose(purposeRaw: string): string {
  const p = purposeRaw.toLowerCase();
  if (p === "reservation" || p === "예약" || p === "coupon" || p === "쿠폰") {
    return "예약하고 혜택 받기";
  }
  if (p === "purchase" || p === "commerce" || p === "구매") {
    return "상품 보러 가기";
  }
  return "자세히 보기";
}

export async function reshareDrop(opts: {
  shareUuid: string;
  title: string;
  description?: string;
  imageUrl?: string;
  /** intent/purpose 문자열 — CTA 라벨 결정용(없으면 기본 "자세히 보기"). */
  purpose?: string;
}): Promise<void> {
  const { shareUuid, title, description, imageUrl, purpose } = opts;

  let senderUserId: string | null = null;
  let infoDropId: string | null = null;
  let parentId: string | null = null;
  try {
    const supabase = getSupabase();
    // 로그인 사용자면 sender, 무로그인이면 NULL — /d 거동 동일.
    const { data: sess } = await supabase.auth.getSession();
    senderUserId = sess.session?.user.id ?? null;

    // share_events 안전 컬럼(id, info_drop_id)은 v2.4 컬럼 grant 로 select 가능(PII 해시만 차단).
    const { data: parentEvent } = await supabase
      .from("share_events")
      .select("id, info_drop_id")
      .eq("share_uuid", shareUuid)
      .maybeSingle();
    parentId = parentEvent?.id ?? null;
    infoDropId = parentEvent?.info_drop_id ?? null;
  } catch (e) {
    console.warn("[reshareDrop] session/parent lookup failed:", e);
  }

  let reshareLink: string | null = null;
  if (parentId && infoDropId) {
    try {
      const supabase = getSupabase();
      const { data: edgeRows, error: edgeErr } = await supabase.rpc("ld_create_share_edge_v3", {
        p_info_drop_id: infoDropId,
        p_sender_user_id: senderUserId, // null = 무로그인 → 'anonymous'
        p_channel: "kakao",
        p_parent_share_event_id: parentId,
      });
      if (!edgeErr) {
        const row = Array.isArray(edgeRows) ? edgeRows[0] : edgeRows;
        const newCode =
          row && typeof row === "object" && row !== null && "share_code" in row
            ? String((row as { share_code: unknown }).share_code ?? "")
            : "";
        if (newCode) {
          // #27: drop.how 하드코딩 (window.location 금지)
          reshareLink = `${SHORT_BASE}/${newCode}`;
        }
      } else {
        console.warn("[reshareDrop] ld_create_share_edge_v3 failed:", edgeErr);
      }
    } catch (e) {
      console.warn("[reshareDrop] reshare RPC unexpected:", e);
    }
  }

  // 실패/미연결 시 폴백 — 기존 /d 긴 URL (공유 자체는 죽지 않게).
  const linkUrl = reshareLink ?? `${PROD_BASE}/d/${shareUuid}`;
  const ctaTitle = ctaTitleForPurpose(purpose ?? "");

  await shareToKakao({
    title: title || "LinkDrop",
    description: description ?? "",
    imageUrl: imageUrl ?? "",
    linkUrl,
    buttons: [{ title: ctaTitle, link: linkUrl }],
  });
}
