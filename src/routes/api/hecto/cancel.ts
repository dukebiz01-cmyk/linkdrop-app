// GET·POST /api/hecto/cancel — 헥토 결제창 취소/실패 리턴(cancUrl) 수신 (v1.5.3).
//   사용자가 결제창을 닫거나 결제가 실패하면 이 URL 로 form POST(일부 흐름은 GET 재진입).
//   수신 파라미터를 구조화 로그로 남기고, 사람이 보는 HTML 결과 페이지를 응답한다(빈 창/405 방지). (주문 확정과 무관)
import { createFileRoute } from "@tanstack/react-router";

/** POST=form / GET=query 에서 평문 문자열 필드 맵 추출. */
async function readParams(request: Request): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};
  if (request.method === "POST") {
    try {
      const form = await request.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") fields[k] = v;
      }
    } catch {
      // form 이 아닌 경우(빈 body 등) — 무시.
    }
  } else {
    for (const [k, v] of new URL(request.url).searchParams.entries()) fields[k] = v;
  }
  return fields;
}

/** HTML 텍스트 노드 이스케이프(파라미터를 화면에 안전하게 표기). */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(fields: Record<string, string>): string {
  const outStatCd = esc(fields.outStatCd ?? "");
  const mchtTrdNo = esc(fields.mchtTrdNo ?? "");
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>결제 취소/실패</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F1F5F9;color:#0F172A}.card{max-width:360px;padding:32px;text-align:center}.h{font-size:18px;font-weight:700;margin:0 0 12px}.p{font-size:14px;line-height:1.6;color:#64748B;margin:0 0 16px}.meta{font-size:12px;color:#94A3B8}</style>
</head><body><div class="card">
<div class="h">결제가 취소/실패되었습니다</div>
<div class="p">결제가 완료되지 않았습니다.<br>이 창은 닫으셔도 됩니다.</div>
<div class="meta">상태 ${outStatCd || "-"} · 주문 ${mchtTrdNo || "-"}</div>
</div><script>try{window.close()}catch(e){}</script></body></html>`;
}

async function handle(request: Request): Promise<Response> {
  const fields = await readParams(request);
  console.log(
    JSON.stringify({
      tag: "[api/hecto/cancel]",
      method: request.method,
      outStatCd: fields.outStatCd ?? "",
      outRsltCd: fields.outRsltCd ?? "",
      outRsltMsg: fields.outRsltMsg ?? "",
      mchtId: fields.mchtId ?? "",
      mchtTrdNo: fields.mchtTrdNo ?? "",
      fieldKeys: Object.keys(fields),
    }),
  );
  return new Response(renderHtml(fields), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/hecto/cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
