import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Store, CheckCircle2, AlertTriangle } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

/**
 * /partner/register — 파트너(매장) 등록 폼.
 *
 * 4상태 분기 (REGISTER-FORM-FIX):
 *   - myPartner == null              → (A) 등록 폼
 *   - status === "pending"           → (B) 심사 중 안내
 *   - status === "rejected"          → (C) 거절 사유 + 운영자 문의 안내
 *   - status === "approved"          → /partner 로 graceful redirect
 *
 * 저장 값:
 *   - business_type = 선택한 대분류 code (12 중 1, 단일)
 *   - metadata = 세부 복수 선택 시 { sub_categories: [세부code, ...] }  (④-1: 단일→배열)
 *     하위호환: 기존 행의 옛 metadata.sub_category(단일) 도 읽기 측에서 배열로 변환
 *     (예: subs = sub_categories ?? (sub_category ? [sub_category] : [])). 마이그 불필요.
 *   - partner_kind 생략 → DB DEFAULT 'store'
 *   - verification_status 생략 → DEFAULT 'pending'
 *   - owner_user_id = auth.uid()
 *
 * 더블서브밋 방지: submitting state 가드 + 진입부 if + 제출 직전 본인 partner 재확인.
 */

type MajorRow = { code: string; label: string };

type PartnerRow = {
  id: string;
  display_name: string;
  business_type: string | null;
  verification_status: string;
  rejection_reason: string | null;
};

type LoaderData = {
  userId: string | null;
  myPartner: PartnerRow | null;
  majors: MajorRow[];
};

export const Route = createFileRoute("/_partner/partner/register")({
  head: () => ({ meta: [{ title: "파트너 등록 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { userId: null, myPartner: null, majors: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name, business_type, verification_status, rejection_reason")
      .eq("owner_user_id", userId)
      .maybeSingle();

    const { data: majors } = await supabase
      .from("business_categories")
      .select("code, label")
      .eq("depth", 1)
      .order("sort_order");

    return {
      userId,
      myPartner: (partner as PartnerRow | null) ?? null,
      majors: (majors as MajorRow[] | null) ?? [],
    };
  },
  component: RegisterPage,
});

function RegisterPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();

  // (D) approved 상태로 register 에 들어오면 /partner 로 graceful redirect
  useEffect(() => {
    if (data.myPartner?.verification_status === "approved") {
      navigate({ to: "/partner" });
    }
  }, [data.myPartner?.verification_status, navigate]);

  if (!data.userId) {
    return <SimpleNotice text="로그인이 필요해요." />;
  }

  const status = data.myPartner?.verification_status;

  if (status === "pending") {
    return <PendingView name={data.myPartner?.display_name ?? ""} />;
  }

  if (status === "rejected") {
    return (
      <RejectedView
        name={data.myPartner?.display_name ?? ""}
        reason={data.myPartner?.rejection_reason ?? null}
      />
    );
  }

  if (status === "approved") {
    // redirect 가 작동하기 직전 잠깐 보이는 fallback
    return <SimpleNotice text="매장 관리로 이동 중이에요…" />;
  }

  // (A) myPartner == null → 등록 폼
  return (
    <RegisterForm
      userId={data.userId}
      majors={data.majors}
      onSubmitted={async () => {
        await router.invalidate();
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────
// (A) 등록 폼
// ─────────────────────────────────────────────────────────
function RegisterForm({
  userId,
  majors,
  onSubmitted,
}: {
  userId: string;
  majors: MajorRow[];
  onSubmitted: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [selectedMajor, setSelectedMajor] = useState<string>("");
  const [subs, setSubs] = useState<MajorRow[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]); // ④-1: 복수 선택
  const [contactPhone, setContactPhone] = useState("");
  const [businessNo, setBusinessNo] = useState("");
  const [reservationUrl, setReservationUrl] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 대분류 선택 시 세부 로드
  useEffect(() => {
    if (!selectedMajor) {
      setSubs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await getSupabase()
        .from("business_categories")
        .select("code, label")
        .eq("parent_code", selectedMajor)
        .order("sort_order");
      if (!cancelled) setSubs((data as MajorRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMajor]);

  function handleMajorClick(code: string) {
    if (code === selectedMajor) return;
    setSelectedMajor(code);
    setSelectedSubs([]); // 대분류 바뀌면 세부 선택 모두 초기화
  }

  function toggleSub(code: string) {
    setSelectedSubs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function validate(): string | null {
    if (!displayName.trim()) return "매장 이름을 입력해 주세요.";
    if (!selectedMajor) return "업종을 선택해 주세요.";
    const phoneDigits = contactPhone.replace(/[^0-9]/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      return "연락처를 정확히 입력해 주세요.";
    }
    const bnDigits = businessNo.replace(/[^0-9]/g, "");
    if (bnDigits.length !== 10) {
      return "사업자번호 10자리를 입력해 주세요.";
    }
    if (reservationUrl && !/^https?:\/\//.test(reservationUrl.trim())) {
      return "예약 URL은 http:// 또는 https:// 로 시작해야 해요.";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // 진입 가드
    const v = validate();
    if (v) {
      toast.error(v);
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabase();

      // 더블서브밋 방어: 제출 직전 본인 partner 재확인 (다른 탭/이전 제출로 이미 생성됐을 수도)
      const { data: exist } = await supabase
        .from("partners")
        .select("id")
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (exist) {
        toast.success("이미 등록된 매장이 있어요. 심사를 기다려 주세요.");
        await onSubmitted();
        return;
      }

      const phoneDigits = contactPhone.replace(/[^0-9]/g, "");
      const bnDigits = businessNo.replace(/[^0-9]/g, "");
      const payload: Record<string, unknown> = {
        owner_user_id: userId,
        display_name: displayName.trim(),
        business_type: selectedMajor, // 대분류 code (12 중 1)
        contact_phone: phoneDigits,
        business_no: bnDigits,
        reservation_url: reservationUrl.trim() || null,
        address: address.trim() || null,
        // ④-1: 배열 저장. 빈 배열일 땐 metadata={} (옛 sub_category 키도 안 씀)
        metadata: selectedSubs.length > 0 ? { sub_categories: selectedSubs } : {},
        // partner_kind 생략 → DEFAULT 'store'
        // verification_status 생략 → DEFAULT 'pending'
      };

      const { error } = await supabase.from("partners").insert(payload);
      if (error) {
        console.error("[partner.register] insert failed:", error);
        toast.error("등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("매장 등록 신청이 완료됐어요.");
      await onSubmitted();
    } catch (err) {
      console.error("[partner.register] unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <h1 className="text-lg font-bold text-[#0F172A]">파트너 등록</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          매장 정보를 입력하면 운영자 확인 후 승인돼요
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 px-5 pt-4">
        <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4">
          {/* 매장 이름 */}
          <div className="space-y-2">
            <label
              htmlFor="rg-name"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              매장 이름
            </label>
            <input
              id="rg-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 노을재 캠핑장"
              maxLength={80}
              className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
              required
            />
          </div>

          {/* 업종 — 대분류 */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-[#0F172A]">
              업종 (대분류)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {majors.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => handleMajorClick(m.code)}
                  className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold ${
                    selectedMajor === m.code
                      ? "border-[#0A0A0A] bg-[#FAFAFA] text-[#0A0A0A]"
                      : "border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 업종 — 세부 (대분류 선택 시, ④-1: 복수 선택 가능) */}
          {selectedMajor && subs.length > 0 ? (
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#0F172A]">
                세부 업종{" "}
                <span className="font-medium text-[#94A3B8]">
                  (선택 · 여러 개 가능)
                </span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                {subs.map((s) => {
                  const isSelected = selectedSubs.includes(s.code);
                  return (
                    <button
                      key={s.code}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      onClick={() => toggleSub(s.code)}
                      className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${
                        isSelected
                          ? "border-[#0A0A0A] bg-[#FAFAFA] text-[#0A0A0A]"
                          : "border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                          isSelected
                            ? "border-[#0A0A0A] bg-[#0A0A0A] text-white"
                            : "border-[#CBD5E1] bg-white"
                        }`}
                        aria-hidden
                      >
                        {isSelected ? (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            className="size-3.5"
                          >
                            <path
                              d="M5 10.5l3 3 7-7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                      <span className="flex-1 truncate text-left">
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedSubs.length > 0 ? (
                <p className="text-[11px] text-[#64748B]">
                  선택된 세부 {selectedSubs.length}개
                </p>
              ) : null}
            </div>
          ) : null}

          {/* 연락처 */}
          <div className="space-y-2">
            <label
              htmlFor="rg-phone"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              연락처
            </label>
            <input
              id="rg-phone"
              type="tel"
              inputMode="numeric"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="예: 010-1234-5678"
              className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
              required
            />
          </div>

          {/* 사업자번호 */}
          <div className="space-y-2">
            <label
              htmlFor="rg-bn"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              사업자번호
            </label>
            <input
              id="rg-bn"
              type="text"
              inputMode="numeric"
              value={businessNo}
              onChange={(e) => setBusinessNo(e.target.value)}
              placeholder="예: 123-45-67890"
              className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
              required
            />
          </div>

          {/* 예약 URL */}
          <div className="space-y-2">
            <label
              htmlFor="rg-url"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              예약 URL{" "}
              <span className="font-medium text-[#94A3B8]">(선택)</span>
            </label>
            <input
              id="rg-url"
              type="url"
              value={reservationUrl}
              onChange={(e) => setReservationUrl(e.target.value)}
              placeholder="https://booking.naver.com/..."
              className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
            />
            <p className="text-[11px] text-[#94A3B8]">
              네이버 예약 페이지 주소
            </p>
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <label
              htmlFor="rg-addr"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              주소 <span className="font-medium text-[#94A3B8]">(선택)</span>
            </label>
            <input
              id="rg-addr"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 강원도 양양군 …"
              className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Store className="size-4" strokeWidth={2} />
            {submitting ? "등록 중…" : "매장 등록 신청"}
          </button>
        </section>
      </form>

      <Toaster richColors position="top-center" />
    </main>
  );
}

// ─────────────────────────────────────────────────────────
// (B) 심사 중
// ─────────────────────────────────────────────────────────
function PendingView({ name }: { name: string }) {
  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <h1 className="text-lg font-bold text-[#0F172A]">심사 중</h1>
      </header>
      <div className="px-5 pt-8">
        <section className="rounded-2xl bg-white p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#FAFAFA]">
            <CheckCircle2 className="size-7 text-[#0A0A0A]" strokeWidth={2} />
          </span>
          <h2 className="text-base font-bold text-[#0F172A]">
            매장 등록 신청이 완료됐어요
          </h2>
          <p className="text-sm leading-relaxed text-[#475569]">
            <strong className="text-[#0F172A]">{name || "신청하신 매장"}</strong>{" "}
            정보를 운영자가 확인 중이에요.
            <br />
            승인되면 다음 접속 시 매장 관리로 들어갈 수 있어요.
          </p>
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────
// (C) 거절
// ─────────────────────────────────────────────────────────
function RejectedView({
  name,
  reason,
}: {
  name: string;
  reason: string | null;
}) {
  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <h1 className="text-lg font-bold text-[#0F172A]">등록 거절</h1>
      </header>
      <div className="px-5 pt-8 space-y-4">
        <section className="rounded-2xl bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#FEF2F2]">
            <AlertTriangle className="size-6 text-[#EF4444]" strokeWidth={2} />
          </span>
          <h2 className="text-base font-bold text-[#0F172A]">
            {name || "신청하신 매장"} 등록이 거절됐어요
          </h2>
          {reason ? (
            <div className="rounded-xl bg-[#F8FAFC] p-3">
              <p className="text-xs font-semibold text-[#64748B]">거절 사유</p>
              <p className="mt-1 text-sm text-[#0F172A]">{reason}</p>
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-[#64748B]">
            궁금한 점은 운영자에게 문의해 주세요.
          </p>
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────
// 공용 안내
// ─────────────────────────────────────────────────────────
function SimpleNotice({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] tracking-ko px-6">
      <p className="text-sm text-[#475569]">{text}</p>
    </main>
  );
}
