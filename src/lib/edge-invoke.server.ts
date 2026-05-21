// Edge Function 호출 helper — 서버(API Route) 전용.
// .server.ts suffix → Vite 가 클라이언트 번들에서 제거.
//
// API Route 핸들러가 Supabase Edge Function(extract-meta 등)을 호출할 때 사용.
// accessToken(user JWT)을 넘기면 Authorization 헤더에 실어 보낸다 — Step 6 Edge
// Function 들이 verify_jwt=true 로 복원되면 이 경로로 인증된다.

const SUPABASE_URL =
  (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ??
  (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const PUBLISHABLE_KEY =
  (typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

export type EdgeResult<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: unknown };

/** Supabase Edge Function 을 POST 호출한다. 실패 시 { error } 를 반환(throw 안 함). */
export async function invokeEdge<T = unknown>(
  name: string,
  body: object,
  accessToken?: string | null,
): Promise<EdgeResult<T>> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    return { error: { error: "EDGE_NOT_CONFIGURED", message: "Supabase 환경변수가 비어있어요." } };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLISHABLE_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { data: json as T } : { error: json };
  } catch (e) {
    return { error: { error: "EDGE_FETCH_FAILED", message: String((e as Error).message ?? e) } };
  }
}
