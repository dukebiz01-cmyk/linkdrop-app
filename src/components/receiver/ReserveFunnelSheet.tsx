import { useEffect, useState } from "react";
import { Calendar, Users, Phone, User, MessageSquare, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getSupabase } from "@/lib/supabase";

/**
 * H1-d funnel — 예약 문의 + 쿠폰 받기 시트.
 *
 * 흐름 (4 step):
 *   1. form  — 날짜·인원·이름·전화·메시지 입력
 *   2. submitting — create_reservation_anon → claim_coupon 순차 호출
 *   3. done  — 완료 화면 (claim_code 안내)
 *   4. error — 에러 화면 (재시도)
 *
 * 인자:
 *   - shareUuid: 현재 share_event 의 share_uuid (share_events.id 조회용)
 *   - dropId: info_drops.id
 *   - coupon: get_drop_detail.coupon (null 이면 시트 자체가 렌더 안 되어야 함 — 부모가 가드)
 *   - userId: 로그인한 catcher_user_id
 *
 * RPC:
 *   - create_reservation_anon(13인자, SECURITY DEFINER, partner_id 는 info_drops 에서
 *     자동 추출. info_drops.partner_id 가 NULL 이면 RAISE EXCEPTION — v5.6a 백필로 노을재
 *     drops 는 모두 채워짐).
 *   - claim_coupon(p_coupon_id, p_share_event_id, p_catcher_user_id) → claim_code 발급.
 *
 * 보존: 네이버 예약(onPrimaryAction)·F1 카톡 공유·E2 트래커 무영향. /me 받은 혜택은
 *     coupon_claims.catcher_user_id = userId 로 자동 노출.
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUuid: string;
  dropId: string;
  coupon: { id: string; title: string };
  userId: string;
};

type Step = "form" | "submitting" | "done" | "error";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export function ReserveFunnelSheet({
  open,
  onOpenChange,
  shareUuid,
  dropId,
  coupon,
  userId,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("form");
      setErrorMsg(null);
      setClaimCode(null);
    }
  }, [open]);

  const isMultiNight = checkOut.length > 0 && checkOut !== checkIn;

  function validate(): string | null {
    if (!checkIn) return "체크인 날짜를 선택해 주세요.";
    if (checkOut && checkOut < checkIn) return "체크아웃이 체크인보다 빠를 수 없어요.";
    const gc = Number(guestCount);
    if (!Number.isFinite(gc) || gc < 1) return "인원을 정확히 입력해 주세요.";
    if (!name.trim()) return "이름을 입력해 주세요.";
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits.length < 9 || phoneDigits.length > 11) return "전화번호를 정확히 입력해 주세요.";
    return null;
  }

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setErrorMsg(v);
      return;
    }
    setErrorMsg(null);
    setStep("submitting");
    try {
      const supabase = getSupabase();
      const phoneDigits = normalizePhone(phone);
      const phoneHash = await sha256Hex(phoneDigits);
      const phoneLast4 = phoneDigits.slice(-4);
      // RSV-FIX1 — 안정적 anonymous_id (E2 이벤트 추적과 같은 localStorage 키 재사용).
      // visitors row 사전 생성 없이 random UUID 를 그대로 p_visitor_id 로 보내면
      // reservations.visitor_id_fkey → visitors(id) FK 위반으로 INSERT 실패.
      let anonId: string;
      try {
        anonId = localStorage.getItem("ld_visitor_id") ?? "";
        if (!anonId) {
          anonId = crypto.randomUUID();
          localStorage.setItem("ld_visitor_id", anonId);
        }
      } catch {
        anonId = crypto.randomUUID(); // 시크릿 모드 등 localStorage 차단 → 메모리 fallback
      }
      // RSV-FIX2 — 캠핑 파일럿: 단일·연박 모두 날짜 범위로 통일.
      // 제약 reservations_calendar_mode_check = ANY (ARRAY['date_range','date_time_slot']).
      // 이전엔 짧은 별명 "range"/"single" 을 보내 23514 위반 → INSERT 실패.
      // date_time_slot 은 시간 슬롯 예약(식당/미용실)용 — 캠핑은 p_time_slot 미사용.
      const calendarMode = "date_range";

      // share_uuid → share_events.id (RLS: shares_public_read_by_uuid 로 anon 가능).
      const { data: se, error: seErr } = await supabase
        .from("share_events")
        .select("id")
        .eq("share_uuid", shareUuid)
        .maybeSingle();
      if (seErr || !se?.id) {
        console.error("[ReserveFunnel] share_event lookup failed:", seErr);
        setErrorMsg("공유 정보를 찾을 수 없어요. 다시 시도해 주세요.");
        setStep("error");
        return;
      }
      const shareEventId = se.id;

      // RSV-FIX1 — visitors row 사전 생성 (FK 충족용). upsert_visitor 가 같은
      // anonymous_id 면 기존 행 반환 + last_seen_at 갱신.
      const { data: visitorUuid, error: vErr } = await supabase.rpc("upsert_visitor", {
        p_anonymous_id: anonId,
        p_metadata: {},
      });
      if (vErr || !visitorUuid) {
        console.error("[ReserveFunnel] upsert_visitor failed:", vErr);
        setErrorMsg("예약 문의 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setStep("error");
        return;
      }

      const { error: resErr } = await supabase.rpc("create_reservation_anon", {
        p_drop_id: dropId,
        p_share_event_id: shareEventId,
        p_visitor_id: visitorUuid,
        p_calendar_mode: calendarMode,
        p_reserved_date: isMultiNight ? null : checkIn,
        p_time_slot: null,
        p_check_in_date: checkIn,
        p_check_out_date: isMultiNight ? checkOut : null,
        p_guest_count: Number(guestCount),
        p_name: name.trim(),
        p_phone_hash: phoneHash,
        p_phone_last4: phoneLast4,
        p_customer_message: message.trim() || null,
      });
      if (resErr) {
        console.error("[ReserveFunnel] create_reservation_anon failed:", resErr);
        setErrorMsg("예약 문의 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setStep("error");
        return;
      }

      const { data: claim, error: claimErr } = await supabase.rpc("claim_coupon", {
        p_coupon_id: coupon.id,
        p_share_event_id: shareEventId,
        p_catcher_user_id: userId,
      });
      if (claimErr) {
        console.error("[ReserveFunnel] claim_coupon failed:", claimErr);
        // 예약은 성공했으므로 done 으로 가되 쿠폰 코드는 안내 메시지로 대체
        setClaimCode(null);
        setStep("done");
        return;
      }
      const firstRow = Array.isArray(claim) ? claim[0] : null;
      const codeFromRpc =
        firstRow && typeof firstRow === "object" && firstRow !== null && "claim_code" in firstRow
          ? String((firstRow as { claim_code: unknown }).claim_code ?? "")
          : null;
      setClaimCode(codeFromRpc || null);
      setStep("done");
    } catch (e) {
      console.error("[ReserveFunnel] unexpected:", e);
      setErrorMsg("처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
      setStep("error");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6 tracking-ko">
        {step === "form" ? (
          <FormBody
            checkIn={checkIn}
            setCheckIn={setCheckIn}
            checkOut={checkOut}
            setCheckOut={setCheckOut}
            guestCount={guestCount}
            setGuestCount={setGuestCount}
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            message={message}
            setMessage={setMessage}
            errorMsg={errorMsg}
            couponTitle={coupon.title}
            onSubmit={handleSubmit}
          />
        ) : step === "submitting" ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <span
              className="size-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#2563EB]"
              aria-hidden
            />
            <p className="text-sm font-semibold text-[#0F172A]">예약 문의를 보내고 있어요…</p>
          </div>
        ) : step === "done" ? (
          <DoneBody
            couponTitle={coupon.title}
            claimCode={claimCode}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <ErrorBody errorMsg={errorMsg} onRetry={() => setStep("form")} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#0F172A]">
      {children}
    </label>
  );
}

function FormBody(props: {
  checkIn: string;
  setCheckIn: (v: string) => void;
  checkOut: string;
  setCheckOut: (v: string) => void;
  guestCount: string;
  setGuestCount: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  errorMsg: string | null;
  couponTitle: string;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-bold text-[#0F172A]">예약 문의하기</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          보내드리면 사장님이 확인 후 카톡으로 연락드려요.
          <br />
          제출과 함께 <strong className="text-[#2563EB]">{props.couponTitle}</strong> 쿠폰이 발급돼요.
        </p>
      </header>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <Label htmlFor="check-in">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 text-[#94A3B8]" strokeWidth={2} />
              체크인
            </span>
          </Label>
          <input
            id="check-in"
            type="date"
            value={props.checkIn}
            onChange={(e) => props.setCheckIn(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>

        <div>
          <Label htmlFor="check-out">체크아웃 (연박이면 입력)</Label>
          <input
            id="check-out"
            type="date"
            value={props.checkOut}
            onChange={(e) => props.setCheckOut(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>

        <div>
          <Label htmlFor="guest-count">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-[#94A3B8]" strokeWidth={2} />
              인원
            </span>
          </Label>
          <input
            id="guest-count"
            type="number"
            inputMode="numeric"
            min={1}
            value={props.guestCount}
            onChange={(e) => props.setGuestCount(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>

        <div>
          <Label htmlFor="reservation-name">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4 text-[#94A3B8]" strokeWidth={2} />
              이름
            </span>
          </Label>
          <input
            id="reservation-name"
            type="text"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="예: 홍길동"
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>

        <div>
          <Label htmlFor="reservation-phone">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4 text-[#94A3B8]" strokeWidth={2} />
              전화번호
            </span>
          </Label>
          <input
            id="reservation-phone"
            type="tel"
            inputMode="numeric"
            value={props.phone}
            onChange={(e) => props.setPhone(e.target.value)}
            placeholder="예: 010-1234-5678"
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>

        <div>
          <Label htmlFor="reservation-message">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-4 text-[#94A3B8]" strokeWidth={2} />
              남기실 말 (선택)
            </span>
          </Label>
          <textarea
            id="reservation-message"
            value={props.message}
            onChange={(e) => props.setMessage(e.target.value)}
            rows={3}
            placeholder="문의사항을 남겨주세요"
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>
      </div>

      {props.errorMsg ? (
        <p className="text-sm font-medium text-[#EF4444]">{props.errorMsg}</p>
      ) : null}

      <button
        type="button"
        onClick={props.onSubmit}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#2563EB] px-6 py-3 text-base font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]"
      >
        예약 문의 보내기
      </button>
    </div>
  );
}

function DoneBody({
  couponTitle,
  claimCode,
  onClose,
}: {
  couponTitle: string;
  claimCode: string | null;
  onClose: () => void;
}) {
  return (
    <div className="space-y-5 pt-2">
      <div className="flex justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[#ECFDF5]">
          <CheckCircle2 className="size-7 text-[#059669]" strokeWidth={2} />
        </span>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-[#0F172A]">예약 문의 접수됐어요</h2>
        <p className="mt-2 text-sm text-[#475569]">사장님 확인 후 카톡으로 연락드려요.</p>
      </div>
      <div className="rounded-2xl bg-[#F8FAFC] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">받은 쿠폰</p>
        <p className="mt-1 text-base font-bold text-[#0F172A]">{couponTitle}</p>
        {claimCode ? (
          <p className="mt-2 text-xs text-[#64748B]">
            쿠폰 코드 <span className="font-mono font-bold text-[#0F172A]">{claimCode}</span>
            <br />
            방문 시 사장님께 보여주세요.
          </p>
        ) : (
          <p className="mt-2 text-xs text-[#64748B]">받은 혜택은 마이페이지에서 확인할 수 있어요.</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#2563EB] px-6 py-3 text-base font-bold text-white"
      >
        확인
      </button>
    </div>
  );
}

function ErrorBody({ errorMsg, onRetry }: { errorMsg: string | null; onRetry: () => void }) {
  return (
    <div className="space-y-4 py-6 text-center">
      <h2 className="text-lg font-bold text-[#0F172A]">처리에 실패했어요</h2>
      <p className="text-sm text-[#475569]">
        {errorMsg ?? "잠시 후 다시 시도해 주세요."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#2563EB] px-6 py-3 text-base font-bold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
