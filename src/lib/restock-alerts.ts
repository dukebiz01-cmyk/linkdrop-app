// restock-alerts — 재입고 알림 v1 (FIX-41). drop_alerts 는 본인 RLS 3정책(SELECT/INSERT/DELETE)
//   경유 — UPDATE 정책 없음은 의도(notified 전환 = service_role 전용, v2). 서버 발신 없음:
//   도달은 앱 내 알림함(받은함)에서 읽기 시점 판정만.
//   ⚠️ drop_alerts 는 types.ts 미반영(2026-07-12 선적용) — as never 캐스트(기존 RPC 관례).
// TODO(v2): notified 전환 + 서버 발신(푸시/Edge) — 이 파일에선 구현 금지(FIX-41 락).
import { getSupabase } from "@/lib/supabase";

/** 신청 완료 정직 카피(락) — 푸시·카톡 오해 문구 금지. ST2b /d 배선도 이 정본을 사용할 것. */
export const RESTOCK_ALERT_CONFIRM_COPY =
  "재입고되면 여기 알림함에서 확인할 수 있어요. 앱에 들어오면 보여드릴게요";
/** 중복 신청(UNIQUE 충돌) 정직 카피. */
export const RESTOCK_ALERT_DUPLICATE_COPY = "이미 신청하셨어요";

export type RestockAlertRow = {
  id: string;
  drop_id: string;
  status: string;
  created_at: string;
};

export type RequestRestockResult = "created" | "duplicate" | "unauthenticated" | "error";

/** 신청 — 본인 INSERT. UNIQUE(user_id, drop_id, alert_type) 충돌 = duplicate(정직 처리). */
export async function requestRestockAlert(dropId: string): Promise<RequestRestockResult> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) return "unauthenticated";
  const { error } = await supabase
    .from("drop_alerts" as never)
    .insert({ user_id: userId, drop_id: dropId } as never);
  if (!error) return "created";
  // 23505 = unique_violation — "이미 신청하셨어요" 분기.
  return error.code === "23505" ? "duplicate" : "error";
}

/** 취소 — 본인 DELETE(v1 은 상태 전환이 아닌 행 삭제). */
export async function cancelRestockAlert(dropId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("drop_alerts" as never)
    .delete()
    .eq("drop_id", dropId)
    .eq("alert_type", "restock");
  return !error;
}

/** 내 신청 목록(waiting) — RLS 가 본인 행만 반환. */
export async function listMyRestockAlerts(): Promise<RestockAlertRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("drop_alerts" as never)
    .select("id, drop_id, status, created_at")
    .eq("alert_type", "restock")
    .eq("status", "waiting")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as unknown as RestockAlertRow[] | null) ?? [];
}

/** 재입고 판정(순수 · 읽기 시점) — remaining_stock 파생값 기준.
 *  >0 = 재입고 / 0 = 여전히 품절 / null·undefined = 판정 불가(재고 미설정·조회 실패). */
export function judgeRestock(remainingStock: number | null | undefined): boolean | null {
  if (remainingStock == null || !Number.isFinite(remainingStock)) return null;
  return remainingStock > 0;
}

export type RestockAlertItem = RestockAlertRow & {
  title: string | null;
  thumbnailUrl: string | null;
  /** true=재입고 · false=여전히 품절 · null=판정 불가. */
  restocked: boolean | null;
};

/** 드롭 정보·재입고 판정 결합 — drop_id → share_events(info_drop_id, 공개 read) →
 *  get_drop_detail(remaining_stock 파생 · SECURITY DEFINER). 조회 실패 = 판정 불가(무해). */
export async function enrichRestockAlert(row: RestockAlertRow): Promise<RestockAlertItem> {
  const base: RestockAlertItem = { ...row, title: null, thumbnailUrl: null, restocked: null };
  try {
    const supabase = getSupabase();
    const { data: se } = await supabase
      .from("share_events")
      .select("share_uuid")
      .eq("info_drop_id", row.drop_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const shareUuid = (se as { share_uuid?: string } | null)?.share_uuid;
    if (!shareUuid) return base;
    const { data, error } = await supabase.rpc("get_drop_detail", {
      p_share_uuid: shareUuid,
    } as never);
    if (error || !data) return base;
    const d = data as {
      source?: { title?: string | null; thumbnail_url?: string | null };
      remaining_stock?: number | null;
    };
    return {
      ...base,
      title: d.source?.title ?? null,
      thumbnailUrl: d.source?.thumbnail_url ?? null,
      restocked: judgeRestock(d.remaining_stock),
    };
  } catch {
    return base;
  }
}
