import { useState } from "react";
import { ChevronRight, ChevronDown, ChevronUp, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const TERMS_CONTENT: Record<string, string> = {
  terms:
    "서비스 이용약관\n\n법률 전문가 검토 후 최종본으로 교체 예정입니다.\n\n현재 버전: v1.0 초안",
  privacy:
    "개인정보처리방침\n\n법률 전문가 검토 후 최종본으로 교체 예정입니다.\n\n현재 버전: v1.0 초안",
  notice:
    "서비스 고지\n\n법률 전문가 검토 후 최종본으로 교체 예정입니다.",
  adNotice:
    "광고·제휴 자동 고지 정책\n\n법률 전문가 검토 후 최종본으로 교체 예정입니다.",
  rights:
    "권리침해 신고·삭제 정책\n\n법률 전문가 검토 후 최종본으로 교체 예정입니다.",
};

const REQ_KEYS = ["age","terms","privacy","notice","adNotice","rights"] as const;

type CheckState = Record<string, boolean>;

function CircleCheck({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: "50%",
      background: on ? "#2563EB" : "transparent",
      border: on ? "none" : "1.5px solid #D4D4D4",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, transition: "all .15s",
    }}>
      {on && <Check size={12} color="#fff" strokeWidth={3} />}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 50, height: 28, borderRadius: 14,
      background: on ? "#2563EB" : "#E5E5E5",
      position: "relative", transition: "background .2s", flexShrink: 0,
    }}>
      <div style={{
        width: 22, height: 22, background: "#fff", borderRadius: "50%",
        position: "absolute", top: 3, left: on ? 25 : 3, transition: "left .2s",
        boxShadow: "0 1px 4px rgba(0,0,0,.15)",
      }} />
    </div>
  );
}

interface ItemRowProps {
  id: string;
  label: string;
  tag: "필수" | "선택";
  checked: boolean;
  onToggle: (id: string) => void;
  showDetail?: boolean;
  detailKey?: string;
  detailTitle?: string;
  onDetail?: (key: string, title: string) => void;
}

function ItemRow({ id, label, tag, checked, onToggle, showDetail, detailKey, detailTitle, onDetail }: ItemRowProps) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 0", borderBottom: "0.5px solid #F5F5F5", cursor: "pointer",
      }}
      onClick={() => onToggle(id)}
    >
      <CircleCheck on={checked} />
      <div style={{
        flex: 1, fontSize: 14, fontWeight: 500, color: "#0A0A0A",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {label}
        <span style={{
          fontSize: 10, fontWeight: 800, padding: "2px 5px", borderRadius: 4,
          background: tag === "필수" ? "#FEF2F2" : "#EFF6FF",
          color: tag === "필수" ? "#DC2626" : "#2563EB",
        }}>
          {tag}
        </span>
      </div>
      {showDetail && detailKey && onDetail && (
        <div
          style={{
            fontSize: 12, color: "#A3A3A3",
            display: "flex", alignItems: "center", flexShrink: 0,
          }}
          onClick={(e) => { e.stopPropagation(); onDetail(detailKey, detailTitle!); }}
        >
          전문 <ChevronRight size={14} />
        </div>
      )}
    </div>
  );
}

export function SignupTerms({
  onComplete,
}: {
  onComplete?: (agreed: CheckState) => void;
}) {
  const [checked, setChecked] = useState<CheckState>({
    age: false, terms: false, privacy: false,
    notice: false, adNotice: false, rights: false,
    ad: false, reward: false,
  });
  const [adOpen, setAdOpen] = useState(false);
  const [adChannels, setAdChannels] = useState<Record<string, boolean>>({
    email: false, sms: false, kakao: false, push: false,
  });
  const [sheet, setSheet] = useState<{ open: boolean; key: string; title: string }>({
    open: false, key: "", title: "",
  });

  const toggle = (key: string) =>
    setChecked((p) => ({ ...p, [key]: !p[key] }));

  const allReqDone = REQ_KEYS.every((k) => checked[k]);
  const allDone = allReqDone && checked.ad && checked.reward;

  const toggleAll = () => {
    const v = !allDone;
    setChecked({ age: v, terms: v, privacy: v, notice: v, adNotice: v, rights: v, ad: v, reward: v });
    setAdChannels({ email: v, sms: v, kakao: v, push: v });
    if (v) setAdOpen(true);
  };

  const openSheet = (key: string, title: string) =>
    setSheet({ open: true, key, title });

  const WRAP: React.CSSProperties = {
    background: "#fff", minHeight: "100vh", maxWidth: 480,
    margin: "0 auto", padding: "0 0 40px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif",
  };

  const SEC: React.CSSProperties = { padding: "0 20px" };
  const DIVIDER: React.CSSProperties = { height: 1, background: "#F5F5F5", margin: "16px 0 8px" };
  const GROUP_LABEL: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "#A3A3A3",
    letterSpacing: "0.04em", marginBottom: 4,
  };

  return (
    <div style={WRAP}>
      {/* Header */}
      <div style={{ padding: "32px 20px 8px" }}>
        <div style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, marginBottom: 8 }}>
          회원가입
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0A0A0A", letterSpacing: "-0.04em", lineHeight: 1.3, marginBottom: 6 }}>
          서비스 이용에<br />동의해 주세요
        </div>
        <div style={{ fontSize: 14, color: "#525252", lineHeight: 1.5 }}>
          필수 항목에만 동의하면 바로 시작할 수 있어요
        </div>
      </div>

      <div style={SEC}>
        {/* 전체 동의 토글 */}
        <div
          onClick={toggleAll}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#FAFAFA", borderRadius: 14, padding: "16px 18px",
            marginTop: 16, cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A" }}>약관 전체 동의</span>
          <Toggle on={allDone} />
        </div>

        {/* 필수 */}
        <div style={DIVIDER} />
        <div style={GROUP_LABEL}>필수</div>
        <ItemRow id="age" label="만 14세 이상입니다" tag="필수" checked={checked.age} onToggle={toggle} />
        <ItemRow id="terms" label="서비스 이용약관 동의" tag="필수" checked={checked.terms} onToggle={toggle} showDetail detailKey="terms" detailTitle="서비스 이용약관" onDetail={openSheet} />
        <ItemRow id="privacy" label="개인정보 수집·이용 동의" tag="필수" checked={checked.privacy} onToggle={toggle} showDetail detailKey="privacy" detailTitle="개인정보처리방침" onDetail={openSheet} />
        <ItemRow id="notice" label="서비스 고지 확인" tag="필수" checked={checked.notice} onToggle={toggle} showDetail detailKey="notice" detailTitle="서비스 고지" onDetail={openSheet} />
        <ItemRow id="adNotice" label="광고·제휴 자동 고지 확인" tag="필수" checked={checked.adNotice} onToggle={toggle} showDetail detailKey="adNotice" detailTitle="광고·제휴 자동 고지 정책" onDetail={openSheet} />
        <ItemRow id="rights" label="권리침해 신고·삭제 정책 확인" tag="필수" checked={checked.rights} onToggle={toggle} showDetail detailKey="rights" detailTitle="권리침해 신고·삭제 정책" onDetail={openSheet} />

        {/* 선택 */}
        <div style={DIVIDER} />
        <div style={GROUP_LABEL}>선택</div>

        {/* 광고 수신 */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: "0.5px solid #F5F5F5", cursor: "pointer" }}
          onClick={() => { toggle("ad"); setAdOpen((p) => !p); }}
        >
          <CircleCheck on={!!checked.ad} />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#0A0A0A", display: "flex", alignItems: "center", gap: 6 }}>
            광고성 정보 수신 동의
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 5px", borderRadius: 4, background: "#EFF6FF", color: "#2563EB" }}>선택</span>
          </div>
          {adOpen ? <ChevronUp size={16} color="#A3A3A3" /> : <ChevronDown size={16} color="#A3A3A3" />}
        </div>

        {adOpen && (
          <div style={{ marginLeft: 34, borderLeft: "1.5px solid #F5F5F5", paddingLeft: 12, marginBottom: 4 }}>
            {(["email","sms","kakao","push"] as const).map((ch) => (
              <div
                key={ch}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "0.5px solid #F5F5F5", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setAdChannels((p) => ({ ...p, [ch]: !p[ch] })); setChecked((p) => ({ ...p, ad: true })); }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 4, background: adChannels[ch] ? "#2563EB" : "transparent", border: adChannels[ch] ? "none" : "1.5px solid #D4D4D4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {adChannels[ch] && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: 13, color: "#525252" }}>
                  {ch === "email" ? "이메일" : ch === "sms" ? "문자/SMS" : ch === "kakao" ? "카카오 알림" : "앱 푸시"}
                </span>
              </div>
            ))}
          </div>
        )}

        <ItemRow id="reward" label="전환 로열티·혜택 프로그램 참여" tag="선택" checked={checked.reward} onToggle={toggle} />

        {/* 안내 */}
        <div style={{ background: "#FFFBEB", borderRadius: 12, padding: "12px 14px", marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>ⓘ</span>
          <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
            선택 동의 거부 시에도 서비스 이용에 제한이 없습니다.<br />
            야간(21:00~08:00) 광고 정보는 발송하지 않습니다.
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "16px 20px 0" }}>
        <button
          disabled={!allReqDone}
          onClick={() => onComplete?.(checked)}
          style={{
            width: "100%",
            background: allReqDone ? "#2563EB" : "#E5E5E5",
            color: allReqDone ? "#fff" : "#A3A3A3",
            border: "none", borderRadius: 16, padding: 17,
            fontSize: 17, fontWeight: 800, cursor: allReqDone ? "pointer" : "not-allowed",
            transition: "background .15s", letterSpacing: "-0.01em",
          }}
        >
          동의하고 시작하기
        </button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#525252" }}>
          이미 계정이 있으신가요?{" "}
          <a href="/login" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 500 }}>
            로그인
          </a>
        </div>
      </div>

      {/* 전문 Sheet */}
      <Sheet open={sheet.open} onOpenChange={(o) => setSheet((p) => ({ ...p, open: o }))}>
        <SheetContent
          side="bottom"
          style={{ maxHeight: "75vh", overflowY: "auto", borderRadius: "16px 16px 0 0" }}
        >
          <SheetHeader>
            <SheetTitle style={{ fontSize: 18, fontWeight: 800, color: "#0A0A0A" }}>
              {sheet.title}
            </SheetTitle>
          </SheetHeader>
          <div style={{ marginTop: 16, fontSize: 14, color: "#525252", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {TERMS_CONTENT[sheet.key] ?? "내용을 불러오는 중입니다."}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default SignupTerms;
