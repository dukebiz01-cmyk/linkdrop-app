import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import {
  ProductRegisterForm,
  type ProductRegisterPayload,
  type ProductRegisterResult,
} from "@/components/commerce/ProductRegisterForm";

// S2 — 매장관리 상품등록(프론트만). 폼 본체는 P1에서 ProductRegisterForm(공용)으로 추출.
//   이 라우트는 페이지 래퍼(레이아웃/타이틀/back-nav)와 저장 핸들러(/api/drops insert)만 소유.
//   RLS(S1, v7.5): 업로드 경로 첫 segment = auth.uid() (컴포넌트 내부에서 처리).

export const Route = createFileRoute("/_partner/partner/products/new")({
  head: () => ({ meta: [{ title: "상품 등록 — LinkDrop" }] }),
  component: ProductNewPage,
});

// 저장 핸들러 — S2b 자체업로드 분기(POST /api/drops, self_upload:true). 로직·payload 구조 P1 이전 그대로.
async function submitProduct(payload: ProductRegisterPayload): Promise<ProductRegisterResult> {
  const res = await fetch("/api/drops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as {
    drop?: { share_uuid?: string };
    shareable_url?: string;
    message?: string;
  };
  if (!res.ok || !json.drop?.share_uuid) {
    throw new Error(json.message ?? "DROP_CREATE_FAILED");
  }
  return {
    shareUuid: json.drop.share_uuid,
    shareUrl: json.shareable_url ?? `https://app.drop.how/d/${json.drop.share_uuid}`,
  };
}

function ProductNewPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          매장 홈
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">상품 등록</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">상품 사진과 가격을 등록해요</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        <ProductRegisterForm onSubmit={submitProduct} />
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
