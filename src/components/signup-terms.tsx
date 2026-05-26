import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import serviceMd from "@/content/terms/service.md?raw";
import privacyMd from "@/content/terms/privacy.md?raw";
import noticeMd from "@/content/terms/notice.md?raw";
import adPolicyMd from "@/content/terms/ad-policy.md?raw";
import rightsPolicyMd from "@/content/terms/rights-policy.md?raw";

export interface AgreedState {
  terms: boolean;
  privacy: boolean;
  notice: boolean;
  adNotice: boolean;
  rights: boolean;
  adChannels: string[];
  reward: boolean;
}

interface SignupTermsProps {
  onComplete: (agreed: AgreedState) => void;
}

type RequiredKey = "terms" | "privacy" | "notice" | "adNotice" | "rights" | "reward";

type TermsItem = {
  key: RequiredKey;
  label: string;
  content: string | null;
};

const ITEMS: TermsItem[] = [
  { key: "terms", label: "이용약관", content: serviceMd },
  { key: "privacy", label: "개인정보 처리방침", content: privacyMd },
  { key: "notice", label: "서비스 고지", content: noticeMd },
  { key: "adNotice", label: "광고·제휴 자동 고지", content: adPolicyMd },
  { key: "rights", label: "권리침해 신고·삭제 정책", content: rightsPolicyMd },
  { key: "reward", label: "만 14세 이상 · 리워드 적립 동의", content: null },
];

const AD_CHANNELS: Array<{ id: string; label: string }> = [
  { id: "kakao", label: "카카오톡" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "이메일" },
  { id: "push", label: "앱 푸시" },
];

export function SignupTerms({ onComplete }: SignupTermsProps) {
  const [state, setState] = useState<AgreedState>({
    terms: false,
    privacy: false,
    notice: false,
    adNotice: false,
    rights: false,
    adChannels: [],
    reward: false,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<TermsItem | null>(null);
  const [adChannelsExpanded, setAdChannelsExpanded] = useState(false);

  const allRequired = ITEMS.every((it) => state[it.key]);
  const allChecked = allRequired && state.adChannels.length === AD_CHANNELS.length;

  function toggleAll(next: boolean) {
    setState({
      terms: next,
      privacy: next,
      notice: next,
      adNotice: next,
      rights: next,
      adChannels: next ? AD_CHANNELS.map((c) => c.id) : [],
      reward: next,
    });
  }

  function toggleItem(key: RequiredKey) {
    setState((s) => ({ ...s, [key]: !s[key] }));
  }

  function toggleChannel(id: string) {
    setState((s) => ({
      ...s,
      adChannels: s.adChannels.includes(id)
        ? s.adChannels.filter((x) => x !== id)
        : [...s.adChannels, id],
    }));
  }

  function openSheet(item: TermsItem) {
    setSheetItem(item);
    setSheetOpen(true);
  }

  return (
    <>
      <div className="space-y-4 bg-white p-6">
        <button
          type="button"
          onClick={() => toggleAll(!allChecked)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full ${
              allChecked ? "bg-[#2563EB]" : "bg-slate-200"
            }`}
          >
            <Check className="size-4 text-white" strokeWidth={3} />
          </span>
          <span className="text-base font-bold tracking-ko text-text-strong">전체 동의</span>
        </button>

        <hr className="border-slate-100" />

        <ul className="space-y-3">
          {ITEMS.map((item) => (
            <li key={item.key} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleItem(item.key)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full ${
                    state[item.key] ? "bg-[#2563EB]" : "bg-slate-200"
                  }`}
                >
                  <Check className="size-3.5 text-white" strokeWidth={3} />
                </span>
                <span className="text-sm font-medium tracking-ko text-text-strong">
                  [필수] {item.label}
                </span>
              </button>
              {item.content && (
                <button
                  type="button"
                  onClick={() => openSheet(item)}
                  className="inline-flex items-center gap-0.5 text-xs font-medium tracking-ko text-[#A3A3A3] hover:text-[#2563EB]"
                >
                  전문 <ChevronRight className="size-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <hr className="border-slate-100" />

        <div>
          <button
            type="button"
            onClick={() => setAdChannelsExpanded((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <span className="text-sm font-medium tracking-ko text-text-muted">
              [선택] 광고·혜택 수신
            </span>
            {adChannelsExpanded ? (
              <ChevronDown className="size-4 text-text-muted" strokeWidth={2} />
            ) : (
              <ChevronRight className="size-4 text-text-muted" strokeWidth={2} />
            )}
          </button>
          {adChannelsExpanded && (
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {AD_CHANNELS.map((c) => {
                const isOn = state.adChannels.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggleChannel(c.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border p-3 text-sm tracking-ko transition-colors ${
                        isOn
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                          : "border-slate-200 bg-white text-text-strong"
                      }`}
                    >
                      <span
                        className={`flex size-4 items-center justify-center rounded-full ${
                          isOn ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <Check className="size-3 text-white" strokeWidth={3} />
                      </span>
                      {c.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          disabled={!allRequired}
          onClick={() => onComplete(state)}
          className={`w-full rounded-2xl py-4 text-base font-bold tracking-ko transition-colors ${
            allRequired
              ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              : "cursor-not-allowed bg-slate-200 text-slate-400"
          }`}
        >
          동의하고 시작하기
        </button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-bold tracking-ko text-text-strong">
              {sheetItem?.label ?? ""}
            </SheetTitle>
          </SheetHeader>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm tracking-ko text-text-strong">
            {sheetItem?.content ?? ""}
          </pre>
        </SheetContent>
      </Sheet>
    </>
  );
}
